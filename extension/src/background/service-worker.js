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

import { getSettings, updateSettings, getStats, updateStats, getCachedScan, cacheScan, isWhitelisted, addToWhitelist, getWhitelist, clearCache, isPro, repairStatistics, normalizeUrl } from '../lib/storage.js';
import { MessageTypes, createMessageHandler, sendMessageToTab, createMessage } from '../lib/messaging.js';
import { scanUrl } from '../lib/detector.js';
import { downloadPhishTankDatabase } from '../lib/phishtank.js';
import { syncPatterns } from '../lib/database.js';
import { submitReport, submitFalsePositive } from '../lib/supabase.js';
import { syncManager } from './lib/sync-manager.js';

// Decentralized Modules (v19.2)
import { handleIncomingMessage } from './messages/handler.js';
import { onInstalled, onStartup } from './events/lifecycle.js';
import { checkProStatus } from './services/auth.js';
import { maybeShowHttpNotification, setActionIconForTab, syncIconForTabFromCache, ignoreTabError, resetActionUIForTab } from './lib/icon-manager.js';
import { createNavigationHandler } from './lib/navigation-handler.js';
import { tabStateManager } from '../lib/tab-state-manager.js';

console.log('[Hydra Guard] Service worker v1.0.59 initializing (Hydra Hub)...');

// ============================================================================
// Installation & Updates
// ============================================================================

chrome.runtime.onInstalled.addListener((details) => onInstalled(details, scanActiveTabs));
chrome.runtime.onStartup.addListener(onStartup);

// ============================================================================
// Periodic Tasks
// ============================================================================

if (typeof chrome.alarms !== 'undefined') {
    chrome.alarms.onAlarm.addListener(async (alarm) => {
        if (alarm.name === 'syncScamPatterns') await syncPatterns();
        if (alarm.name === 'syncBlocklist') await syncManager.sync();
    });
    chrome.alarms.create('syncScamPatterns', { periodInMinutes: 24 * 60 });
    chrome.alarms.create('syncBlocklist', { periodInMinutes: 24 * 60 });
}

// ============================================================================
// URL Scanning
// ============================================================================

function shouldScanUrl(url) {
    try {
        const urlObj = new URL(url);
        if (['chrome:', 'chrome-extension:', 'about:'].includes(urlObj.protocol)) return false;
        if (['localhost', '127.0.0.1'].includes(urlObj.hostname)) return false;
        return true;
    } catch { return false; }
}

async function scanAndHandle(tabId, url, scanOptions = {}) {
    try {
        const settings = await getSettings();
        if (!settings.scanningEnabled) return;
        if (await isWhitelisted(url)) return;

        if (scanOptions.pageContent?.senderEmail && await isWhitelisted(scanOptions.pageContent.senderEmail)) {
            return;
        }

        const { forceRefresh = false } = scanOptions;
        let result = forceRefresh ? null : await getCachedScan(url);

        if (!result) {
            const onProgress = (progress) => {
                try {
                    chrome.runtime.sendMessage(createMessage('scan_progress', progress), () => {
                        void chrome.runtime.lastError;
                    });
                } catch { /* Ignore */ }
            };

            let pageContent = scanOptions.pageContent || null;
            if (!pageContent && settings.collectPageSignals) {
                try {
                    const response = await sendMessageToTab(tabId, createMessage(MessageTypes.ANALYZE_PAGE, {}));
                    if (response?.data) pageContent = response.data;
                } catch (err) {
                    console.warn('[Hydra Guard] Page signal collection failed:', err.message);
                }
            }

            let isProUser = false;
            try { isProUser = await isPro(); } catch (err) { /* fallback */ }

            const metadata = {};
            if (pageContent?.subject) metadata.subject = pageContent.subject;
            if (pageContent?.senderName) metadata.sender = pageContent.senderName;
            if (pageContent?.senderEmail && !metadata.sender) metadata.sender = pageContent.senderEmail;

            result = await scanUrl(url, { ...settings, ...scanOptions, pageContent, isPro: isProUser, metadata }, onProgress);
            await cacheScan(url, result);
        }

        await updateStats({
            scan: true,
            threat: result.overallThreat,
            activity: {
                domain: normalizeUrl(url),
                action: result.overallThreat ? 'blocked' : 'scanned',
                time: Date.now(),
                severity: result.overallSeverity,
                performedChecks: {
                    ...(result.checks || {}),
                    ...Object.entries(result.detections || {}).reduce((acc, [key, val]) => {
                        if (key !== 'pattern' && val?.title) acc[key] = val;
                        return acc;
                    }, {})
                },
                indicators: result.report?.indicators || [],
                metadata: result.metadata || {}
            }
        });

        const isAlert = result.overallThreat || (result.overallSeverity !== 'SAFE' && result.overallSeverity !== 'LOW');
        if (isAlert) {
            await handleThreat(tabId, url, result, settings);
        } else {
            try {
                // Ensure the badge is truly wiped for SAFE sites
                await chrome.action.setBadgeText({ tabId, text: '' });
                await chrome.action.setBadgeBackgroundColor({ tabId, color: [0, 0, 0, 0] });
            } catch (error) { ignoreTabError(error); }

            await maybeShowHttpNotification(url, result, settings);
        }
        await setActionIconForTab(tabId, result.overallSeverity);

        // BUG-057 Fix: Sync scan results to tab state manager
        // This ensures the popup (which reads from tabStateManager) and badge (which reads from cache)
        // are always in sync
        tabStateManager.updateTabState(tabId, {
            url,
            scanResults: result,
            lastScanned: Date.now()
        });

        // Layer 2: Broadcast scan result to tab for Moment of Action interception
        try {
            await sendMessageToTab(tabId, createMessage(MessageTypes.SCAN_RESULT_UPDATED, { result }));
        } catch (error) {
            // Tab might be closed or inactive, not critical
        }

        // Layer 3: Broadcast to extension popup (if open) so DevPanel updates live
        try {
            chrome.runtime.sendMessage(createMessage(MessageTypes.SCAN_RESULT_UPDATED, { result }), () => {
                void chrome.runtime.lastError; // Suppress "no listener" error when popup is closed
            });
        } catch (error) {
            // Popup might not be open, not critical
        }

    } catch (error) {
        console.error('[Hydra Guard] Critical Scan Error:', error);
        try {
            const domain = (url && typeof url === 'string') ? new URL(url).hostname : 'unknown';
            await updateStats({
                scan: true, threat: false,
                activity: { domain, action: 'error', time: Date.now(), severity: 'UNKNOWN', metadata: { error: error.message } }
            });
        } catch (statsError) { /* Ignore */ }
    }
}

