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
    WHITELIST: 'whitelist',
    BLOCKLIST: 'blocklist',
    LICENSE_KEY: 'license_key',
    PLAN_TYPE: 'plan_type',
    REMOTE_PATTERNS: 'remoteScamPatterns',
    LAST_SYNC: 'lastPatternSync'
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
    const defaults = {
        scanningEnabled: true,
        notificationsEnabled: true,
        notifyOnHttpWarning: false,
        collectPageSignals: false,
        useGoogleSafeBrowsing: true,
        usePhishTank: false,
        usePatternDetection: true,
        preferOffline: false,
        gsbApiKey: '',
        phishTankApiKey: '',
        licenseKey: '',
        planType: 'free', // 'free' | 'pro'
        emailScanningEnabled: true,
        emailPromptDisabled: false,
        aiEnabled: true,
        aiApiKey: '',
        aiDailyCeiling: 50
    };

    const merged = { ...defaults, ...(result[STORAGE_KEYS.SETTINGS] || {}) };

    // FEAT-088: Default ON for Pro, OFF for Free if not explicitly set
    if (result[STORAGE_KEYS.SETTINGS]?.aiEnabled === undefined) {
        merged.aiEnabled = merged.planType === 'pro';
    }

    return merged;
}

/**
 * Check if the user has a Pro plan
 * @returns {Promise<boolean>} True if Pro
 */
