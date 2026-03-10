/**
 * Background Message Handler (v19.2 Refactored)
 */
import { MessageTypes } from '../../lib/messaging.js';
import { getStats, getSettings, updateSettings, getCachedScan, addToWhitelist, repairStatistics, getWhitelist, normalizeUrl } from '../../lib/storage.js';
import { submitReport, submitUserReport, submitCorrection } from '../../lib/supabase.js';
import { verifyWithAI, extractEmailContext } from '../../lib/ai-verifier.js';
import { checkUrlsWithSafeBrowsing } from '../../lib/google-safe-browsing.js';

export async function handleIncomingMessage(message, sender, context) {
    const { type, data, payload } = message; // Support both for transition
    const msgData = payload || data;
    const { scanAndHandle, getStats, updateSettings, getCachedScan, addToWhitelist, repairStatistics, getWhitelist, submitReport, submitUserReport, submitFalsePositive, tabStateManager } = context;

    switch (type) {
        case MessageTypes.GET_TAB_STATUS:
            return handleGetTabStatus(getCachedScan);
        case MessageTypes.GET_SCAN_RESULTS:
            return handleGetScanResults(msgData, tabStateManager, getCachedScan);
        case MessageTypes.CONTEXT_DETECTED:
            return handleContextDetected(sender, msgData, tabStateManager);
        case MessageTypes.SCAN_CURRENT_TAB:
            return handleScanCurrentTab(sender, msgData, scanAndHandle);
        case MessageTypes.GET_STATS:
            return getStats();
        case MessageTypes.UPDATE_SETTINGS:
            return handleUpdateSettings(data, updateSettings);
        case MessageTypes.ADD_TO_WHITELIST:
            return handleAddToWhitelist(data, addToWhitelist);
        case MessageTypes.RESET_STATS:
            return handleResetStats(repairStatistics);
        case MessageTypes.REPORT_SCAM:
            return handleReportScam(data, submitUserReport || submitReport);
        case MessageTypes.REPORT_FALSE_POSITIVE:
            return handleReportFalsePositive(data, submitFalsePositive);
        case MessageTypes.NAVIGATE_BACK:
            return handleNavigateBack(sender);
        case MessageTypes.SHOW_WARNING:
        case MessageTypes.SHOW_BANNER:
        case MessageTypes.SCAN_RESULT:
        case MessageTypes.SCAN_RESULT_UPDATED:
            // Reflect these back to the tab to allow inter-content-script communication (e.g. Email Scanner to Content Overlay)
            if (sender.tab?.id) {
                chrome.tabs.sendMessage(sender.tab.id, message);
            }
            return { success: true };
        case 'SUBMIT_CORRECTION':
            return handleSubmitCorrectionUnified(msgData);
        case MessageTypes.FORCE_RESCAN:
            return handleForceRescan(sender, msgData, scanAndHandle);
        case MessageTypes.CLEAR_URL_CACHE:
            return handleClearUrlCache(msgData);
        case MessageTypes.ASK_AI_OPINION:
            return handleAskAIOpinion(msgData, getSettings, getCachedScan, context.cacheScan);
        case MessageTypes.TEST_GSB_KEY:
            return handleTestGsbKey(msgData);
        case MessageTypes.TEST_AI_KEY:
            return handleTestAiKey(msgData);
        case MessageTypes.TEST_PHISHTANK_KEY:
            return handleTestPhishTankKey(msgData);
        default:
            console.log('[Hydra Guard] Unknown message type:', type);
            return { error: 'Unknown message type' };
    }
}

async function handleGetTabStatus(getCachedScan) {
    const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    const tab = tabs[0];
    if (!tab || !tab.url) return { error: 'No active tab' };
    const result = await getCachedScan(tab.url);
    return { url: tab.url, result };
}

async function handleScanCurrentTab(sender, data, scanAndHandle) {
    const tab = sender.tab || (await chrome.tabs.query({ active: true, currentWindow: true }))[0];
    if (tab) {
        await scanAndHandle(tab.id, tab.url, {
            forceRefresh: Boolean(data?.forceRefresh),
            pageContent: data?.pageContent
        });
    }
    return { success: true };
}

