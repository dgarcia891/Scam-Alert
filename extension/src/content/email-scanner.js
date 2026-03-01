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
import { extractEmailText, parseSenderInfo } from '../lib/scanner/parser.js';
import { runHeuristics } from '../lib/scanner/heuristics.js';
import { setupLinkInterceptor } from './email/link-interceptor.js';

(function () {
    let currentEmailId = null;

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

        const data = extractEmailText(); // Should be from parser now
        if (!data) return;

        // Extract sender information for authority impersonation detection
        const senderInfo = parseSenderInfo();

        console.log('[Scam Alert] Intentional scan triggered...');

        chrome.runtime.sendMessage({
            type: MessageTypes.SCAN_CURRENT_TAB,
            data: {
                forceRefresh: true,
                pageContent: {
                    bodyText: data,
                    isEmailView: true,
                    senderName: senderInfo.name,
                    senderEmail: senderInfo.email
                }
            }
        });
    }

    // Initialize DOM Observer
    setupEmailObserver(triggerScan);

    // Initialize Link Interceptor
    setupLinkInterceptor((href) => {
        // Send a message to content.js to display the danger overlay
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
    chrome.runtime.onMessage.addListener((message) => {
        if (!chrome.runtime?.id) return;

        if (message.type === MessageTypes.SCAN_RESULT && message.data?.result) {
            const result = message.data.result;
            if (result.overallThreat || result.overallSeverity !== 'SAFE') {
                try {
                    highlightDetections(result);
                    showThreatDashboard(result);
                } catch (e) {
                    console.error('[Scam Alert] UI Orchestration failed:', e);
                }
            }
        }
    });

    console.log('[Scam Alert] Email scanner orchestrator active');
})();
