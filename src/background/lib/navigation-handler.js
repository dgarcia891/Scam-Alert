/**
 * Navigation Handler for Service Worker
 */

export function createNavigationHandler(context) {
    const { shouldScanUrl, scanAndHandle, syncIconForTabFromCache } = context;

    return async function (details) {
        // Only scan main frame
        if (details.frameId !== 0) return;

        const url = details.url;
        if (!shouldScanUrl(url)) return;

        const tabId = details.tabId;
        console.log(`[Scam Alert] Navigation detected on tab ${tabId}:`, url);

        // Immediate: Clear stale badge state to prevent flickers (BUG-062)
        try {
            await chrome.action.setBadgeText({ tabId, text: '' });
        } catch (e) {
            // Ignore if tab is already closed or unavailable
        }

        try {
            await scanAndHandle(tabId, url);
        } catch (error) {
            console.error('[Scam Alert] Navigation scan failed:', error);
            // Fallback: sync icon from cache if available (BUG-059: pass tabStateManager)
            await syncIconForTabFromCache(tabId, url, shouldScanUrl, context.tabStateManager);
        }
    };
}
