// Helper functions for handler.js
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
    const tabId = data.tabId;
    if (!tabId) return { error: 'No tabId' };
    const state = tabStateManager.getTabState(tabId);
    return {
        hasResults: !!state.scanResults,
        results: state.scanResults,
        lastScanned: state.lastScanned,
        context: state.context
    };
}
