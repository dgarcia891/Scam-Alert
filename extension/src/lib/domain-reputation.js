/**
 * Domain Reputation Module
 * 
 * Provides real-time domain reputation lookups with MV3-safe caching.
 * 
 * Architecture (per critic review):
 * - L1 cache: chrome.storage.session (survives SW restarts, 5-min TTL)
 * - L2: Edge Function sa-check-domain (server-side with external API enrichment)
 * - Short-circuits on whitelisted domains
 * - Runs on webNavigation.onCompleted (post-redirect, final URL)
 * - Respects navigator.onLine for offline resilience
 * 
 * Lesson: BUG-059 — never use in-memory Maps for MV3 state.
 */

const CACHE_PREFIX = 'domain_rep_';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE_ENTRIES = 200; // Prevent exceeding chrome.storage.session 1MB limit

/**
 * Normalize a URL to its bare domain.
 * Client-side fast strip — eTLD+1 happens on the server.
 * 
 * @param {string} url - Full URL
 * @returns {string} Normalized domain (e.g., "example.com")
 */
export function normalizeDomain(url) {
    try {
        const urlObj = new URL(url);
        let hostname = urlObj.hostname.toLowerCase();
        // Strip leading www.
        if (hostname.startsWith('www.')) {
            hostname = hostname.substring(4);
        }
        return hostname;
    } catch {
        return '';
    }
}

/**
 * Score thresholds for badge display.
 * Requires BOTH score AND distinct reporters to prevent abuse (Finding 5).
 * 
 * @param {number} score - Aggregated score
 * @param {number} distinctReporters - Number of distinct reporters
 * @param {boolean} externalFlagged - Whether an external API flagged this domain
 * @returns {{ level: string, color: string, text: string } | null}
 */
export function getReputationBadge(score, distinctReporters, externalFlagged) {
    if (externalFlagged) {
        return { level: 'DANGEROUS', color: '#DC2626', text: '⚠' };
    }
    if (score >= 50 && distinctReporters >= 15) {
        return { level: 'LIKELY_SCAM', color: '#DC2626', text: '!' };
    }
    if (score >= 15 && distinctReporters >= 5) {
        return { level: 'SUSPICIOUS', color: '#f97316', text: '!' };
    }
    if (score >= 5 && distinctReporters >= 2) {
        return { level: 'CAUTION', color: '#f59e0b', text: '!' };
    }
    return null; // Clean — no badge
}

/**
 * Read cached reputation data from chrome.storage.session.
 * Returns null if expired or missing.
 * 
 * @param {string} domain - Normalized domain
 * @returns {Promise<Object|null>}
 */
export async function getCachedReputation(domain) {
    try {
        const key = `${CACHE_PREFIX}${domain}`;
        const result = await chrome.storage.session.get(key);
        if (result[key]) {
            const { data, timestamp } = result[key];
            if (Date.now() - timestamp < CACHE_TTL_MS) {
                return data;
            }
            // Expired — clean up
            await chrome.storage.session.remove(key);
        }
    } catch (e) {
        // chrome.storage.session may not be available in all contexts
        console.warn('[Domain Rep] Cache read failed:', e.message);
    }
    return null;
}

/**
 * Write reputation data to chrome.storage.session cache.
 * Implements size-capped eviction to stay under 1MB limit.
 * 
 * @param {string} domain - Normalized domain
 * @param {Object} data - Reputation data from Edge Function
 */
export async function cacheReputation(domain, data) {
    try {
        const key = `${CACHE_PREFIX}${domain}`;

        // Evict oldest entries if we're near the limit
        const all = await chrome.storage.session.get(null);
        const repKeys = Object.keys(all).filter(k => k.startsWith(CACHE_PREFIX));
        if (repKeys.length >= MAX_CACHE_ENTRIES) {
            // Sort by timestamp, remove oldest 20%
            const entries = repKeys.map(k => ({ key: k, ts: all[k]?.timestamp || 0 }));
            entries.sort((a, b) => a.ts - b.ts);
            const toRemove = entries.slice(0, Math.ceil(MAX_CACHE_ENTRIES * 0.2)).map(e => e.key);
            await chrome.storage.session.remove(toRemove);
        }

        await chrome.storage.session.set({
            [key]: {
                data,
                timestamp: Date.now()
            }
        });
    } catch (e) {
        console.warn('[Domain Rep] Cache write failed:', e.message);
    }
}

/**
 * Check domain reputation via the Edge Function.
 * Full pipeline: cache check → whitelist check → online check → API call.
 * 
 * @param {string} url - Full page URL
 * @param {Object} context - { isWhitelisted, getSettings, postEdgeFunction }
 * @returns {Promise<Object|null>} Reputation data or null
 */
export async function checkDomainReputation(url, context = {}) {
    const domain = normalizeDomain(url);
    if (!domain) return null;

    // 1. Offline guard (Finding: offline resilience)
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
        return null;
    }

    // 2. Settings guard
    if (context.getSettings) {
        const settings = await context.getSettings();
        if (!settings.liveWebProtection) return null;
    }

    // 3. Whitelist short-circuit (Finding 4)
    if (context.isWhitelisted) {
        const whitelisted = await context.isWhitelisted(url);
        if (whitelisted) return null;
    }

    // 4. L1 Cache check (chrome.storage.session)
    const cached = await getCachedReputation(domain);
    if (cached) return cached;

    // 5. Call Edge Function
    try {
        const data = await callCheckDomainEdge(domain, context);
        if (data) {
            await cacheReputation(domain, data);
        }
        return data;
    } catch (e) {
        console.warn('[Domain Rep] Edge function call failed:', e.message);
        return null;
    }
}

/**
 * Call the sa-check-domain Edge Function.
 * 
 * @param {string} domain
 * @param {Object} context
 * @returns {Promise<Object>}
 */
async function callCheckDomainEdge(domain, context) {
    // Use the existing postEdgeFunction pattern from supabase.js
    if (context.postEdgeFunction) {
        return await context.postEdgeFunction('sa-check-domain', { domain });
    }

    // Fallback: direct fetch (for standalone usage)
    const { getApiKey, FUNCTIONS_BASE_URL } = context;
    if (!FUNCTIONS_BASE_URL) {
        throw new Error('No Edge Function URL configured');
    }

    const apiKey = getApiKey ? await getApiKey() : '';
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
        const response = await fetch(`${FUNCTIONS_BASE_URL}/sa-check-domain`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-sa-api-key': apiKey,
            },
            body: JSON.stringify({ domain }),
            signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        clearTimeout(timeoutId);
        throw error;
    }
}
