/**
 * Navigation Handler for Service Worker
 */

import { isKnownEmailClient } from '../../config/email-clients.js';

export function createNavigationHandler(context) {
    const { shouldScanUrl, scanAndHandle, syncIconForTabFromCache, resetActionUIForTab } = context;

    return async function (details) {
        // Only scan main frame
        if (details.frameId !== 0) return;

        // Clear badge/icon immediately to prevent flicker (BUG-062)
        if (resetActionUIForTab) {
            await resetActionUIForTab(details.tabId);
        }

        const url = details.url;
        if (!shouldScanUrl(url)) return;

        const tabId = details.tabId;

        // BUG-144: Do NOT run scanAndHandle for email clients.
        // The URL (mail.google.com) tells us nothing about email content.
        // The email scanner content script will trigger the real scan via SCAN_CURRENT_TAB
        // after extracting sender, subject, body, and links from the DOM.
        if (isKnownEmailClient(url)) {
            console.log(`[Hydra Guard] Email client detected — deferring scan to content script (tab ${tabId})`);
            // BUG-144: Clear stale tab state BUT set scanInProgress: true so popup knows to wait.
            // This prevents the 'NO SCAN' flash while the content script extracts the DOM.
            if (context.tabStateManager) {
                context.tabStateManager.updateTabState(tabId, { 
                    url, 
                    scanResults: null, 
                    lastScanned: null,
                    scanInProgress: true 
                });
            }
            return;
        }

        console.log(`[Hydra Guard] Navigation detected on tab ${tabId}:`, url);

        // Immediate: Clear stale badge state to prevent flickers (BUG-062)
        try {
            await chrome.action.setBadgeText({ tabId, text: '' });
        } catch (e) {
            // Ignore if tab is already closed or unavailable
        }

        try {
            await scanAndHandle(tabId, url);
        } catch (error) {
            console.error('[Hydra Guard] Navigation scan failed:', error);
            // Fallback: sync icon from cache if available (BUG-059: pass tabStateManager)
            await syncIconForTabFromCache(tabId, url, shouldScanUrl, context.tabStateManager);
        }
    };
}
