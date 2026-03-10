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
import { extractEmailText, parseSenderInfo, extractEmailLinks, extractSubject } from '../lib/scanner/parser.js';
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
        if (!data) return;

        const senderInfo = parseSenderInfo();
        const linkData = extractEmailLinks();
        const subject = extractSubject();

        console.log('[Hydra Guard] Intentional scan triggered...');
        console.log('[Hydra Guard] Sender:', senderInfo.name, senderInfo.email);
        console.log('[Hydra Guard] Subject:', subject);
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
                    links: linkData.links,
                    rawUrls: linkData.rawUrls
                }
            }
        });
    }

    // Initialize DOM Observer
    setupEmailObserver(triggerScan);

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
            const data = extractEmailText();
            const senderInfo = parseSenderInfo();
            const subject = extractSubject();
            const linkData = extractEmailLinks();

            sendResponse({
                success: true,
                context: {
                    sender: senderInfo.name ? `${senderInfo.name} <${senderInfo.email}>` : senderInfo.email,
                    subject: subject,
                    snippet: data ? data.substring(0, 500) : '',
                    embeddedLinks: linkData.links.map(l => l.href)
                }
            });
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
