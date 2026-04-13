/**
 * Email Scanner Orchestrator (v19.2 Modularized)
 * 
 * Coordinates specialized modules to protect Gmail and Outlook users.
 */

import { MessageTypes } from '../lib/messaging.js';
import { getEmailSettings, shouldShowPrompt, isEmailReadingViewForClient } from './email/extraction-logic.js';
import { getMatchingClient } from '../config/email-clients.js';
import { showActivationPrompt } from './email/activation-prompt.js';
import { showThreatDashboard } from './email/dashboard.js';
import { setupEmailObserver } from './email/mutation-observer.js';
import { highlightDetections } from './highlighter.js';
import { extractEmailLinks, extractHiddenHeaders } from '../lib/scanner/parser.js';
import { extractEmailData } from './email/extraction-logic.js';
import { runHeuristics } from '../lib/scanner/heuristics.js';
import { setupLinkInterceptor } from './email/link-interceptor.js';

(function () {
    // BUG-144 + BUG-148 + BUG-160: Prevent double-execution but allow re-initialization
    // after extension reload/update. Version-only guard is not enough: after a reload,
    // an orphaned script (chrome.runtime.id = undefined) keeps the guard flag set but
    // can no longer handle messages. The new injection would see the same version and
    // exit early, leaving the tab with zero functional listeners.
    // Fix: If a guard is set but the runtime is no longer live, clear it first.
    const currentVersion = chrome.runtime?.getManifest?.()?.version || 'unknown';
    const isAlreadyLoaded = window.__hydraGuardEmailScannerLoaded === currentVersion;
    if (isAlreadyLoaded) {
        // The guard is set for this version. Check if the existing instance is still
        // connected to the extension runtime. chrome.runtime.id is undefined in orphaned scripts.
        const existingInstanceAlive = !!(chrome.runtime?.id);
        if (existingInstanceAlive) {
            // A live, same-version instance is running — do not double-initialize.
            console.log('[Hydra Guard] emailScanner already live at v' + currentVersion + '. Skipping re-init.');
            return;
        }
        // Orphaned instance detected — clear the guard so this fresh injection can take over.
        console.log('[Hydra Guard] Orphaned emailScanner detected (runtime.id missing). Clearing guard and re-initializing.');
    }
    window.__hydraGuardEmailScannerLoaded = currentVersion;

    let currentEmailId = null;

    // BUG-085: Track the last scan result signature to prevent redundant dashboard re-renders.
    let lastDashboardSignature = null;

    // BUG-085b: Track whether the user actively dismissed the dashboard.
    // Once dismissed, we suppress re-rendering until the email content changes
    // (i.e. the user navigates to a different email).
    let dashboardDismissed = false;
    let dismissedForSignature = null;

    function getScanSignature(result) {
        const severity = result.overallSeverity || 'SAFE';
        const flaggedKeys = Object.entries(result.checks || {})
            .filter(([, v]) => v.flagged)
            .map(([k]) => k)
            .sort()
            .join(',');
        return `${severity}|${flaggedKeys}`;
    }

    /**
     * Called by the dashboard when the user clicks X or the backdrop.
     * Sets a suppression flag so we don't immediately re-show it.
     */
    function handleDashboardDismiss() {
        dashboardDismissed = true;
        dismissedForSignature = lastDashboardSignature;
        console.log('[Hydra Guard] Dashboard dismissed by user — suppressing until email changes');
    }

    /**
     * Main Trigger Logic
     */
    // BUG-127 & BUG-131: Retry state for lazy-loaded Gmail spam/search views
    let extractionRetryCount = 0;
    const MAX_EXTRACTION_RETRIES = 8;
    let retryTimer = null;

    async function triggerScan() {
        if (!chrome.runtime?.id) return;

        // BUG-145: Concurrency guard. If another trigger fires, cancel the pending retry.
        if (retryTimer) {
            clearTimeout(retryTimer);
            retryTimer = null;
        }

        const settings = await getEmailSettings();

        if (!settings.enabled) {
            if (await shouldShowPrompt(settings)) {
                showActivationPrompt(triggerScan);
            }
            return;
        }

        // BUG-140: Extract ALL signals first, before the body-empty retry gate.
        let data = '', senderInfo = { name: '', email: '' }, subject = '', headers = {}, linkData = { links: [], rawUrls: [] };
        try {
            const extracted = extractEmailData();
            data        = extracted.bodyText || '';
            senderInfo  = { name: extracted.senderName || '', email: extracted.senderEmail || '' };
            subject     = extracted.subject || '';
            
            headers     = extractHiddenHeaders() || {};
            linkData    = extractEmailLinks()    || { links: [], rawUrls: [] };
        } catch (extractErr) {
            console.warn('[Hydra Guard] Extractor error in triggerScan:', extractErr);
        }

        // We demand at least 20 chars of real text, or wait up to 5 seconds for the SPA to render.
        // BUG-145: Sender must be an actual email (contain @) to count as loaded, preventing premature fallback triggers.
        const isLoaded = data.length > 20 || linkData.rawUrls.length > 0 || (senderInfo.email && senderInfo.email.includes('@'));

        if (!isLoaded) {
            if (extractionRetryCount < MAX_EXTRACTION_RETRIES) {
                extractionRetryCount++;
                const delay = 1000; // 1s debounce — gives complex emails more render time
                console.log(`[Hydra Guard] Email SPA transitioning — retry ${extractionRetryCount}/${MAX_EXTRACTION_RETRIES} in ${delay}ms`);
                if (retryTimer) clearTimeout(retryTimer);
                retryTimer = setTimeout(() => triggerScan(), delay);
                return;
            } else {
                // BUG-148: After exhaustion, if we have ZERO useful data, we MUST push the payload anyway.
                // A silent abort leaves the background SW hanging in scanning state, which when suspended
                // results in a persistent UI 'NO SCAN' bug. The backend's Empty Payload Safeguard catches
                // this safely and sets status to UNKNOWN instead of SAFE.
                const hasAnyData = data.length > 0 || senderInfo.email || linkData.rawUrls.length > 0;
                if (!hasAnyData) {
                    console.warn('[Hydra Guard] Extraction exhausted with zero useful data — pushing empty payload to resolve UI state.');
                } else {
                    console.warn('[Hydra Guard] SPA delay exhausted — pushing partial payload.');
                }
            }
        }

        // Reset retry counter on success or exhaustion
        extractionRetryCount = 0;
        if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; }

        console.log('[Hydra Guard] Intentional scan triggered...');
        console.log('[Hydra Guard] Sender:', senderInfo.name, senderInfo.email);
        console.log('[Hydra Guard] Subject:', subject);
        console.log('[Hydra Guard] Body length:', data.length);
        console.log('[Hydra Guard] Links found:', linkData.rawUrls.length);

        chrome.runtime.sendMessage({
            type: MessageTypes.SCAN_CURRENT_TAB,
            data: {
                forceRefresh: true,
                pageContent: {
                    bodyText: data,
                    isEmailView: true,
                    senderName: senderInfo.name,
                    senderEmail: senderInfo.email,
                    subject,
                    headers,
                    links: linkData.links,
                    rawUrls: linkData.rawUrls
                }
            }
        }, (response) => {
            if (chrome.runtime.lastError) {
                console.warn('[Hydra Guard] SCAN_CURRENT_TAB failed:', chrome.runtime.lastError.message, '— retrying once in 1s');
                // BUG-153: Single retry after 1s — gives the SW time to wake up
                setTimeout(() => {
                    if (!chrome.runtime?.id) return;
                    chrome.runtime.sendMessage({
                        type: MessageTypes.SCAN_CURRENT_TAB,
                        data: {
                            forceRefresh: true,
                            pageContent: {
                                bodyText: data,
                                isEmailView: true,
                                senderName: senderInfo.name,
                                senderEmail: senderInfo.email,
                                subject,
                                headers,
                                links: linkData.links,
                                rawUrls: linkData.rawUrls
                            }
                        }
                    }, (retryResponse) => {
                        if (chrome.runtime.lastError) {
                            console.error('[Hydra Guard] SCAN_CURRENT_TAB retry also failed:', chrome.runtime.lastError.message);
                        } else {
                            console.log('[Hydra Guard] SCAN_CURRENT_TAB retry succeeded');
                        }
                    });
                }, 1000);
            }
        });
    }

    // BUG-132: Determines if an email reading view is currently active.
    // Declared here (above setupEmailObserver) so the reference is valid
    // when passed as a guard callback to the MutationObserver. (BUG-NEW)
    function isEmailReadingView() {
        // Now provider-agnostic via centralized config
        const client = getMatchingClient(location.href, document.title);
        return isEmailReadingViewForClient(client);
    }

    // Initialize DOM Observer
    // BUG-NEW: Pass isEmailReadingView so the observer only calls triggerScan
    // when the user actually has an email open — not when browsing the inbox list.
    setupEmailObserver(triggerScan, isEmailReadingView);


    // BUG-127 & BUG-132: Fire an initial scan after a short delay.
    // The mutation observer only catches *future* DOM changes.
    // If the email is already rendered when the script loads (e.g. direct
    // navigation to a spam email), the observer never fires.
    setTimeout(() => {
        console.log(`[Hydra Guard] 1.5s post-load check. Hash: "${location.hash}", Path: "${location.pathname}"`);
        if (!isEmailReadingView()) {
            console.log('[Hydra Guard] Inbox list view detected — deferring scan to mutation observer');
            return;
        }
        console.log('[Hydra Guard] Initial scan trigger (1.5s post-load)');
        triggerScan();
    }, 1500);

    // BUG-133: Watch for SPA navigation changes inside Gmail
    let lastUrl = location.href;
    setInterval(() => {
        if (location.href !== lastUrl) {
            lastUrl = location.href;
            console.log('[Hydra Guard] SPA Navigation detected in content script');
            extractionRetryCount = 0; // Reset on navigation
            if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; }
            // Delay 500ms for Gmail to render the email DOM
            setTimeout(() => {
                if (isEmailReadingView()) triggerScan();
            }, 500);
        }
    }, 500);

    // BUG-144: Unified Message Listener (Consolidated for reliability)
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (!chrome.runtime?.id) return;
        const type = message.type || message.action;

        switch (type) {
            case 'RETRIGGER_SCAN':
                console.log('[Hydra Guard] Received RETRIGGER_SCAN from background');
                extractionRetryCount = 0;
                if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; }
                setTimeout(() => {
                    if (isEmailReadingView()) triggerScan();
                }, 500);
                sendResponse({ success: true });
                return true;

            case 'GET_EMAIL_CONTEXT':
                try {
                    const extracted = extractEmailData();
                    const data = extracted.bodyText || '';
                    const bodyReady = data.length > 50;
                    const senderInfo = { name: extracted.senderName || '', email: extracted.senderEmail || '' };
                    const subject = extracted.subject || '';
                    
                    const linkData = extractEmailLinks() || { links: [] };
                    const headers = extractHiddenHeaders() || {};

                    sendResponse({
                        success: true,
                        bodyReady,
                        context: {
                            isEmailView: true,
                            bodyText: data,
                            senderName: senderInfo.name || '',
                            senderEmail: senderInfo.email || '',
                            subject: subject,
                            headers: headers,
                            snippet: data.substring(0, 500),
                            links: linkData.links,
                            rawUrls: linkData.rawUrls,
                            embeddedLinks: linkData.links.map(l => l.href)
                        }
                    });
                } catch (error) {
                    console.error('[Hydra Guard] Error extracting email context:', error);
                    sendResponse({ success: false, bodyReady: false, error: error.message });
                }
                return true;

            case MessageTypes.SCAN_RESULT:
            case MessageTypes.SCAN_RESULT_UPDATED:
            case MessageTypes.SHOW_WARNING: // BUG-151: Background sends SHOW_WARNING for HIGH/CRITICAL
                if (message.data?.result) {
                    const result = message.data.result;
                    if (result.overallThreat || result.overallSeverity !== 'SAFE') {
                        const sig = getScanSignature(result);

                        // BUG-085: Skip if identical result is already displayed
                        if (sig === lastDashboardSignature && document.getElementById('hydra-guard-threat-dashboard')) {
                            console.log('[Hydra Guard] Skipping redundant dashboard render (same result)');
                            return;
                        }

                        // BUG-085b: Skip if user dismissed the dashboard for this same result.
                        if (dashboardDismissed && sig === dismissedForSignature) {
                            console.log('[Hydra Guard] Skipping dashboard — user dismissed for this result');
                            try { highlightDetections(result); } catch (e) { /* ignore */ }
                            return;
                        }

                        // New/different result — clear dismissal state and show
                        if (sig !== dismissedForSignature) {
                            dashboardDismissed = false;
                            dismissedForSignature = null;
                        }

                        try {
                            highlightDetections(result);
                            showThreatDashboard(result, { onDismiss: handleDashboardDismiss });
                            lastDashboardSignature = sig;
                        } catch (e) {
                            console.error('[Hydra Guard] UI Orchestration failed:', e);
                        }
                    } else {
                        // Result is SAFE — clear all state so dashboard can appear for new threats
                        lastDashboardSignature = null;
                        dashboardDismissed = false;
                        dismissedForSignature = null;
                    }
                }
                break;
        }
    });

    // Initialize Link Interceptor
    setupLinkInterceptor((href) => {
        chrome.runtime.sendMessage({
            type: MessageTypes.SHOW_WARNING,
            data: {
                result: {
                    recommendations: ['You clicked a download link or cloud document in your webmail. This is a common vector for phishing and malware.'],
                    overallSeverity: 'HIGH',
                    url: href
                }
            }
        });
    });

    console.log('[Hydra Guard] Email scanner orchestrator active');
})();
