/**
 * Email Reputation Module
 * 
 * Provides email reputation lookups utilizing privacy-preserving
 * hashed caching via the sa-check-email-rep Edge Function.
 */

const CACHE_PREFIX = 'email_rep_';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE_ENTRIES = 100;

export async function getCachedEmailReputation(email) {
    try {
        const key = `${CACHE_PREFIX}${email}`;
        const result = await chrome.storage.session.get(key);
        if (result[key]) {
            const { data, timestamp } = result[key];
            if (Date.now() - timestamp < CACHE_TTL_MS) {
                return data;
            }
            await chrome.storage.session.remove(key);
        }
    } catch (e) {
        console.warn('[Email Rep] Cache read failed:', e.message);
    }
    return null;
}

export async function cacheEmailReputation(email, data) {
    try {
        const key = `${CACHE_PREFIX}${email}`;
        const all = await chrome.storage.session.get(null);
        const repKeys = Object.keys(all).filter(k => k.startsWith(CACHE_PREFIX));
        if (repKeys.length >= MAX_CACHE_ENTRIES) {
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
        console.warn('[Email Rep] Cache write failed:', e.message);
    }
}

export async function checkEmailReputation(email, context = {}) {
    if (!email || typeof email !== 'string') return null;

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
        return null; // Offline fallback
    }

    if (context.getSettings) {
        const settings = await context.getSettings();
        if (!settings.liveWebProtection) return null;
    }

    if (context.isWhitelisted) {
        const whitelisted = await context.isWhitelisted(email);
        if (whitelisted) return null;
    }

    const cached = await getCachedEmailReputation(email);
    if (cached) return cached;

    try {
        const data = await callCheckEmailEdge(email, context);
        if (data) {
            await cacheEmailReputation(email, data);
        }
        return data;
    } catch (e) {
        console.warn('[Email Rep] Edge function call failed:', e.message);
        return null;
    }
}

async function callCheckEmailEdge(email, context) {
    if (context.postEdgeFunction) {
        return await context.postEdgeFunction('sa-check-email-rep', { email });
    }

    const { getApiKey, FUNCTIONS_BASE_URL } = context;
    if (!FUNCTIONS_BASE_URL) {
        throw new Error('No Edge Function URL configured');
    }

    const apiKey = getApiKey ? await getApiKey() : '';
    const controller = new AbortController();
    // Use aggressive 4s timeout for email checks
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    try {
        const response = await fetch(`${FUNCTIONS_BASE_URL}/sa-check-email-rep`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-sa-api-key': apiKey,
            },
            body: JSON.stringify({ email }),
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
