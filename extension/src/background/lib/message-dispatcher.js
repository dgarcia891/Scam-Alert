/**
 * Message Dispatcher for Service Worker
 */
import { MessageTypes } from '../../lib/messaging.js';
import { getStats, getSettings, updateSettings, getCachedScan, addToWhitelist, repairStatistics, addToBlocklist, removeFromBlocklist, getBlocklist } from '../../lib/storage.js';
import { verifyWithAI } from '../../lib/ai-verifier.js';
import { submitUserReport } from '../../lib/supabase.js';
import { syncManager } from './sync-manager.js';

/**
 * Creates a message handler that delegates to specialized functions
 * @param {Object} context - Execution context (e.g., functions from service-worker)
 */
export function handleIncomingMessage(message, sender, context) {
    const { type, data } = message;
    const { scanAndHandle, getWhitelist } = context;

    switch (type) {
        case MessageTypes.GET_TAB_STATUS:
            return handleGetTabStatus();

        case MessageTypes.SCAN_CURRENT_TAB:
            return handleScanCurrentTab(sender, data, scanAndHandle);

        case MessageTypes.GET_STATS:
            return getStats();

        case MessageTypes.UPDATE_SETTINGS:
            return handleUpdateSettings(data);

        case MessageTypes.ADD_TO_WHITELIST:
            return handleAddToWhitelist(data, getWhitelist);

        case MessageTypes.RESET_STATS:
            return handleResetStats();

        case MessageTypes.REPORT_SCAM:
            return handleReportScam(data);

        case MessageTypes.ADD_TO_BLOCKLIST:
            return handleAddToBlocklist(data);

        case MessageTypes.REMOVE_FROM_BLOCKLIST:
            return handleRemoveFromBlocklist(data);

        case MessageTypes.GET_BLOCKLIST:
            return getBlocklist();

        case MessageTypes.SYNC_BLOCKLIST:
            return handleSyncBlocklist(data);

        case MessageTypes.ASK_AI_OPINION:
            return handleAskAIOpinion(data);

        default:
            console.warn('[Hydra Guard] Unknown message type:', type);
            return { error: 'Unknown message type' };
    }
}

async function handleGetTabStatus() {
    const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    const tab = tabs[0];
    if (!tab || !tab.url) return { error: 'No active tab' };

    const result = await getCachedScan(tab.url);
    return { url: tab.url, result };
}

async function handleScanCurrentTab(sender, data, scanAndHandle) {
    const tab = sender.tab || (await chrome.tabs.query({ active: true, currentWindow: true }))[0];
    if (tab) {
        console.log('[Hydra Guard] Triggering scan from message for:', tab.url);
        await scanAndHandle(tab.id, tab.url, {
            forceRefresh: Boolean(data?.forceRefresh),
            pageContent: data?.pageContent
        });
    } else {
        console.warn('[Hydra Guard] SCAN_CURRENT_TAB received but no tab found');
    }
    return { success: true };
}

async function handleUpdateSettings(data) {
    await updateSettings(data);
    return { success: true };
}

async function handleAddToWhitelist(data, getWhitelist) {
    let identity = data.domain.toLowerCase();
    if (!identity.includes('@')) {
        identity = identity.replace(/^www\./, '');
    }

    const list = await getWhitelist();
    if (!list.includes(identity)) {
        await addToWhitelist(identity);
        // Also clear badge if scan was warning
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (activeTab) {
            chrome.action.setBadgeText({ tabId: activeTab.id, text: '' });
        }
    }
    return { success: true };
}

async function handleResetStats() {
    console.log('[Hydra Guard] Manual stats reset requested');
    await chrome.storage.local.remove('statistics');
    await repairStatistics();
    await repairStatistics(); // Double repair to ensure consistency
    return { success: true };
}

async function handleReportScam(data) {
    console.log('[Hydra Guard] Processing report from content script:', data);
    try {
        const { url, type, description, metadata } = data;
        const reportResult = await submitUserReport(url, type, description, metadata);
        return { success: reportResult.success, error: reportResult.error };
    } catch (error) {
        console.error('[Hydra Guard] Report submission failed:', error);
        return { success: false, error: error.message };
    }
}


async function handleAddToBlocklist(data) {
    const domain = data.domain.toLowerCase().trim();
    if (domain) {
        await addToBlocklist(domain);
    }
    return { success: true };
}

async function handleRemoveFromBlocklist(data) {
    const domain = data.domain.toLowerCase().trim();
    if (domain) {
        await removeFromBlocklist(domain);
    }
    return { success: true };
}

async function handleSyncBlocklist(data) {
    console.log('[Hydra Guard] Manual blocklist sync requested');
    const result = await syncManager.sync(!!data?.force);
    return result;
}

async function handleAskAIOpinion(data) {
    try {
        const settings = await getSettings();

        if (!settings.aiEnabled || !settings.aiApiKey) {
            return { success: false, error: 'AI is not enabled or no API key configured.' };
        }

        // Get the current tab URL if not provided
        let url = data?.url;
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

        if (cached) {
            if (cached.signals?.hard) signals.push(...cached.signals.hard);
            if (cached.signals?.soft) signals.push(...cached.signals.soft);
            const emailIndicators = cached.checks?.emailScams?.visualIndicators || [];
            phrases.push(...emailIndicators.map(i => i.phrase).filter(Boolean));
        }

        const result = await verifyWithAI(url, { signals, phrases }, { apiKey: settings.aiApiKey });

        return {
            success: true,
            verdict: result.verdict,
            reason: result.reason,
            confidence: result.confidence
        };
    } catch (err) {
        console.error('[Hydra Guard] ASK_AI_OPINION failed:', err);
        return { success: false, error: err.message };
    }
}

