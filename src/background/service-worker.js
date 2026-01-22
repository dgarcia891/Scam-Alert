/**
 * Background Service Worker (Main Entry Point)
 * 
 * MV3 service workers are ephemeral - they can be terminated at any time.
 * ALL state MUST be persisted in chrome.storage.
 * 
 * Architecture:
 * - Listens to webNavigation events
 * - Orchestrates scanning pipeline
 * - Manages UI updates (badges, notifications, warnings)
 * - Handles message routing
 */

import { getSettings, updateSettings, getStats, updateStats, getCachedScan, cacheScan, isWhitelisted, addToWhitelist, clearCache } from '../lib/storage.js';
import { MessageTypes, createMessageHandler, sendMessageToTab, createMessage } from '../lib/messaging.js';
import { scanUrl } from '../lib/detector.js';
import { downloadPhishTankDatabase } from '../lib/phishtank.js';

console.log('[Scam Alert] Service worker initializing...');

// ============================================================================
// Action Icon State (per-tab)
// ============================================================================

const DEFAULT_ACTION_ICON_PATHS = {
    16: 'icons/icon16.png',
    32: 'icons/icon32.png',
    48: 'icons/icon48.png'
};

const ICON_TINTS = {
    SAFE: '#16a34a',
    WARNING: '#f59e0b',
    DANGER: '#dc2626'
};

const tintedIconCache = new Map();

function severityToIconState(severity) {
    switch (severity) {
        case 'CRITICAL':
            return 'DANGER';
        case 'HIGH':
        case 'MEDIUM':
        case 'LOW':
            return 'WARNING';
        default:
            return 'SAFE';
    }
}

async function getTintedIconImageData(state) {
    if (tintedIconCache.has(state)) return tintedIconCache.get(state);

    const tint = ICON_TINTS[state];
    if (!tint) return null;

    const sizes = [16, 32, 48];
    const result = {};

    for (const size of sizes) {
        const url = chrome.runtime.getURL(DEFAULT_ACTION_ICON_PATHS[size]);
        const res = await fetch(url);
        const blob = await res.blob();
        const bitmap = await createImageBitmap(blob);

        const canvas = new OffscreenCanvas(size, size);
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, size, size);
        ctx.drawImage(bitmap, 0, 0, size, size);

        ctx.globalCompositeOperation = 'source-atop';
        ctx.fillStyle = tint;
        ctx.fillRect(0, 0, size, size);
        ctx.globalCompositeOperation = 'source-over';

        result[size] = ctx.getImageData(0, 0, size, size);
    }

    tintedIconCache.set(state, result);
    return result;
}

async function setActionIconForTab(tabId, severity) {
    try {
        if (!tabId) return;
        if (!severity) {
            await chrome.action.setIcon({ tabId, path: DEFAULT_ACTION_ICON_PATHS });
            return;
        }

        const state = severityToIconState(severity);
        const imageData = await getTintedIconImageData(state);
        if (!imageData) {
            await chrome.action.setIcon({ tabId, path: DEFAULT_ACTION_ICON_PATHS });
            return;
        }

        await chrome.action.setIcon({ tabId, imageData });
    } catch (error) {
        console.warn('[Scam Alert] Failed to set action icon:', error);
    }
}

async function syncIconForTabFromCache(tabId, url) {
    try {
        if (!tabId || !url) return;
        if (!shouldScanUrl(url)) {
            await setActionIconForTab(tabId, null);
            return;
        }
        const cached = await getCachedScan(url);
        await setActionIconForTab(tabId, cached?.overallSeverity || null);
    } catch (error) {
        console.warn('[Scam Alert] Failed to sync action icon from cache:', error);
    }
}

// ============================================================================
// Installation & Updates
// ============================================================================

chrome.runtime.onInstalled.addListener(async (details) => {
    console.log('[Scam Alert] Extension installed:', details.reason);

    const settings = await getSettings();

    // Deactivate PhishTank by default (no longer onboarding users)
    if (settings.usePhishTank) {
        await updateSettings({ usePhishTank: false, preferOffline: false });
    }

    if (details.reason === 'install') {
        // First-time setup
        if (settings.usePhishTank) {
            console.log('[Scam Alert] Downloading PhishTank database...');
            await downloadPhishTankDatabase(settings.phishTankApiKey);
        }

        // Show welcome notification
        chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icons/icon48.png',
            title: 'Scam Alert Installed',
            message: 'You\'re now protected from scams. The extension runs silently in the background.',
            priority: 2
        });

        // Initial scan of active tabs
        await scanActiveTabs();
    } else if (details.reason === 'update') {
        await clearCache();
        // Scan on update too
        await scanActiveTabs();
    }
});