export async function isPro() {
    const settings = await getSettings();
    return settings.planType === 'pro';
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
        const { result: data, timestamp } = result[key];
        const age = Date.now() - timestamp;
        const MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours

        if (age < MAX_AGE) {
            // BUG-076: Normalize legacy cache schemas lacking canonical overallSeverity mapping
            if (data && typeof data === 'object') {
                if (data.overallSeverity === undefined && data.severity) {
                    data.overallSeverity = data.severity;
                }
                if (data.overallThreat === undefined && data.severity) {
                    data.overallThreat = data.severity === 'CRITICAL' || data.severity === 'HIGH';
                }
            }
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
            result: data,
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
    const defaults = {
        totalScans: 0,
        threatsBlocked: 0,
        lastThreatDate: null,
        scansBySource: {
            pattern: 0,
            phishTank: 0,
            googleSafeBrowsing: 0
        },
        recentActivity: []
    };

    return { ...defaults, ...(result[STORAGE_KEYS.STATS] || {}) };
}

/**
 * Update statistics (Resilient, atomic-like update)
 * @param {Object} update - Stats update
 * @returns {Promise<void>}
 */
export async function updateStats(update) {
    // Sanitize and read current state
    const result = await chrome.storage.local.get(STORAGE_KEYS.STATS);
    const current = result[STORAGE_KEYS.STATS] || {};

    // Ensure structure is sound (Repair on the fly if needed)
    const recentActivity = Array.isArray(current.recentActivity) ? current.recentActivity : [];
    const totalScans = typeof current.totalScans === 'number' ? current.totalScans : 0;
    const threatsBlocked = typeof current.threatsBlocked === 'number' ? current.threatsBlocked : 0;
    const scansBySource = current.scansBySource || { pattern: 0, phishTank: 0, googleSafeBrowsing: 0 };

    if (update.activity) {
        recentActivity.unshift(update.activity);
        if (recentActivity.length > 50) recentActivity.pop();
    }

    const updated = {
        totalScans: totalScans + (update.scan ? 1 : 0),
        threatsBlocked: threatsBlocked + (update.threat ? 1 : 0),
        lastThreatDate: update.threat ? Date.now() : (current.lastThreatDate || null),
        scansBySource: {
            ...scansBySource,
            ...(update.scansBySource || {})
        },
        recentActivity
    };

    console.log(`[Storage] Updating totalScans from ${totalScans} to ${updated.totalScans}`);
    await chrome.storage.local.set({ [STORAGE_KEYS.STATS]: updated });
}

/**
 * Sanitize and repair statistics if they are corrupted
 */
export async function repairStatistics() {
    console.log('[Storage] Performing statistics repair/sanitization...');
    const result = await chrome.storage.local.get(STORAGE_KEYS.STATS);
    const stats = result[STORAGE_KEYS.STATS];

    if (!stats || typeof stats !== 'object' || !Array.isArray(stats.recentActivity)) {
        console.warn('[Storage] Statistics corrupted or missing. Resetting to healthy state.');
        const healthy = {
            totalScans: stats?.totalScans || 0,
            threatsBlocked: stats?.threatsBlocked || 0,
            lastThreatDate: stats?.lastThreatDate || null,
            scansBySource: stats?.scansBySource || { pattern: 0, phishTank: 0, googleSafeBrowsing: 0 },
            recentActivity: []
        };
        await chrome.storage.local.set({ [STORAGE_KEYS.STATS]: healthy });
    }
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
export async function isWhitelisted(urlOrEmail) {
    if (!urlOrEmail) return false;

    try {
        const whitelist = await getWhitelist();

        // Handle Email Addresses or raw domains directly
        if (!urlOrEmail.includes('://')) {
            const identity = urlOrEmail.toLowerCase().trim();
            return whitelist.some(whitelisted =>
                identity === whitelisted || identity.endsWith(`@${whitelisted}`)
            );
        }

        // Handle URLs
        const urlObj = new URL(urlOrEmail);
        const domain = urlObj.hostname.replace(/^www\./, '').toLowerCase();

        return whitelist.some(whitelisted =>
            domain === whitelisted || domain.endsWith(`.${whitelisted}`)
        );
    } catch (e) {
        console.warn('[Storage] isWhitelisted check failed:', e);
        return false;
    }
}

/**
 * Get blocklist
 * @returns {Promise<Array>} Blocklisted domains
 */
export async function getBlocklist() {
    const result = await chrome.storage.local.get(STORAGE_KEYS.BLOCKLIST);
    return result[STORAGE_KEYS.BLOCKLIST] || [];
}

/**
 * Add domain to blocklist
 * @param {string} domain - Domain to blocklist
 * @returns {Promise<void>}
 */
export async function addToBlocklist(domain) {
    const blocklist = await getBlocklist();
    if (!blocklist.includes(domain)) {
        blocklist.push(domain);
        await chrome.storage.local.set({ [STORAGE_KEYS.BLOCKLIST]: blocklist });
    }
}

/**
 * Remove domain from blocklist
 * @param {string} domain - Domain to remove
 * @returns {Promise<void>}
 */
export async function removeFromBlocklist(domain) {
    const blocklist = await getBlocklist();
    const filtered = blocklist.filter(d => d !== domain);
    await chrome.storage.local.set({ [STORAGE_KEYS.BLOCKLIST]: filtered });
}

/**
 * Merge new domains into blocklist
 * @param {Array} newDomains - List of domains to add
 * @returns {Promise<number>} Number of new domains added
 */
export async function mergeBlocklist(newDomains) {
    if (!Array.isArray(newDomains) || newDomains.length === 0) return 0;

    const blocklist = await getBlocklist();
    const currentSet = new Set(blocklist);
    let addedCount = 0;

    newDomains.forEach(domain => {
        if (domain && typeof domain === 'string') {
            const normalized = domain.toLowerCase().trim();
            if (normalized && !currentSet.has(normalized)) {
                blocklist.push(normalized);
                currentSet.add(normalized); // Keep set in sync for O(1) checks
                addedCount++;
            }
        }
    });

    if (addedCount > 0) {
        await chrome.storage.local.set({ [STORAGE_KEYS.BLOCKLIST]: blocklist });
        console.log(`[Storage] Merged ${addedCount} new domains into blocklist.`);
    }
    return addedCount;
}

/**
 * Check if domain is blocked
 * @param {string} urlOrEmail - URL or Email to check
 * @returns {Promise<boolean>} True if blocked
 */
export async function isBlocked(urlOrEmail) {
    if (!urlOrEmail) return false;

    try {
        const blocklist = await getBlocklist();

        // Handle Email Addresses or raw domains directly
        if (!urlOrEmail.includes('://')) {
            const identity = urlOrEmail.toLowerCase().trim();
            return blocklist.some(blocked =>
                identity === blocked || identity.endsWith(`@${blocked}`)
            );
        }

        // Handle URLs
        const urlObj = new URL(urlOrEmail);
        const domain = urlObj.hostname.replace(/^www\./, '').toLowerCase();

        return blocklist.some(blocked =>
            domain === blocked || domain.endsWith(`.${blocked}`)
        );
    } catch (e) {
        console.warn('[Storage] isBlocked check failed:', e);
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