async function scanActiveTabs() {
    try {
        const tabs = await chrome.tabs.query({ active: true });
        for (const tab of tabs) {
            if (tab.url && shouldScanUrl(tab.url)) {
                scanAndHandle(tab.id, tab.url).catch(err => console.error(`[Hydra Guard] Failed to auto-scan tab ${tab.id}:`, err));
            }
        }
    } catch (error) {
        console.error('[Hydra Guard] startup scan sweep failed:', error);
    }
}

async function handleThreat(tabId, url, result, settings) {
    const severity = result.overallSeverity;
    const action = result.action;
    const isDanger = severity === 'CRITICAL' || severity === 'HIGH';
    const badgeColor = isDanger ? '#DC2626' : '#f59e0b';

    try {
        await chrome.action.setBadgeText({ tabId, text: '!' });
        await chrome.action.setBadgeBackgroundColor({ tabId, color: badgeColor });
    } catch (error) { ignoreTabError(error); }

    if (settings.notificationsEnabled && severity === 'CRITICAL') {
        chrome.notifications.create({
            type: 'basic',
            iconUrl: chrome.runtime.getURL('icons/icon48.png'),
            title: '⚠️ SCAM WARNING',
            message: result.recommendations?.[0] || 'Dangerous website detected!',
            priority: 2,
            requireInteraction: true
        });
    }

    // Layer 4: Action-based UI Dispatch
    let type = null;
    if (action === 'WARN_OVERLAY') {
        type = MessageTypes.SHOW_WARNING;
    } else if (action === 'WARN_POPUP') {
        type = MessageTypes.SHOW_BANNER;
    }

    if (type) {
        try { await sendMessageToTab(tabId, createMessage(type, { result })); }
        catch (error) { console.warn(`[Hydra Guard] Tab ${tabId} not ready for ${type}`); }
    }
}

// ============================================================================
// Listeners
// ============================================================================

chrome.webNavigation.onBeforeNavigate.addListener(createNavigationHandler({
    shouldScanUrl,
    scanAndHandle,
    syncIconForTabFromCache,
    tabStateManager,
    resetActionUIForTab
}));

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const context = {
        scanAndHandle,
        getStats,
        updateSettings,
        getCachedScan,
        isWhitelisted,
        addToWhitelist,
        getWhitelist,
        repairStatistics,
        submitReport,
        submitFalsePositive,
        tabStateManager
    };
    handleIncomingMessage(message, sender, context).then(sendResponse);
    return true; // Keep channel open for async
});

console.log('[Hydra Guard] Service worker ready');