// ============================================================================
// Periodic Tasks
// ============================================================================

// Defensive guard for alarms API (common crash point if permission is transient)
if (typeof chrome.alarms !== 'undefined') {
    chrome.alarms.onAlarm.addListener(async (alarm) => {
        if (alarm.name === 'updatePhishTankDB') {
            const settings = await getSettings();
            if (!settings.usePhishTank) return;

            console.log('[Scam Alert] Updating PhishTank database...');
            await downloadPhishTankDatabase(settings.phishTankApiKey);
        }
    });

    // Create/clear PhishTank alarm based on settings
    const initializeAlarms = async () => {
        try {
            const settings = await getSettings();
            if (settings.usePhishTank) {
                chrome.alarms.create('updatePhishTankDB', { periodInMinutes: 60 });
            } else {
                chrome.alarms.clear('updatePhishTankDB');
            }
        } catch (error) {
            console.warn('[Scam Alert] Failed to initialize alarms:', error);
        }
    };

    initializeAlarms();
} else {
    console.warn('[Scam Alert] Alarms API not available. Periodic updates disabled.');
}

// ============================================================================
// URL Scanning
// ============================================================================

/**
 * Check if URL should be scanned
 * @param {string} url - URL to check
 * @returns {boolean} True if should scan
 */
function shouldScanUrl(url) {
    try {
        const urlObj = new URL(url);

        // Skip internal URLs
        if (urlObj.protocol === 'chrome:' ||
            urlObj.protocol === 'chrome-extension:' ||
            urlObj.protocol === 'about:') {
            return false;
        }

        // Skip localhost
        if (urlObj.hostname === 'localhost' ||
            urlObj.hostname === '127.0.0.1') {
            return false;
        }

        return true;
    } catch {
        return false;
    }
}

/**
 * Scan URL and handle results
 * @param {number} tabId - Tab ID
 * @param {string} url - URL to scan
 * @param {Object} scanOptions - Options for scan behavior (e.g., forceRefresh)
 */
async function scanAndHandle(tabId, url, scanOptions = {}) {
    try {
        // Get settings
        const settings = await getSettings();

        if (!settings.scanningEnabled) {
            console.log('[Scam Alert] Scanning disabled');
            return;
        }

        // Check whitelist
        if (await isWhitelisted(url)) {
            console.log('[Scam Alert] URL whitelisted:', url);
            return;
        }

        const { forceRefresh = false } = scanOptions;

        // Check cache first (unless forced)
        let result = forceRefresh ? null : await getCachedScan(url);

        if (!result) {
            // Perform scan with progress updates
            console.log('[Scam Alert] Scanning:', url);

            const onProgress = (progress) => {
                try {
                    chrome.runtime.sendMessage(createMessage('scan_progress', progress), () => {
                        // Ignore errors (e.g., popup closed)
                        void chrome.runtime.lastError;
                    });
                } catch {
                    // Ignore errors
                }
            };

            result = await scanUrl(url, settings, onProgress);

            // Cache result
            await cacheScan(url, result);
        } else {
            console.log('[Scam Alert] Using cached result for:', url);
            // Even if cached, send a quick completion message
            try {
                chrome.runtime.sendMessage(createMessage('scan_progress', { percent: 100, message: 'Using cached results' }), () => {
                    void chrome.runtime.lastError;
                });
            } catch {
                // Ignore errors
            }
        }

        // Update stats
        await updateStats({
            scan: true,
            threat: result.overallThreat
        });

        // Handle threat
        if (result.overallThreat || result.overallSeverity !== 'SAFE') {
            await handleThreat(tabId, url, result, settings);
        } else {
            // Clear badge if no threat
            chrome.action.setBadgeText({ tabId, text: '' });
        }

        // Update toolbar icon color based on latest scan
        await setActionIconForTab(tabId, result.overallSeverity);

    } catch (error) {
        console.error('[Scam Alert] Scan error:', error);
    }
}

