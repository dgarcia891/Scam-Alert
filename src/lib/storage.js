/**
 * Storage Service
 * 
 * Wrapper around chrome.storage.local for type-safe state management.
 * Service workers are ephemeral - ALL state MUST be persisted here.
 */

const STORAGE_KEYS = {
    SETTINGS: 'settings',
    CACHE_PREFIX: 'scan_cache_',
    PHISHTANK_DB: 'phishTankDatabase',
    PHISHTANK_UPDATED: 'phishTankLastUpdated',
    STATS: 'statistics',
    WHITELIST: 'whitelist'
};

/**
 * Normalize URL for consistent storage keys (removes fragments, trailing slashes, etc.)
 * @param {string} url - URL to normalize
 * @returns {string} Normalized URL
 */
export function normalizeUrl(url) {
    try {
        const urlObj = new URL(url);
        // Remove fragment
        urlObj.hash = '';
        // Remove trailing slash from pathname if present
        if (urlObj.pathname.length > 1 && urlObj.pathname.endsWith('/')) {
            urlObj.pathname = urlObj.pathname.slice(0, -1);
        }
        // Normalize hostname
        urlObj.hostname = urlObj.hostname.toLowerCase();

        return urlObj.toString();
    } catch {
        return url;
    }
}

/**
 * Get user settings
 * @returns {Promise<Object>} User settings
 */
export async function getSettings() {
    const result = await chrome.storage.local.get(STORAGE_KEYS.SETTINGS);

    return result[STORAGE_KEYS.SETTINGS] || {
        scanningEnabled: true,
        notificationsEnabled: true,
        useGoogleSafeBrowsing: true,
        usePhishTank: false,
        usePatternDetection: true,
        preferOffline: false,
        gsbApiKey: '',
        phishTankApiKey: ''
    };
}

/**
 * Update user settings
 * @param {Object} updates - Settings to update
 * @returns {Promise<void>}
 */
export async function updateSettings(updates) {
    const current = await getSettings();
    const updated = { ...current, ...updates };
    await chrome.storage.local.set({ [STORAGE_KEYS.SETTINGS]: updated });
}

/**
 * Get cached scan result
 * @param {string} url - URL to check
 * @returns {Promise<Object|null>} Cached result or null
 */
export async function getCachedScan(url) {
    const normalized = normalizeUrl(url);
    const key = `${STORAGE_KEYS.CACHE_PREFIX}${normalized}`;
    const result = await chrome.storage.local.get(key);

    if (result[key]) {
        const { data, timestamp } = result[key];
        const age = Date.now() - timestamp;
        const MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours

        if (age < MAX_AGE) {
            return data;
        }

        // Expired - remove it
        await chrome.storage.local.remove(key);
    }

    return null;
}

/**
 * Cache scan result
 * @param {string} url - URL scanned
 * @param {Object} data - Scan result
 * @returns {Promise<void>}
 */
export async function cacheScan(url, data) {
    const normalized = normalizeUrl(url);
    const key = `${STORAGE_KEYS.CACHE_PREFIX}${normalized}`;
    await chrome.storage.local.set({
        [key]: {
            data,
            timestamp: Date.now()
        }
    });
}

/**
 * Get PhishTank database
 * @returns {Promise<Array>} PhishTank database
 */
export async function getPhishTankDB() {
    const result = await chrome.storage.local.get([
        STORAGE_KEYS.PHISHTANK_DB,
        STORAGE_KEYS.PHISHTANK_UPDATED
    ]);

    return {
        database: result[STORAGE_KEYS.PHISHTANK_DB] || [],
        lastUpdated: result[STORAGE_KEYS.PHISHTANK_UPDATED] || 0
    };
}

/**
 * Update PhishTank database
 * @param {Array} database - New database
 * @returns {Promise<void>}
 */
export async function updatePhishTankDB(database) {
    await chrome.storage.local.set({
        [STORAGE_KEYS.PHISHTANK_DB]: database,
        [STORAGE_KEYS.PHISHTANK_UPDATED]: Date.now()
    });
}

/**
 * Get statistics
 * @returns {Promise<Object>} Statistics
 */
export async function getStats() {
    const result = await chrome.storage.local.get(STORAGE_KEYS.STATS);

    return result[STORAGE_KEYS.STATS] || {
        totalScans: 0,
        threatsBlocked: 0,
        lastThreatDate: null,
        scansBySource: {
            pattern: 0,
            phishTank: 0,
            googleSafeBrowsing: 0
        }
    };
}

/**
 * Update statistics
 * @param {Object} update - Stats update
 * @returns {Promise<void>}
 */
export async function updateStats(update) {
    const current = await getStats();
    const updated = {
        totalScans: current.totalScans + (update.scan ? 1 : 0),
        threatsBlocked: current.threatsBlocked + (update.threat ? 1 : 0),
        lastThreatDate: update.threat ? Date.now() : current.lastThreatDate,
        scansBySource: {
            ...current.scansBySource,
            ...update.scansBySource
        }
    };

    await chrome.storage.local.set({ [STORAGE_KEYS.STATS]: updated });
}

/**
 * Get whitelist
 * @returns {Promise<Array>} Whitelisted domains
 */
export async function getWhitelist() {
    const result = await chrome.storage.local.get(STORAGE_KEYS.WHITELIST);
    return result[STORAGE_KEYS.WHITELIST] || [];
}

/**
 * Add domain to whitelist
 * @param {string} domain - Domain to whitelist
 * @returns {Promise<void>}
 */
export async function addToWhitelist(domain) {
    const whitelist = await getWhitelist();
    if (!whitelist.includes(domain)) {
        whitelist.push(domain);
        await chrome.storage.local.set({ [STORAGE_KEYS.WHITELIST]: whitelist });
    }
}

/**
 * Remove domain from whitelist
 * @param {string} domain - Domain to remove
 * @returns {Promise<void>}
 */
export async function removeFromWhitelist(domain) {
    const whitelist = await getWhitelist();
    const filtered = whitelist.filter(d => d !== domain);
    await chrome.storage.local.set({ [STORAGE_KEYS.WHITELIST]: filtered });
}

/**
 * Check if domain is whitelisted
 * @param {string} url - URL to check
 * @returns {Promise<boolean>} True if whitelisted
 */
export async function isWhitelisted(url) {
    try {
        const urlObj = new URL(url);
        const domain = urlObj.hostname.replace(/^www\./, '');
        const whitelist = await getWhitelist();

        return whitelist.some(whitelisted =>
            domain === whitelisted || domain.endsWith(`.${whitelisted}`)
        );
    } catch {
        return false;
    }
}

/**
 * Clear all cache
 * @returns {Promise<void>}
 */
export async function clearCache() {
    const allData = await chrome.storage.local.get(null);
    const cacheKeys = Object.keys(allData).filter(key =>
        key.startsWith(STORAGE_KEYS.CACHE_PREFIX)
    );

    if (cacheKeys.length > 0) {
        await chrome.storage.local.remove(cacheKeys);
    }
}
