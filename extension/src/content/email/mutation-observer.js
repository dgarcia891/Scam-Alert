/**
 * DOM Mutation Observer for Email Scanning
 */

import { OVERLAY_ID } from '../../lib/constants.js';

const DASHBOARD_ID = 'hydra-guard-threat-dashboard';

export function setupEmailObserver(triggerScan) {
    let scanThrottleTimeout = null;

    const observer = new MutationObserver(() => {
        if (!chrome.runtime?.id) return; // Orphaned script protection

        // BUG-084: Do not trigger a rescan while our warning overlay is active.
        // Clicking "More Info" (Reason) changes a class inside the Shadow DOM which
        // causes host DOM reflow, firing this observer and resetting the overlay.
        if (document.getElementById(OVERLAY_ID)) return;

        // BUG-085: Do not trigger a rescan while the threat dashboard is visible.
        // The dashboard injects/removes DOM nodes which triggers this observer,
        // causing an infinite scan → dashboard → DOM mutation → scan loop.
        if (document.getElementById(DASHBOARD_ID)) return;

        if (scanThrottleTimeout) clearTimeout(scanThrottleTimeout);
        scanThrottleTimeout = setTimeout(() => {
            triggerScan();
        }, 1000);
    });

    observer.observe(document.body, { childList: true, subtree: true });
    return observer;
}
