/**
 * Hydra Guard: AI Opinion Handler
 * Extracts AI interaction logic out of the main handler.js
 * 
 * BUG-141: The entire operation is wrapped in a hard 20s timeout (OPERATION_TIMEOUT_MS).
 * This guarantees the popup ALWAYS receives a sendResponse callback before its
 * own 30s safety timer fires — regardless of which internal step hangs
 * (content script fetch, Gemini API, chrome.storage, script injection, etc.)
 */

import { verifyWithAI, extractEmailContext } from '../../lib/ai-verifier.js';
import { isKnownEmailClient } from '../../config/email-clients.js';
import { sendMessageToTab } from '../../lib/messaging.js';
import { setActionIconForTab } from '../lib/icon-manager.js';
import { reportThreatIndicators } from '../../lib/threat-telemetry.js';

// Must be well under popup's AI_REQUEST_TIMEOUT_MS (30000ms)
// Leaves a 10s buffer for message transit + sendResponse delivery
const OPERATION_TIMEOUT_MS = 20000;

export async function handleAskAIOpinion(msgData, getSettings, getCachedScan, cacheScan, tabStateManager) {
    // BUG-141 FIX: Wrap the entire operation in a hard timeout.
    // If ANY sub-step hangs (getSettings, content fetch, Gemini API, cacheScan),
    // we force-return a real response so the popup never hits its dead-end 30s timer.
    const operationResult = await Promise.race([
        _doAskAI(msgData, getSettings, getCachedScan, cacheScan, tabStateManager),
        new Promise(resolve => setTimeout(() => {
            console.error('[Hydra Guard] ASK_AI_OPINION: HARD OPERATION TIMEOUT (20s) — forcing response.');
            resolve({
                success: true,
                verdict: 'INCONCLUSIVE',
                reason: 'AI analysis timed out. The Gemini API or content extraction may be slow. Please try again.',
                details: 'AI analysis timed out. The Gemini API or content extraction may be slow. Please try again.',
                confidence: 0,
                _debug: {
                    promptSent: '--- Operation Timeout ---\nThe entire Ask AI operation exceeded 20 seconds.\nThis typically means the Google Gemini API is unreachable, rate-limited, or the network is very slow.\nCheck your API key in Settings and try again.',
                    rawResponse: '(operation timeout: no API response received within 20s)'
                }
            });
        }, OPERATION_TIMEOUT_MS))
    ]);
    return operationResult;
}

/**
 * The actual AI opinion logic, separated so it can be raced against the hard timeout.
 */
