/**
 * Email Scanner Orchestrator (v19.2 Modularized)
 * 
 * Coordinates specialized modules to protect Gmail and Outlook users.
 */

import { MessageTypes } from '../lib/messaging.js';
import { getEmailSettings, shouldShowPrompt } from './email/extraction-logic.js';
import { showActivationPrompt } from './email/activation-prompt.js';
import { showThreatDashboard } from './email/dashboard.js';
import { setupEmailObserver } from './email/mutation-observer.js';
import { highlightDetections } from './highlighter.js';
import { extractEmailText, parseSenderInfo, extractEmailLinks, extractSubject, extractHiddenHeaders } from '../lib/scanner/parser.js';
import { runHeuristics } from '../lib/scanner/heuristics.js';
import { setupLinkInterceptor } from './email/link-interceptor.js';

(function () {
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
    const MAX_EXTRACTION_RETRIES = 5;
    let retryTimer = null;

    async function triggerScan() {
        if (!chrome.runtime?.id) return;

        const settings = await getEmailSettings();

        if (!settings.enabled) {
            if (await shouldShowPrompt(settings)) {
                showActivationPrompt(triggerScan);
            }
            return;
        }

        const data = extractEmailText();
        if (!data) {
            // BUG-127 & BUG-131: Gmail spam/search views lazy-load content.
            // Retry with exponential backoff up to MAX_EXTRACTION_RETRIES times.
            if (extractionRetryCount < MAX_EXTRACTION_RETRIES) {
                extractionRetryCount++;
                const delay = Math.pow(2, extractionRetryCount - 1) * 500; // 500ms, 1s, 2s, 4s, 8s
                console.log(`[Hydra Guard] Body empty — retry ${extractionRetryCount}/${MAX_EXTRACTION_RETRIES} in ${delay}ms`);
                if (retryTimer) clearTimeout(retryTimer);
                retryTimer = setTimeout(() => triggerScan(), delay);
            } else {
                console.warn('[Hydra Guard] Body empty after all retries — signaling extraction failure.');
                extractionRetryCount = 0; // Re-arm for future DOM mutations

                chrome.runtime.sendMessage({
                    type: MessageTypes.SCAN_CURRENT_TAB,
                    data: {
                        forceRefresh: true,
                        pageContent: {
                            extractionFailed: true,
                            isEmailView: true
                        }
                    }
                });
            }
            return;
        }

        // Reset retry counter on successful extraction
        extractionRetryCount = 0;
        if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; }

        const senderInfo = parseSenderInfo();
        const linkData = extractEmailLinks();
        const subject = extractSubject();
        const headers = extractHiddenHeaders();

        console.log('[Hydra Guard] Intentional scan triggered...');
        console.log('[Hydra Guard] Sender:', senderInfo.name, senderInfo.email);
        console.log('[Hydra Guard] Subject:', subject);
        console.log('[Hydra Guard] Headers:', headers);
        console.log('[Hydra Guard] Links found:', linkData.rawUrls.length);
        console.log('[Hydra Guard] Body length:', data.length);

        chrome.runtime.sendMessage({
            type: MessageTypes.SCAN_CURRENT_TAB,
            data: {
                forceRefresh: true,
                pageContent: {
                    bodyText: data,
                    isEmailView: true,
                    senderName: senderInfo.name,
                    senderEmail: senderInfo.email,
                    subject: subject,
                    headers: headers,
                    links: linkData.links,
                    rawUrls: linkData.rawUrls
                }
            }
        });
    }

    // Initialize DOM Observer
    setupEmailObserver(triggerScan);

    // BUG-132: Check if we appear to be in an email "reading" view
    // before firing the initial scan, otherwise the premature scan exhausts
    // all retries against the inbox list.
    function isEmailReadingView() {
        return !!(
            document.querySelector('.hP') ||          // Gmail: subject line
            document.querySelector('[data-message-id]') || // Gmail: message container
            document.querySelector('.a3s') ||         // Gmail: Email body
            document.querySelector('[data-testid="message-view-body"]') || // Outlook
            document.querySelector('.msg-body') ||    // Yahoo
            document.querySelector('.zmMailBody') ||  // Zoho
            document.querySelector('#messagecontframe') // Roundcube
        );
    }

    // BUG-127 & BUG-132: Fire an initial scan after a short delay.
    // The mutation observer only catches *future* DOM changes.
    // If the email is already rendered when the script loads (e.g. direct
    // navigation to a spam email), the observer never fires.
    setTimeout(() => {
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

    // BUG-133: Listen for explicit background triggers
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.type === 'RETRIGGER_SCAN' || message.type === 'GET_EMAIL_CONTEXT') {
            if (message.type === 'RETRIGGER_SCAN') {
                console.log('[Hydra Guard] Received RETRIGGER_SCAN from background');
                extractionRetryCount = 0;
                if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; }
                setTimeout(() => {
                    if (isEmailReadingView()) triggerScan();
                }, 500);
                sendResponse({ success: true });
                return true;
            }
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

    // Global Message Listener for Scan Results
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (!chrome.runtime?.id) return;

        const type = message.type || message.action;

        // NEW: Popup AI Context Fetcher
        if (type === 'GET_EMAIL_CONTEXT') {
            try {
                const data = extractEmailText() || '';
                const senderInfo = parseSenderInfo() || { name: '', email: '' };
                const subject = extractSubject() || '';
                const linkData = extractEmailLinks() || { links: [] };
                const headers = extractHiddenHeaders() || {};

                sendResponse({
                    success: true,
                    context: {
                        senderName: senderInfo.name || '',
                        senderEmail: senderInfo.email || '',
                        subject: subject,
                        headers: headers,
                        snippet: data.substring(0, 500),
                        embeddedLinks: linkData.links.map(l => l.href)
                    }
                });
            } catch (error) {
                console.error('[Hydra Guard] Error extracting email context:', error);
                sendResponse({ success: false, error: error.message });
            }
            return true; // Keep channel open for async response
        }

        if ((type === MessageTypes.SCAN_RESULT || type === MessageTypes.SCAN_RESULT_UPDATED) && message.data?.result) {
            const result = message.data.result;
            if (result.overallThreat || result.overallSeverity !== 'SAFE') {
                const sig = getScanSignature(result);

                // BUG-085: Skip if identical result is already displayed
                if (sig === lastDashboardSignature && document.getElementById('hydra-guard-threat-dashboard')) {
                    console.log('[Hydra Guard] Skipping redundant dashboard render (same result)');
                    return;
                }

                // BUG-085b: Skip if user dismissed the dashboard for this same result.
                // The dashboard should only reappear when the email content actually changes
                // (which will produce a different signature).
                if (dashboardDismissed && sig === dismissedForSignature) {
                    console.log('[Hydra Guard] Skipping dashboard — user dismissed for this result');
                    // Still apply highlights (non-intrusive)
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
    });

    console.log('[Hydra Guard] Email scanner orchestrator active');
})();