async function handleUpdateSettings(data, updateSettings) {
    await updateSettings(data);
    return { success: true };
}

async function handleAddToWhitelist(data, addToWhitelist) {
    let identity = data.domain.toLowerCase();
    if (!identity.includes('@')) identity = identity.replace(/^www\\./, '');
    await addToWhitelist(identity);
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (activeTab) chrome.action.setBadgeText({ tabId: activeTab.id, text: '' });
    return { success: true };
}

async function handleResetStats(repairStatistics) {
    await chrome.storage.local.remove('statistics');
    await repairStatistics();
    return { success: true };
}

async function handleReportScam(data, submitReport) {
    try {
        const { url, type, description, metadata } = data;
        const reportResult = await submitReport(url, type, description, metadata);
        return { success: reportResult.success, error: reportResult.error };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

async function handleContextDetected(sender, data, tabStateManager) {
    if (!sender.tab) return { error: 'No tab' };
    const { context, emailMetadata } = data;
    tabStateManager.updateTabState(sender.tab.id, {
        context,
        emailMetadata,
        url: sender.tab.url
    });
    return { success: true };
}

async function handleGetScanResults(msgData, tabStateManager, getCachedScan) {
    const state = tabStateManager.getTabState(msgData.tabId);
    let results = state?.scanResults || null;

    // BUG-059 / Email Desync: Handle MV3 ephemeral service worker state loss.
    // If the SW went to sleep, tabStateManager (in-memory) is wiped, so popup defaults to SAFE
    // while the Chrome-managed badge stays RED. Fall back to persistent storage.
    if (!results) {
        try {
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            const tabUrl = tabs[0]?.url;
            if (tabUrl) {
                const cached = await getCachedScan(tabUrl);
                if (cached) {
                    results = cached;
                    // Restore state memory
                    tabStateManager.updateTabState(msgData.tabId, {
                        url: tabUrl,
                        scanResults: cached,
                        lastScanned: Date.now()
                    });
                }
            }
        } catch (e) {
            console.warn('[Hydra Guard] Cache fallback for tab state failed', e);
        }
    }

    return {
        results: results,
        url: state?.url || null,
        context: state?.context || null
    };
}

// Global rate limit cache for false positives
const fpRateLimits = {
    count: 0,
    timestamp: Date.now()
};

async function handleReportFalsePositive(data, submitFalsePositive) {
    try {
        const payload = data;

        // Build explanation from whichever fields the caller provides.
        // Dashboard sends: { flaggedText, checkTitle, category, userReason, userNote }
        // Legacy Locate tooltip sends: { explanation, url, phrase }
        const explanation = payload.explanation
            || [payload.userReason, payload.userNote, payload.category, payload.flaggedText]
                .filter(Boolean).join(' — ')
            || '';

        // 1. Validate: need at least some content
        if (explanation.trim().length < 3) {
            return { success: false, error: 'Please provide a reason for your feedback.' };
        }

        // 2. Rate limiting (max 10 per day per installation)
        const ONE_DAY = 24 * 60 * 60 * 1000;
        if (Date.now() - fpRateLimits.timestamp > ONE_DAY) {
            fpRateLimits.count = 0;
            fpRateLimits.timestamp = Date.now();
        }

        if (fpRateLimits.count >= 10) {
            return { success: false, error: 'Daily report limit reached. Thank you for your feedback!' };
        }

        // 3. Submit with normalized payload
        const normalizedPayload = {
            url: payload.pageUrl || payload.url || '',
            phrase: payload.flaggedText || payload.phrase || '',
            explanation: explanation
        };
        const result = await submitFalsePositive(normalizedPayload);

        if (result.success) {
            fpRateLimits.count++;
        }

        return result;
    } catch (error) {
        console.error('[Hydra Guard] False positive handler error:', error);
        return { success: false, error: error.message };
    }
}

async function handleNavigateBack(sender) {
    const tabId = sender.tab?.id;
    if (!tabId) return { error: 'No tab ID' };

    try {
        // Use Chrome API for most robust navigation
        if (chrome.tabs.goBack) {
            await chrome.tabs.goBack(tabId);
            return { success: true };
        } else {
            // Fallback for context without goBack
            return { error: 'goBack API unavailable' };
        }
    } catch (error) {
        return { error: error.message };
    }
}

async function handleSubmitCorrectionUnified(msgData) {
    try {
        const { url, feedback, comment, detectionResult } = msgData;

        // Hash the URL using Web Crypto API
        const encoder = new TextEncoder();
        const data = encoder.encode((url || '').toLowerCase().replace(/\/+$/, ''));
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const urlHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

        const detectionId = detectionResult?.detectionId || null;

        // Route through unified supabase.js (correct URL + API key)
        const result = await submitCorrection(urlHash, feedback, {
            detectionId,
            userComment: comment || null,
        });

        return result;
    } catch (error) {
        console.error('[Hydra Guard] Failed to submit correction:', error);
        return { success: false, error: error.message };
    }
}

async function handleForceRescan(sender, msgData, scanAndHandle) {
    const tab = sender.tab || (await chrome.tabs.query({ active: true, currentWindow: true }))[0];
    if (tab) {
        await scanAndHandle(tab.id, tab.url, { forceRefresh: true });
    }
    return { success: true };
}

async function handleClearUrlCache(msgData) {
    const normalized = normalizeUrl(msgData.url);
    await chrome.storage.local.remove(`scan_cache_${normalized}`);
    return { success: true };
}

// ── API Key Test Handlers ──────────────────────────────────────

async function handleTestGsbKey(msgData) {
    const apiKey = msgData?.apiKey;
    if (!apiKey) return { success: false, error: 'No API key provided.' };
    try {
        const result = await checkUrlsWithSafeBrowsing(['https://www.google.com'], apiKey);
        // If result has an error property, the request failed
        if (result.error) {
            return { success: false, error: result.error };
        }
        return { success: true };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

async function handleTestAiKey(msgData) {
    const apiKey = msgData?.apiKey;
    if (!apiKey) return { success: false, error: 'No API key provided.' };
    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
        const resp = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: 'Say OK' }] }],
                generationConfig: { maxOutputTokens: 5 }
            })
        });
        if (!resp.ok) {
            const errBody = await resp.json().catch(() => ({}));
            return { success: false, error: errBody.error?.message || `HTTP ${resp.status}` };
        }
        return { success: true };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

