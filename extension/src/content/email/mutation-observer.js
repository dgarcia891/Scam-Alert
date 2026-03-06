/**
 * DOM Mutation Observer for Email Scanning
 */

import { OVERLAY_ID } from '../../lib/constants.js';

const DASHBOARD_ID = 'hydra-guard-threat-dashboard';

// BUG-085b: Cooldown period after the dashboard is removed from the DOM.
// When the user dismisses the dashboard (or it's removed for any reason),
// the removal itself triggers a DOM mutation. Without a cooldown, the observer
// would immediately fire triggerScan() → rescan → dashboard re-appears.
// 5 seconds is long enough for the cascade to settle.
let dismissCooldownUntil = 0;

export function setupEmailObserver(triggerScan) {
    let scanThrottleTimeout = null;
    let dashboardWasPresent = false;

    const observer = new MutationObserver(() => {
        if (!chrome.runtime?.id) return; // Orphaned script protection

        // BUG-084: Do not trigger a rescan while our warning overlay is active.
        if (document.getElementById(OVERLAY_ID)) return;

        // BUG-085: Do not trigger a rescan while the threat dashboard is visible.
        const dashboardPresent = !!document.getElementById(DASHBOARD_ID);
        if (dashboardPresent) {
            dashboardWasPresent = true;
            return;
        }

        // BUG-085b: If the dashboard was just removed (present → gone), start a cooldown.
        // This prevents the DOM removal itself from triggering an immediate rescan.
        if (dashboardWasPresent && !dashboardPresent) {
            dashboardWasPresent = false;
            dismissCooldownUntil = Date.now() + 5000; // 5 second cooldown
            return;
        }

        // BUG-085b: Respect the cooldown window after dashboard removal.
        if (Date.now() < dismissCooldownUntil) return;

        if (scanThrottleTimeout) clearTimeout(scanThrottleTimeout);
        scanThrottleTimeout = setTimeout(() => {
            triggerScan();
        }, 1000);
    });

    observer.observe(document.body, { childList: true, subtree: true });
    return observer;
}
