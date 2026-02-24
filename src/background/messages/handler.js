/**
 * Background Message Handler (v19.2 Refactored)
 */
import { MessageTypes } from '../../lib/messaging.js';
import { getStats, updateSettings, getCachedScan, addToWhitelist, repairStatistics, getWhitelist } from '../../lib/storage.js';
import { submitReport } from '../../lib/supabase.js';

export async function handleIncomingMessage(message, sender, context) {
    const { type, data, payload } = message; // Support both for transition
    const msgData = payload || data;
    const { scanAndHandle, getStats, updateSettings, getCachedScan, addToWhitelist, repairStatistics, getWhitelist, submitReport, submitFalsePositive, tabStateManager } = context;

    switch (type) {
        case MessageTypes.GET_TAB_STATUS:
            return handleGetTabStatus(getCachedScan);
        case MessageTypes.GET_SCAN_RESULTS:
            return handleGetScanResults(msgData, tabStateManager);
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
            return handleReportScam(data, submitReport);
        case MessageTypes.REPORT_FALSE_POSITIVE:
            return handleReportFalsePositive(data, submitFalsePositive);
        default:
            console.log('[Scam Alert] Unknown message type:', type);
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
    if (!identity.includes('@')) identity = identity.replace(/^www\./, '');
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

async function handleGetScanResults(data, tabStateManager) {
    const tabId = data.tabId || data.payload?.tabId;
    if (!tabId) return { error: 'No tabId' };
    const state = tabStateManager.getTabState(tabId);
    return {
        hasResults: !!state.scanResults,
        results: state.scanResults,
        lastScanned: state.lastScanned,
        context: state.context
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

        // 1. Validate explanation length
        if (!payload.explanation || payload.explanation.trim().length < 15) {
            return { success: false, error: 'Explanation must be at least 15 characters long.' };
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

        // 3. Submit
        const result = await submitFalsePositive(payload);

        if (result.success) {
            fpRateLimits.count++;
        }

        return result;
    } catch (error) {
        console.error('[Scam Alert] False positive handler error:', error);
        return { success: false, error: error.message };
    }
}

