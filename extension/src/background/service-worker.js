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

import { getSettings, updateSettings, getStats, updateStats, getCachedScan, cacheScan, isWhitelisted, addToWhitelist, getWhitelist, clearCache, isPro, repairStatistics, normalizeUrl, cacheGlobalSafeList } from '../lib/storage.js';
import { MessageTypes, createMessageHandler, sendMessageToTab, createMessage } from '../lib/messaging.js';
import { scanUrl } from '../lib/detector.js';
import { syncPatterns } from '../lib/database.js';
import { submitReport, submitUserReport, submitFalsePositive, fetchGlobalSafeList, submitSafeListAppeal, postEdgeFunction } from '../lib/supabase.js';
import { checkDomainReputation } from '../lib/domain-reputation.js';
import { syncManager } from './lib/sync-manager.js';

// Decentralized Modules (v19.2)
import { handleIncomingMessage } from './messages/handler.js';
import { onInstalled, onStartup } from './events/lifecycle.js';
import { checkProStatus } from './services/auth.js';
import { isKnownEmailClient } from '../config/email-clients.js';
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
        if (alarm.name === 'syncGlobalSafeList') {
            try {
                const list = await fetchGlobalSafeList();
                if (list.length > 0) {
                    await cacheGlobalSafeList(list);
                    console.log(`[Hydra Guard] Synced ${list.length} domains to Global Safe List`);
                }
            } catch (err) {
                console.error('[Hydra Guard] Failed to sync Global Safe List:', err);
            }
        }
    });
    chrome.alarms.create('syncScamPatterns', { periodInMinutes: 24 * 60 });
    chrome.alarms.create('syncBlocklist', { periodInMinutes: 24 * 60 });
    chrome.alarms.create('syncGlobalSafeList', { periodInMinutes: 12 * 60 }); // Sync every 12 hours
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
    let result = {
        overallSeverity: 'UNKNOWN',
        overallThreat: false,
        action: 'CHECK_INCOMPLETE',
        checks: {},
        signals: { hard: [], soft: [] },
        reasons: [{ code: 'SCAN_NOT_STARTED', message: 'Scan did not complete' }],
        metadata: {}
    };
    let broadcastSent = false;

    try {
        const settings = await getSettings();
        if (!settings.scanningEnabled) return;

        // BUG-142/144: For email clients, we must NEVER silent-abort at the URL gate.
        // Even if we don't have pageContent yet (e.g. initial navigation), we still want
        // to produce a result for the domain itself so the popup isn't stuck on 'empty'.
        const isEmailScan = !!scanOptions.pageContent?.isEmailView;
        const isEmailClient = isKnownEmailClient(url);
        
        console.log(`[Hydra Guard] scanAndHandle [Tab ${tabId}]: emailScan=${isEmailScan}, emailClient=${isEmailClient}`);

        if (!isEmailScan && !isEmailClient && await isWhitelisted(url)) {
            console.log(`[Hydra Guard] scanAndHandle [Tab ${tabId}]: Whitelist match (non-email) — skipping`);
            return;
        }

        if (scanOptions.pageContent?.senderEmail && await isWhitelisted(scanOptions.pageContent.senderEmail)) {
            console.log(`[Hydra Guard] scanAndHandle [Tab ${tabId}]: Sender whitelisted: ${scanOptions.pageContent.senderEmail}`);
            // BUG-143 Fix: Don't hang the UI on NO SCAN. Synthesize a SAFE result.
            const result = {
                overallSeverity: 'SAFE',
                overallThreat: false,
                confidence: 'CERTAIN',
                action: 'ALLOW',
                signals: { hard: [], soft: [] },
                reasons: [{ code: 'SENDER_WHITELIST', message: 'Sender is in your personal safe list' }],
                checks: {},
                metadata: { senderEmail: scanOptions.pageContent.senderEmail }
            };
            
            tabStateManager.updateTabState(tabId, { url, scanResults: result, lastScanned: Date.now(), scanInProgress: false });
            await cacheScan(url, result);
            await setActionIconForTab(tabId, 'SAFE');
            await chrome.action.setBadgeText({ tabId, text: '' });
            return;
        }

        const { forceRefresh = false } = scanOptions;
        
        // BUG-107 Fix: Salvage AI verification from existing cache to survive forced rescans
        let existingCache = null;
        try { existingCache = await getCachedScan(url); } catch { /* ignore */ }

        result = forceRefresh ? null : existingCache;

        if (!result) {
            const onProgress = (progress) => {
                try {
                    chrome.runtime.sendMessage(createMessage('scan_progress', progress), () => {
                        void chrome.runtime.lastError;
                    });
                } catch { /* Ignore */ }
            };

            let pageContent = scanOptions.pageContent || null;
            const isEmailUrl = isKnownEmailClient(url);
            const providedPageContent = scanOptions.pageContent;

            if (providedPageContent) {
                pageContent = providedPageContent;
            } else if (isEmailUrl) {
                try {
                    // Try to get context
                    let ctxResponse = await chrome.tabs.sendMessage(tabId, { type: 'GET_EMAIL_CONTEXT' }).catch(() => null);
                    
                    // BUG-148: If the extension was reloaded and the content script was orphaned, inject it on demand.
                    if (!ctxResponse) {
                        console.warn('[Hydra Guard] Content script unresponsive. Attempting on-demand injection...');
                        try {
                            await chrome.scripting.executeScript({
                                target: { tabId },
                                files: ['dist/assets/emailScanner.js']
                            });
                            // Poll up to 3× (450ms max) — the injected script is async,
                            // so we exit as soon as the listener is registered rather than
                            // relying on a fixed sleep that can race on slow tabs.
                            for (let attempt = 0; attempt < 3 && !ctxResponse; attempt++) {
                                await new Promise(r => setTimeout(r, 150));
                                ctxResponse = await chrome.tabs.sendMessage(tabId, { type: 'GET_EMAIL_CONTEXT' }).catch(() => null);
                            }
                        } catch (injErr) {
                            console.warn('[Hydra Guard] On-demand injection failed:', injErr);
                        }
                    }

                    if (ctxResponse && ctxResponse.success) {
                        pageContent = ctxResponse.context;
                        
                        // Pass along explicit extraction failure state (BUG-131)
                        if (ctxResponse.extractionFailed) {
                            pageContent.extractionFailed = true;
                        }
                    }
                } catch (err) {
                    console.warn('[Hydra Guard] Page signal collection failed:', err.message);
                }
            } else if (!pageContent && settings.collectPageSignals) {
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

            if (pageContent?.senderName && pageContent?.senderEmail) {
                metadata.sender = `${pageContent.senderName} <${pageContent.senderEmail}>`;
            } else if (pageContent?.senderName) {
                metadata.sender = pageContent.senderName;
            } else if (pageContent?.senderEmail) {
                metadata.sender = pageContent.senderEmail;
            }

            // BUG-131: Handle explicit extraction failure from email scanner
            if (pageContent?.extractionFailed) {
                result = {
                    overallSeverity: 'UNKNOWN',
                    overallThreat: false,
                    action: 'CHECK_INCOMPLETE', // Custom action for degraded state
                    checks: {},
                    signals: { hard: [], soft: [] },
                    metadata: { ...metadata, error: 'Email content extraction failed or timed out' }
                };
            } else {
                result = await scanUrl(url, { ...settings, ...scanOptions, pageContent, isPro: isProUser, metadata }, onProgress);
                
                // BUG-107 Fix: Re-inject the salvaged AI verification back into the fresh scan result
                if (existingCache?.aiVerification) {
                    result.aiVerification = existingCache.aiVerification;
                }

                // BUG-145: Empty Payload Safeguard
                // If the DOM was loaded but the extractors failed to find text, links, or a sender,
                // the engine will default to SAFE (True Negative logic). We must escalate to UNKNOWN
                // so the user receives a warning badge rather than a false sense of security.
                if (
                    pageContent &&
                    pageContent.isEmailView &&
                    result.overallThreat === false &&
                    result.overallSeverity === 'SAFE'
                ) {
                    const hasExtractedData = (pageContent.bodyText || '').length > 5 || 
                                             (pageContent.rawUrls || []).length > 0 ||
                                             (pageContent.senderEmail) ||
                                             (pageContent.senderName && pageContent.senderName !== 'Unknown');
                    
                    if (!hasExtractedData) {
                        console.warn('[Hydra Guard] scanAndHandle: Empty Payload Safeguard triggered. Escalating to UNKNOWN.');
                        result.overallSeverity = 'UNKNOWN';
                        result.action = 'CHECK_INCOMPLETE';
                        result.metadata = result.metadata || {};
                        result.metadata.error = 'Email content obscured (potential image/SVG evasion) — manual caution advised';
                    }
                }

                // Transparency: Store extracted content metadata so DevPanel can show what was actually scanned.
                // Without this, a "0 checks" result looks identical to "scan ran but found nothing."
                if (pageContent) {
                    result.metadata = result.metadata || {};
                    if (pageContent.bodyText) {
                        result.metadata.bodySnippet = pageContent.bodyText.substring(0, 200);
                    }
                    result.metadata.linkCount = (pageContent.rawUrls || pageContent.links || []).length;
                    if (pageContent.senderEmail && !result.metadata.senderEmail) {
                        result.metadata.senderEmail = pageContent.senderEmail;
                    }
                }
            }
            
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

        const isAlert = result.overallThreat || result.overallSeverity === 'CRITICAL' || result.overallSeverity === 'HIGH' || result.overallSeverity === 'MEDIUM';
        if (isAlert) {
            await handleThreat(tabId, url, result, settings);
        } else if (result.overallSeverity === 'UNKNOWN') {
            // BUG-131: Amber '?' badge for incomplete scans (extraction failure)
            try {
                await chrome.action.setBadgeText({ tabId, text: '?' });
                await chrome.action.setBadgeBackgroundColor({ tabId, color: '#f59e0b' });
            } catch (error) { ignoreTabError(error); }

            // BUG-132: Fire proactive OS notification when extraction fails
            if (settings.notificationsEnabled) {
                chrome.notifications.create({
                    type: 'basic',
                    iconUrl: chrome.runtime.getURL('icons/icon48.png'),
                    title: '⚠️ Hydra Guard: Scan Incomplete',
                    message: "Couldn't read this email's content. Click the extension icon to retry.",
                    priority: 1
                });
            }
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
            lastScanned: Date.now(),
            scanInProgress: false
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
            broadcastSent = true;
        } catch (error) {
            // Popup might not be open, not critical
        }

    } catch (error) {
        console.error('[Hydra Guard] Critical Scan Error:', error);
        
        if (scanOptions.pageContent?.isEmailView || isKnownEmailClient(url)) {
            result.metadata.error = 'Email scan encountered an internal error — retry recommended';
            result.metadata.reason = 'EXTRACTION_ERROR';
        } else {
            result.metadata.error = 'Scan error: ' + (error.message || 'Unknown');
        }

        try {
            const domain = (url && typeof url === 'string') ? new URL(url).hostname : 'unknown';
            await updateStats({
                scan: true, threat: false,
                activity: { domain, action: 'error', time: Date.now(), severity: 'UNKNOWN', metadata: { error: error.message } }
            });
        } catch (statsError) { /* Ignore */ }
    } finally {
        tabStateManager.updateTabState(tabId, { scanResults: result, scanInProgress: false, lastScanned: Date.now() });

        if (!broadcastSent) {
            try {
                chrome.runtime.sendMessage(createMessage(MessageTypes.SCAN_RESULT_UPDATED, { result }), () => {
                    void chrome.runtime.lastError; // suppresses "no listener" when popup is closed
                });
            } catch { /* popup closed or detached */ }
        }
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

// BUG-133: Listen for SPA navigations (hash changes) in email clients
chrome.webNavigation.onHistoryStateUpdated.addListener(async (details) => {
    if (details.frameId !== 0) return;
    
    if (isKnownEmailClient(details.url)) {
        console.log(`[Hydra Guard] SPA Navigation detected on tab ${details.tabId}: ${details.url}`);
        try {
            // Immediate: Clear stale badge state to prevent flickers
            await chrome.action.setBadgeText({ tabId: details.tabId, text: '' });
            await chrome.action.setBadgeBackgroundColor({ tabId: details.tabId, color: [0, 0, 0, 0] });
        } catch (e) { /* ignore */ }
        
        try {
            await chrome.tabs.sendMessage(details.tabId, { type: 'RETRIGGER_SCAN' });
        } catch (e) {
            console.warn('[Hydra Guard] Failed to send RETRIGGER_SCAN to tab:', e);
        }
    }
});

// Passive injection for self-hosted or unknown-domain email clients (e.g., Roundcube)
// because manifest.json `matches` can't statically cover arbitrary domains.
chrome.webNavigation.onCompleted.addListener(async (details) => {
    if (details.frameId !== 0) return;
    
    if (isKnownEmailClient(details.url)) {
        try {
            await chrome.scripting.executeScript({
                target: { tabId: details.tabId },
                files: ['dist/assets/emailScanner.js']
            });
            console.log(`[Hydra Guard] Passively injected emailScanner into known email client: ${details.url}`);
        } catch (e) {
            // Can fail if user navigates away extremely fast or if host permissions are missing
            console.warn('[Hydra Guard] Failed to passively inject emailScanner:', e);
        }
        return; // CRITICAL: Stop here to avoid domain polling on email clients (Critic Finding 1)
    }

    // Phase 3: Domain Reputation Background Check
    try {
        const repData = await checkDomainReputation(details.url, {
            getSettings,
            isWhitelisted,
            postEdgeFunction
        });

        if (repData) {
            tabStateManager.updateTabState(details.tabId, {
                domainReputation: repData,
                url: details.url
            });
        }
    } catch (err) {
        console.warn('[Hydra Guard] Domain reputation check failed:', err);
    }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    try {
        const context = {
            scanAndHandle,
            getSettings,
            getStats,
            updateSettings,
            getCachedScan,
            isWhitelisted,
            addToWhitelist,
            getWhitelist,
            repairStatistics,
            submitReport,
            submitUserReport,
            submitFalsePositive,
            submitSafeListAppeal,
            tabStateManager,
            cacheScan
        };
        handleIncomingMessage(message, sender, context)
            .then(sendResponse)
            .catch(err => {
                console.error(`[Hydra Guard] Fatal message error (${message?.type || 'unknown'}):`, err);
                sendResponse({ success: false, error: err.message || 'Internal extension error' });
            });
    } catch (syncErr) {
        console.error(`[Hydra Guard] Sync message listener error (${message?.type || 'unknown'}):`, syncErr);
        sendResponse({ success: false, error: syncErr.message || 'Extension initialization error' });
    }
    return true; // Keep channel open for async
});

console.log('[Hydra Guard] Service worker ready');
