/**
 * AI Rate Limiter (FEAT-088)
 * 
 * Prevents API abuse and controls costs using domain-level cooldowns 
 * and a global daily ceiling.
 */

const DOMAIN_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Check if the global daily ceiling has been reached.
 * @param {number} dailyCeiling 
 * @returns {Promise<boolean>}
 */
async function isGlobalAllowed(dailyCeiling = 50) {
    const today = new Date().toISOString().split('T')[0];
    const key = `sa_ai_rate_global_${today}`;

    const data = await chrome.storage.local.get(key);
    const count = data[key] || 0;

    return count < dailyCeiling;
}

/**
 * Check if the domain is still in cooldown.
 * @param {string} hostname 
 * @returns {Promise<boolean>}
 */
async function isDomainAllowed(hostname) {
    const key = `sa_ai_rate_domain_${hostname}`;
    const data = await chrome.storage.local.get(key);
    const lastCall = data[key] || 0;

    return (Date.now() - lastCall) > DOMAIN_COOLDOWN_MS;
}

/**
 * Increment the global and domain rate counters.
 * @param {string} hostname 
 */
export async function incrementRateCounters(hostname) {
    const today = new Date().toISOString().split('T')[0];
    const globalKey = `sa_ai_rate_global_${today}`;
    const domainKey = `sa_ai_rate_domain_${hostname}`;

    const data = await chrome.storage.local.get(globalKey);
    const currentGlobal = data[globalKey] || 0;

    await chrome.storage.local.set({
        [globalKey]: currentGlobal + 1,
        [domainKey]: Date.now()
    });
}

/**
 * Main entrance for rate limit check.
 * @param {string} url 
 * @param {Object} settings - { aiDailyCeiling }
 * @returns {Promise<{ allowed: boolean, reason: string | null }>}
 */
export async function checkAICanRun(url, settings = {}) {
    try {
        const hostname = new URL(url).hostname;

        if (!await isGlobalAllowed(settings.aiDailyCeiling)) {
            return { allowed: false, reason: 'daily_ceiling' };
        }

        if (!await isDomainAllowed(hostname)) {
            return { allowed: false, reason: 'domain_cooldown' };
        }

        return { allowed: true, reason: null };
    } catch (err) {
        return { allowed: false, reason: 'invalid_url' };
    }
}
