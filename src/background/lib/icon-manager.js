import { getCachedScan } from '../../lib/storage.js';

export const DEFAULT_ACTION_ICON_PATHS = {
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
const httpNotificationCache = new Map();
const HTTP_NOTIFICATION_TTL = 5 * 60 * 1000; // 5 minutes

export function severityToIconState(severity) {
    switch (severity) {
        case 'CRITICAL':
        case 'HIGH':
            return 'DANGER';
        case 'MEDIUM':
            return 'WARNING';
        case 'LOW':
        default:
            return 'SAFE';
    }
}

export function shouldShowHttpNotification(url) {
    const lastShown = httpNotificationCache.get(url);
    if (lastShown && (Date.now() - lastShown) < HTTP_NOTIFICATION_TTL) {
        return false;
    }
    httpNotificationCache.set(url, Date.now());
    return true;
}

export async function maybeShowHttpNotification(url, result, settings) {
    if (!settings.notificationsEnabled || !settings.notifyOnHttpWarning) return;
    if (!result || result.overallSeverity !== 'LOW') return;

    const httpCheck = result?.detections?.pattern?.checks?.nonHttps;
    if (!httpCheck?.flagged) return;
    if (!shouldShowHttpNotification(url)) return;

    try {
        await chrome.notifications.create({
            type: 'basic',
            iconUrl: chrome.runtime.getURL('icons/icon48.png'),
            title: '⚠️ Connection not secure',
            message: 'This page is using HTTP. Avoid entering passwords or payment information here.',
            priority: 0
        });
    } catch (error) {
        console.warn('[Scam Alert] Failed to show HTTP notification:', error);
    }
}

export async function getTintedIconImageData(state) {
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

        // Step 1: Draw original icon to preserve shape/detail
        ctx.drawImage(bitmap, 0, 0, size, size);

        // Step 2: Apply color tint using 'multiply' blend (preserves luminance)
        ctx.globalCompositeOperation = 'multiply';
        ctx.fillStyle = tint;
        ctx.fillRect(0, 0, size, size);

        // Step 3: Restore alpha channel from original icon ('destination-in')
        // This clips the result back to the original icon's non-transparent pixels
        ctx.globalCompositeOperation = 'destination-in';
        ctx.drawImage(bitmap, 0, 0, size, size);

        ctx.globalCompositeOperation = 'source-over';

        result[size] = ctx.getImageData(0, 0, size, size);
    }

    tintedIconCache.set(state, result);
    return result;
}

export function ignoreTabError(error) {
    if (error.message?.includes('No tab with id') ||
        error.message?.includes('closed') ||
        error.message?.includes('Tabs cannot be edited')) {
        return; // Expected race condition
    }
    console.warn('[Scam Alert] Tab action failed:', error);
}

export async function setActionIconForTab(tabId, severity) {
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
        ignoreTabError(error);
    }
}

export async function syncIconForTabFromCache(tabId, url, shouldScanUrl, tabStateManager = null) {
    try {
        if (!tabId || !url) return;
        if (!shouldScanUrl(url)) {
            await setActionIconForTab(tabId, null);
            try {
                await chrome.action.setBadgeText({ tabId, text: '' });
            } catch (error) { ignoreTabError(error); }
            return;
        }
        const cached = await getCachedScan(url);
        const severity = cached?.overallSeverity || 'SAFE';
        await setActionIconForTab(tabId, severity);

        // Sync state to manager if provided (BUG-059)
        if (tabStateManager && cached) {
            tabStateManager.updateTabState(tabId, {
                url,
                scanResults: cached,
                lastScanned: Date.now()
            });
        }

        // Sync badge color with multi-tier logic (BUG-038)
        const isAlert = severity !== 'SAFE' && severity !== 'LOW';
        if (isAlert) {
            const isDanger = severity === 'CRITICAL' || severity === 'HIGH';
            const badgeColor = isDanger ? '#DC2626' : '#f59e0b';
            try {
                await chrome.action.setBadgeText({ tabId, text: '!' });
                await chrome.action.setBadgeBackgroundColor({ tabId, color: badgeColor });
            } catch (error) { ignoreTabError(error); }
        } else {
            try {
                await chrome.action.setBadgeText({ tabId, text: '' });
            } catch (error) { ignoreTabError(error); }
        }
    } catch (error) {
        console.warn('[Scam Alert] Failed to sync action icon from cache:', error);
    }
}

export async function resetActionUIForTab(tabId) {
    try {
        await chrome.action.setBadgeText({ tabId, text: '' });
        await chrome.action.setBadgeBackgroundColor({ tabId, color: [0, 0, 0, 0] });
        await setActionIconForTab(tabId, null);
    } catch (error) {
        ignoreTabError(error);
    }
}
