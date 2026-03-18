/**
 * Hydra Guard: AI Opinion Handler
 * Extracts AI interaction logic out of the main handler.js
 */

import { verifyWithAI, extractEmailContext } from '../../lib/ai-verifier.js';
import { isKnownEmailClient } from '../../config/email-clients.js';
import { sendMessageToTab } from '../../lib/messaging.js';

export async function handleAskAIOpinion(msgData, getSettings, getCachedScan, cacheScan, tabStateManager) {
    try {
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
                console.log('[Hydra Guard] AI Using live tab scan results instead of URL cache');
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

                    let response = await attemptFetch();

                    // BUG-118: If the content script is not reachable (common in Gmail SPA
                    // navigation or after a service worker restart), programmatically re-inject
                    // the email scanner and retry once.
                    if (!response?.success && response?.error?.includes('Receiving end does not exist')) {
                        console.log('[Hydra Guard] Content script unreachable — re-injecting email scanner...');
                        try {
                            await chrome.scripting.executeScript({
                                target: { tabId: targetTabId },
                                files: ['dist/assets/emailScanner.js']
                            });
                            // Give the freshly injected script a moment to initialize
                            await new Promise(resolve => setTimeout(resolve, 500));
                            response = await attemptFetch();
                            if (response?.success) {
                                console.log('[Hydra Guard] Re-injection succeeded — email context fetched.');
                            }
                        } catch (injectErr) {
                            console.warn('[Hydra Guard] Programmatic injection failed:', injectErr.message);
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
                        console.log('[Hydra Guard] Fetched live email context for popup AI:', emailContext);
                    } else if (response?.error) {
                        fetchError = response.error;
                        console.warn('[Hydra Guard] Live email context fetch failed:', fetchError);
                    }
                } else if (targetTabId) {
                    try {
                        // BUG-125: use known email body selectors before falling back to raw body text
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
                            console.log('[Hydra Guard] Extracted live page text for generic AI scan.');
                        }
                    } catch (e) {
                        console.warn('[Hydra Guard] Failed to exact live page text:', e.message);
                    }
                }
            } catch (e) {
                fetchError = e.message;
                console.warn('[Hydra Guard] Failed to fetch live email context for AI:', e);
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
            console.log('[Hydra Guard] AI Context Guard triggered: Insufficient data for AI analysis.');
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

        const result = await verifyWithAI(url, { signals, phrases, intentKeywords, emailContext, contextType }, { apiKey: settings.aiApiKey });

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
                import('../lib/icon-manager.js').then(module => {
                    module.setActionIconForTab(msgData.tabId, 'CRITICAL');
                }).catch(err => console.warn('[Hydra Guard] Failed to update action icon:', err));
            }

            // 2. Dispatch telemetry (reportThreatIndicators checks user opt-in internally)
            if (aiVerification.indicators && aiVerification.indicators.length > 0) {
                import('../../lib/threat-telemetry.js').then(module => {
                    module.reportThreatIndicators(aiVerification.indicators, contextType);
                }).catch(err => {
                    console.warn('[Hydra Guard] Failed to load telemetry module:', err);
                });
            }
        }

        // FEAT-088 Fix: Persist AI verdict in persistent scan cache so it survives popup re-opens
        if (cached && cacheScan) {
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
