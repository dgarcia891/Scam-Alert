/**
 * DOM Mutation Observer for Email Scanning
 */

import { OVERLAY_ID } from '../content.js';

export function setupEmailObserver(triggerScan) {
    let scanThrottleTimeout = null;

    const observer = new MutationObserver(() => {
        if (!chrome.runtime?.id) return; // Orphaned script protection

        // BUG-084: Do not trigger a rescan while our warning overlay is active.
        // Clicking "More Info" (Reason) changes a class inside the Shadow DOM which
        // causes host DOM reflow, firing this observer and resetting the overlay.
        if (document.getElementById(OVERLAY_ID)) return;

        if (scanThrottleTimeout) clearTimeout(scanThrottleTimeout);
        scanThrottleTimeout = setTimeout(() => {
            triggerScan();
        }, 1000);
    });

    observer.observe(document.body, { childList: true, subtree: true });
    return observer;
}