async function _doAskAI(msgData, getSettings, getCachedScan, cacheScan, tabStateManager) {
    try {
        console.log('[Hydra Guard] ASK_AI: Starting AI opinion request...');
        const settings = await getSettings();

        if (!settings.aiEnabled || !settings.aiApiKey) {
            return { success: false, error: 'AI is not enabled or no API key configured.' };
        }

        // Get the current tab URL if not provided
        let targetTabId = msgData?.tabId;
        let url = msgData?.url;
        
        if (!targetTabId) {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            targetTabId = tab?.id;
            url = tab?.url || url;
        }

        if (!url) {
            return { success: false, error: 'No URL to analyze.' };
        }

        // Try to get cached scan results for richer context
        let cached = await getCachedScan(url);
        const signals = [];
        const phrases = [];
        const intentKeywords = [];
        let emailContext = null;

        // NEW: Prioritize tabStateManager for live email scan results instead of URL cache
        if (msgData?.tabId && tabStateManager) {
            const tabState = tabStateManager.getTabState(msgData.tabId);
            if (tabState && tabState.scanResults) {
                cached = tabState.scanResults;
                console.log('[Hydra Guard] ASK_AI: Using live tab scan results instead of URL cache');
            }
        }

        if (cached) {
            if (cached.signals?.hard) signals.push(...cached.signals.hard);
            if (cached.signals?.soft) signals.push(...cached.signals.soft);
            const emailIndicators = cached.checks?.emailScams?.visualIndicators || [];
            phrases.push(...emailIndicators.map(i => i.phrase).filter(Boolean));
            
            const detectedBrands = cached.checks?.emailScams?.evidence?.detectedBrands || [];
            intentKeywords.push(...detectedBrands);
            const rawIntents = cached.checks?.emailScams?.evidence?.intentKeywords || [];
            intentKeywords.push(...rawIntents);
        }

        let fetchError = null;
        // Build email context: Prefer real-time context from message payload (manual 'Ask AI' click)
        // extractEmailData from dashboard returns: { bodyText, senderName, senderEmail, subject, isEmailView }
        if (msgData?.emailContext) {
            const ec = msgData.emailContext;
            emailContext = {
                senderName: ec.senderName || '',
                senderEmail: ec.senderEmail || '',
                subject: ec.subject || '',
                bodySnippet: typeof ec.bodyText === 'string' ? ec.bodyText.slice(0, 500) : '',
                bodyLinks: [], // Background verifyWithAI will extract links from phrases if needed
                isReply: false
            };
        } else {
            // Fetch live email context from the active tab for popup AI
            try {
                if (targetTabId && isKnownEmailClient(url)) {
                    // Helper: attempt to fetch email context from the content script
                    const attemptFetch = () => {
                        const timeoutResponse = new Promise(resolve => setTimeout(() => resolve({ success: false, error: 'Content script timed out (1500ms).' }), 1500));
                        const fetchPromise = sendMessageToTab(targetTabId, { type: 'GET_EMAIL_CONTEXT' })
                            .then(res => res || { success: false, error: 'Content script unreachable.' })
                            .catch(e => ({ success: false, error: e.message || 'Content script unreachable.' }));
                        return Promise.race([fetchPromise, timeoutResponse]);
                    };

                    console.log('[Hydra Guard] ASK_AI: Fetching email context from content script...');
                    let response = await attemptFetch();

                    // BUG-118: If the content script is not reachable (common in Gmail SPA
                    // navigation or after a service worker restart), programmatically re-inject
                    // the email scanner and retry once.
                    if (!response?.success && response?.error?.includes('Receiving end does not exist')) {
                        console.log('[Hydra Guard] ASK_AI: Content script unreachable — re-injecting email scanner...');
                        try {
                            await chrome.scripting.executeScript({
                                target: { tabId: targetTabId },
                                files: ['dist/assets/emailScanner.js']
                            });
                            // Give the freshly injected script a moment to initialize
                            await new Promise(resolve => setTimeout(resolve, 500));
                            response = await attemptFetch();
                            if (response?.success) {
                                console.log('[Hydra Guard] ASK_AI: Re-injection succeeded — email context fetched.');
                            }
                        } catch (injectErr) {
                            console.warn('[Hydra Guard] ASK_AI: Programmatic injection failed:', injectErr.message);
                        }
                    }

                    if (response?.success && response.context) {
                        const ec = response.context;
                        emailContext = {
                            senderName: ec.senderName || '',
                            senderEmail: ec.senderEmail || '',
                            subject: ec.subject || '',
                            bodySnippet: ec.snippet || '',
                            bodyLinks: ec.embeddedLinks || [],
                            isReply: false
                        };
                        console.log('[Hydra Guard] ASK_AI: Got email context — sender:', emailContext.senderEmail, 'subject:', emailContext.subject?.slice(0, 40));
                    } else if (response?.error) {
                        fetchError = response.error;
                        console.warn('[Hydra Guard] ASK_AI: Live email context fetch failed:', fetchError);
                    }
                } else if (targetTabId) {
                    try {
                        // BUG-125: use known email body selectors before falling back to raw body text
                        console.log('[Hydra Guard] ASK_AI: Extracting page text via script injection...');
                        const injection = await chrome.scripting.executeScript({
                            target: { tabId: targetTabId },
                            func: function extractSmartPageText() {
                                var emailSelectors = [
                                    '.a3s.aiL', '.adn.ads .a3s', '.adn .a3s', '.a3s', '.ii.gt .a3s',
                                    '[data-test-id="message-view-body"]',
                                    '[data-testid="message-content"]',
                                    '.msg-body', '.rps_2003', '.rps_2016'
                                ];
                                for (var i = 0; i < emailSelectors.length; i++) {
                                    var el = document.querySelector(emailSelectors[i]);
                                    if (el) {
                                        var t = (el.innerText || '').trim();
                                        if (t.length > 20) return t.substring(0, 3000);
                                    }
                                }
                                var body = document.body;
                                if (!body) return '';
                                var clone = body.cloneNode(true);
                                var noise = clone.querySelectorAll('nav,header,footer,script,style,[role="navigation"],[role="banner"]');
                                for (var j = 0; j < noise.length; j++) noise[j].remove();
                                return (clone.innerText || '').trim().substring(0, 3000);
                            }
                        });
                        if (injection && injection[0]?.result) {
                            emailContext = { pageText: injection[0].result };
                            console.log('[Hydra Guard] ASK_AI: Extracted page text (' + injection[0].result.length + ' chars).');
                        }
                    } catch (e) {
                        console.warn('[Hydra Guard] ASK_AI: Failed to extract live page text:', e.message);
                    }
                }
            } catch (e) {
                fetchError = e.message;
                console.warn('[Hydra Guard] ASK_AI: Failed to fetch live email context for AI:', e);
            }

            // Fallback for automated background scans or if fetch failed
            if (!emailContext && cached) {
                const meta = cached.metadata || {};
                const emailCheck = cached.checks?.emailScams || null;
                emailContext = extractEmailContext(url, meta, emailCheck);
            }
        }

        // EMPTY CONTEXT GUARD: Prevent false positives on safe pages with no readable textual or email context
        const hasUsefulContext = emailContext && (emailContext.bodySnippet || emailContext.subject || emailContext.senderName || emailContext.senderEmail || (emailContext.pageText && emailContext.pageText.trim().length > 50));
        if (signals.length === 0 && phrases.length === 0 && intentKeywords.length === 0 && !hasUsefulContext) {
            console.log('[Hydra Guard] ASK_AI: Context Guard triggered — no data to analyze.');
            const errorReport = fetchError ? `\n\n[FETCH ERROR]: The extension tried to pull live data but failed: ${fetchError}` : '';
            const aiVerification = {
                verdict: 'INCONCLUSIVE',
                reason: 'Insufficient suspicious context or email data found to analyze.',
                details: 'Insufficient suspicious context or email data found to analyze.',
                confidence: 50,
                _debug: {
                    promptSent: `--- Context Guard Triggered ---\nI prevented sending an empty prompt to the AI to avoid a 'Looks safe' false positive.\n\nHere is the exact evidence the extension successfully extracted from this tab (Tab ID: ${msgData?.tabId}):\n\n1. Threat Signals: ${JSON.stringify(signals)}\n2. Found Phrases: ${JSON.stringify(phrases)}\n3. Intent Keywords: ${JSON.stringify(intentKeywords)}\n4. Context Data: ${JSON.stringify(emailContext)}${errorReport}\n\nIf everything above is empty, the webpage content was not successfully extracted or didn't contain anything readable. Refresh the page to trigger a new extraction.`,
                    rawResponse: `No API call was made to Google Gemini. The extension blocked the request to save API costs and prevent false positives because there was zero data to analyze.`
                }
            };
            if (cached && cacheScan) {
                cached.aiVerification = aiVerification;
                await cacheScan(url, cached);
            }
            return { success: true, ...aiVerification };
        }

        const isEmailContext = isKnownEmailClient(url) || (cached && cached.checks?.emailScams?.flagged);
        const contextType = isEmailContext ? 'EMAIL' : 'WEB';

        console.log('[Hydra Guard] ASK_AI: Calling Gemini API (contextType: ' + contextType + ', signals: ' + signals.length + ')...');
        const result = await verifyWithAI(url, { signals, phrases, intentKeywords, emailContext, contextType }, { apiKey: settings.aiApiKey });
        console.log('[Hydra Guard] ASK_AI: Gemini API returned verdict:', result.verdict, '(timeout:', !!result._isTimeout, ')');

        const aiVerification = {
            verdict: result.verdict,
            reason: result.reason,
            details: result.reason, // BUG-128 Sync: Provide both field names for UI compatibility
            confidence: result.confidence,
            indicators: result.indicators || [],
            _debug: result._debug || null
        };

        // FEAT-119: Telemetry & UI Badge propagation
        if (['ESCALATED', 'CONFIRMED'].includes(aiVerification.verdict)) {
            console.log('[Hydra Guard] AI identified threat. Enforcing UI sync & potentially sending telemetry.');
            
            // 1. Force icon badge to RED instantly
            if (msgData?.tabId) {
                chrome.action.setBadgeText({ text: '!', tabId: msgData.tabId }).catch(() => {});
                chrome.action.setBadgeBackgroundColor({ color: '#f43f5e', tabId: msgData.tabId }).catch(() => {});
                try {
                    setActionIconForTab(msgData.tabId, 'CRITICAL');
                } catch (err) {
                    console.warn('[Hydra Guard] Failed to update action icon:', err);
                }
            }

            // 2. Dispatch telemetry (reportThreatIndicators checks user opt-in internally)
            if (aiVerification.indicators && aiVerification.indicators.length > 0) {
                try {
                    reportThreatIndicators(aiVerification.indicators, contextType);
                } catch (err) {
                    console.warn('[Hydra Guard] Failed to load telemetry module:', err);
                }
            }
        }

        // FEAT-088 Fix: Persist AI verdict in persistent scan cache so it survives popup re-opens
        // BUG-141 Fix: NEVER cache a timeout result to avoid false-positive caching
        if (cached && cacheScan && !result._isTimeout) {
            cached.aiVerification = aiVerification;
            await cacheScan(url, cached);
        }

        return {
            success: true,
            ...aiVerification
        };
    } catch (err) {
        console.error('[Hydra Guard] ASK_AI_OPINION failed:', err);
        return { success: false, error: err.stack || err.message };
    }
}
