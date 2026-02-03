/**
 * Database Service (Static JSON implementation)
 * 
 * Fetches scam patterns from a static JSON file hosted remotely.
 * This replaces the Supabase implementation for a zero-cost architecture.
 */

const REMOTE_PATTERNS_URL = 'https://raw.githubusercontent.com/dgarcia891/Scam-Alert/main/public/patterns.json';

/**
 * Fetch latest scam patterns from remote JSON
 * @param {number} lastSync - Optional timestamp of last sync for delta updates
 * @returns {Promise<Array>} - List of scam patterns
 */
export async function fetchScamPatterns(lastSync = 0) {
    try {
        const url = lastSync > 0
            ? `${REMOTE_PATTERNS_URL}?since=${lastSync}`
            : REMOTE_PATTERNS_URL;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const response = await fetch(url, {
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`Failed to fetch patterns: ${response.status}`);
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.warn('Failed to fetch remote patterns, falling back to local defaults:', error);
        return null;
    }
}

/**
 * Sync patterns and update local storage cache (Delta Support)
 */
export async function syncPatterns() {
    const result = await chrome.storage.local.get(['lastPatternSync', 'remoteScamPatterns']);
    const lastSync = result.lastPatternSync || 0;
    const existingPatterns = result.remoteScamPatterns || [];

    const newPatterns = await fetchScamPatterns(lastSync);

    if (newPatterns && Array.isArray(newPatterns)) {
        if (newPatterns.length === 0) return true;

        // Merge logic: append new, unique patterns
        const merged = [...existingPatterns];
        const existingPhrases = new Set(existingPatterns.map(p => p.phrase));

        newPatterns.forEach(pattern => {
            if (!existingPhrases.has(pattern.phrase)) {
                merged.push(pattern);
            }
        });

        await chrome.storage.local.set({
            remoteScamPatterns: merged,
            lastPatternSync: Date.now()
        });
        return true;
    }
    return false;
}

/**
 * Get merged patterns (local + remote cache)
 */
export async function getMergedScamPhrases() {
    const result = await chrome.storage.local.get(['remoteScamPatterns']);
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