/**
 * Scan all active tabs in all windows
 */
async function scanActiveTabs() {
    console.log('[Scam Alert] Starting startup scan sweep...');
    try {
        const tabs = await chrome.tabs.query({ active: true });
        for (const tab of tabs) {
            if (tab.url && shouldScanUrl(tab.url)) {
                console.log(`[Scam Alert] Auto-scanning tab ${tab.id}: ${tab.url}`);
                // Fire and forget to avoid blocking
                scanAndHandle(tab.id, tab.url).catch(err =>
                    console.error(`[Scam Alert] Failed to auto-scan tab ${tab.id}:`, err)
                );
            }
        }
    } catch (error) {
        console.error('[Scam Alert] startup scan sweep failed:', error);
    }
}

/**
 * Handle detected threat
 * @param {number} tabId - Tab ID
 * @param {string} url - URL with threat
 * @param {Object} result - Scan result
 * @param {Object} settings - User settings
 */
async function handleThreat(tabId, url, result, settings) {
    console.warn('[Scam Alert] THREAT DETECTED:', url, result);

    // Set badge
    chrome.action.setBadgeText({ tabId, text: '!' });
    chrome.action.setBadgeBackgroundColor({ tabId, color: '#DC2626' });

    // Show notification for critical threats
    if (settings.notificationsEnabled && result.overallSeverity === 'CRITICAL') {
        chrome.notifications.create({
            type: 'basic',
            iconUrl: '/icons/icon48.png',
            title: '⚠️ SCAM WARNING',
            message: result.recommendations[0] || 'Dangerous website detected!',
            priority: 2,
            requireInteraction: true
        });
    }

    // Inject warning overlay ONLY for critical threats.
    // Browser interstitials (when present) are authoritative and can't be reliably replaced.
    if (result.overallSeverity === 'CRITICAL') {
        try {
            await sendMessageToTab(
                tabId,
                createMessage(MessageTypes.SHOW_WARNING, { result })
            );
        } catch (error) {
            console.error('[Scam Alert] Failed to show warning:', error);
        }
    }
}

// Listen for navigation
chrome.webNavigation.onBeforeNavigate.addListener(async (details) => {
    // Only scan main frame
    if (details.frameId !== 0) return;

    const url = details.url;

    if (!shouldScanUrl(url)) return;

    await scanAndHandle(details.tabId, url);
});

// Keep icon in sync when user switches tabs
chrome.tabs.onActivated.addListener(async ({ tabId }) => {
    try {
        const tab = await chrome.tabs.get(tabId);
        if (!tab?.url) return;
        await syncIconForTabFromCache(tabId, tab.url);
    } catch {
        // Ignore
    }
});

// Reset/sync icon when a tab finishes navigating
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status !== 'complete') return;
    if (!tab?.url) return;
    syncIconForTabFromCache(tabId, tab.url);
});

// ============================================================================
// Message Handling
// ============================================================================

chrome.runtime.onMessage.addListener(createMessageHandler(async (message, sender) => {
    const { type, data } = message;

    switch (type) {
        case MessageTypes.GET_TAB_STATUS: {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab) return { error: 'No active tab' };
            const result = await getCachedScan(tab.url);
            return { url: tab.url, result };
        }

        case MessageTypes.SCAN_CURRENT_TAB: {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab) {
                await scanAndHandle(tab.id, tab.url, { forceRefresh: Boolean(data?.forceRefresh) });
            }
            return { success: true };
        }

        case MessageTypes.GET_STATS: {
            const stats = await getStats();
            return stats;
        }

        case MessageTypes.UPDATE_SETTINGS: {
            await updateSettings(data);
            return { success: true };
        }

        case MessageTypes.ADD_TO_WHITELIST: {
            await addToWhitelist(data.domain);
            // Clear badge for current tab if it matches
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab) {
                chrome.action.setBadgeText({ tabId: tab.id, text: '' });
            }
            return { success: true };
        }

        default:
            console.warn('[Scam Alert] Unknown message type:', type);
            return { error: 'Unknown message type' };
    }
}));

console.log('[Scam Alert] Service worker ready');
