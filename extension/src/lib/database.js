/**
 * Database Service (Dual-source pattern sync)
 * 
 * PRIMARY: AcmeZone2 Supabase edge function (sa-sync-patterns) — live patterns from database
 * FALLBACK: Static JSON hosted on GitHub — works even if backend is down
 * 
 * Phase 25.0: Upgraded from GitHub-only to edge-function-first.
 */

const EDGE_FUNCTION_URL = 'https://ypeopjbfbxmjfkejbkuq.supabase.co/functions/v1/sa-sync-patterns';
const GITHUB_FALLBACK_URL = 'https://raw.githubusercontent.com/dgarcia891/Hydra-Guard/main/public/patterns.json';

/**
 * Fetch latest scam patterns — tries edge function first, then GitHub fallback
 * @param {number} lastSync - Optional timestamp of last sync for delta updates
 * @returns {Promise<Object|null>} - Pattern data or null on failure
 */
export async function fetchScamPatterns(lastSync = 0) {
    // Try primary source: edge function
    try {
        const url = lastSync > 0
            ? `${EDGE_FUNCTION_URL}?since=${lastSync}`
            : EDGE_FUNCTION_URL;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (response.ok) {
            const data = await response.json();
            if (data.ok && (data.patterns || data.keywords)) {
                console.log(`[Hydra Guard] Synced ${data.count || 0} patterns from backend`);
                return data;
            }
        }
    } catch (error) {
        console.warn('[Hydra Guard] Edge function unavailable, trying GitHub fallback:', error.message);
    }

    // Fallback: static GitHub JSON
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const response = await fetch(GITHUB_FALLBACK_URL, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (!response.ok) throw new Error(`GitHub fetch failed: ${response.status}`);
        const data = await response.json();
        console.log('[Hydra Guard] Synced patterns from GitHub fallback');
        return data;
    } catch (error) {
        console.warn('[Hydra Guard] Both pattern sources failed:', error.message);
        return null;
    }
}

/**
 * Sync patterns and update local storage cache (Delta Support)
 */
export async function syncPatterns() {
    const result = (await chrome.storage.local.get(['lastPatternSync', 'remoteScamPatterns', 'remoteSuspiciousKeywords'])) || {};
    const lastSync = result.lastPatternSync || 0;
    const existingPatterns = result.remoteScamPatterns || [];
    const existingKeywords = result.remoteSuspiciousKeywords || [];

    const data = await fetchScamPatterns(lastSync);

    if (data) {
        let updated = false;
        const updates = { lastPatternSync: Date.now() };

        // Handle Phrases (Patterns)
        if (data.patterns && Array.isArray(data.patterns)) {
            const mergedPatterns = [...existingPatterns];
            const existingPhrases = new Set(existingPatterns.map(p => p.phrase));
            data.patterns.forEach(pattern => {
                if (!existingPhrases.has(pattern.phrase)) {
                    mergedPatterns.push(pattern);
                    updated = true;
                }
            });
            if (updated) updates.remoteScamPatterns = mergedPatterns;
        } else if (Array.isArray(data)) {
            // Legacy/Simple array format support
            const mergedPatterns = [...existingPatterns];
            const existingPhrases = new Set(existingPatterns.map(p => p.phrase));
            data.forEach(pattern => {
                if (!existingPhrases.has(pattern.phrase)) {
                    mergedPatterns.push(pattern);
                    updated = true;
                }
            });
            if (updated) updates.remoteScamPatterns = mergedPatterns;
        }

        // Handle Keywords
        if (data.keywords && Array.isArray(data.keywords)) {
            const mergedKeywords = [...new Set([...existingKeywords, ...data.keywords])];
            if (mergedKeywords.length !== existingKeywords.length) {
                updates.remoteSuspiciousKeywords = mergedKeywords;
                updated = true;
            }
        }

        if (updated) {
            await chrome.storage.local.set(updates);
        }
        return true;
    }
    return false;
}

/**
 * Get merged patterns (local + remote cache)
 */
export async function getMergedScamPhrases() {
    const result = (await chrome.storage.local.get(['remoteScamPatterns'])) || {};
    const remotePatterns = result.remoteScamPatterns || [];

    // Default base phrases
    const localPhrases = [
        'you have won', 'claim your prize', 'act now', 'limited time',
        'your account has been suspended', 'verify your identity',
        'urgent action required', 'confirm your information',
        'click here immediately', 'your computer is infected',
        'call this number now', 'refund pending', 'tax refund',
        'purchase a gift card', 'send me the a picture of the code',
        'do not share this code', 'verify your wallet', 'compromised account',
        'legal action', 'final notice', 'money order', 'crypto transfer'
    ];

    const remotePhrases = remotePatterns.map(p => p.phrase);
    return [...new Set([...localPhrases, ...remotePhrases])];
}

/**
 * Get merged suspicious keywords (local + remote cache)
 */
export async function getMergedSuspiciousKeywords() {
    const result = (await chrome.storage.local.get(['remoteSuspiciousKeywords'])) || {};
    const remoteKeywords = result.remoteSuspiciousKeywords || [];

    const localKeywords = [
        'login', 'signin', 'verify', 'update', 'secure', 'account', 'banking',
        'suspend', 'locked', 'urgent', 'confirm', 'billing', 'payment', 'wallet',
        'alert', 'warning'
    ];

    return [...new Set([...localKeywords, ...remoteKeywords])];
}

/**
 * Get merged email-specific keywords by category (local + remote cache)
 * Used by email-heuristics.js to augment its hardcoded lists with DB entries.
 */
export async function getMergedEmailKeywords() {
    const result = (await chrome.storage.local.get(['remoteScamPatterns'])) || {};
    const remotePatterns = result.remoteScamPatterns || [];

    return {
        giftCardKeywords: remotePatterns
            .filter(p => p.category === 'gift_card')
            .map(p => p.phrase),
        commandWords: remotePatterns
            .filter(p => p.category === 'command')
            .map(p => p.phrase),
        financeKeywords: remotePatterns
            .filter(p => p.category === 'finance')
            .map(p => p.phrase),
        vagueLureKeywords: remotePatterns
            .filter(p => p.category === 'vague_lure')
            .map(p => p.phrase),
        authorityPressureSignals: remotePatterns
            .filter(p => p.category === 'authority_pressure')
            .map(p => p.phrase),
    };
}

/**
 * Get merged urgency-specific keywords (local + remote cache)
 * Used by phrase-engine.js checkUrgencySignals() — separate from general scam phrases.
 */
export async function getMergedUrgencyKeywords() {
    const result = (await chrome.storage.local.get(['remoteScamPatterns'])) || {};
    const remotePatterns = result.remoteScamPatterns || [];

    const remoteUrgency = remotePatterns
        .filter(p => p.category === 'urgency')
        .map(p => p.phrase);

    // Base urgency keywords (mirrors phrase-engine.js baseUrgency)
    const localUrgency = [
        'immediately', 'suspended', 'unauthorized', 'urgent', 'action required',
        'verify now', 'account locked', 'suspicious activity', 'security alert',
        'gift card', 'google play', 'apple card', 'steam card', 'vanilla',
        'picture of the back', 'scratch the back', 'scratch and send',
        'gift card for me', 'pick up gift cards', 'amount of each card', 'reveal the code'
    ];

    return [...new Set([...localUrgency, ...remoteUrgency])];
}