async function handleTestPhishTankKey(msgData) {
    return { success: false, error: 'PhishTank service is currently unavailable.' };
}

// ── AI Opinion Handler ─────────────────────────────────────────

async function handleAskAIOpinion(msgData, getSettings, getCachedScan, cacheScan) {
    try {
        const settings = await getSettings();

        if (!settings.aiEnabled || !settings.aiApiKey) {
            return { success: false, error: 'AI is not enabled or no API key configured.' };
        }

        // Get the current tab URL if not provided
        let url = msgData?.url;
        if (!url) {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            url = tab?.url;
        }
        if (!url) {
            return { success: false, error: 'No URL to analyze.' };
        }

        // Try to get cached scan results for richer context
        const cached = await getCachedScan(url);
        const signals = [];
        const phrases = [];
        let emailContext = null;

        if (cached) {
            if (cached.signals?.hard) signals.push(...cached.signals.hard);
            if (cached.signals?.soft) signals.push(...cached.signals.soft);
            const emailIndicators = cached.checks?.emailScams?.visualIndicators || [];
            phrases.push(...emailIndicators.map(i => i.phrase).filter(Boolean));

            // Build email context from cached metadata and checks
            const meta = cached.metadata || {};
            const emailCheck = cached.checks?.emailScams || null;

            emailContext = extractEmailContext(url, meta, emailCheck);
        }

        const result = await verifyWithAI(url, { signals, phrases, emailContext }, { apiKey: settings.aiApiKey });

        const aiVerification = {
            verdict: result.verdict,
            reason: result.reason,
            confidence: result.confidence,
            _debug: result._debug || null
        };

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
        return { success: false, error: err.message };
    }
}
