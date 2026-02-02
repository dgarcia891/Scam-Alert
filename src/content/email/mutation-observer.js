/**
 * DOM Mutation Observer for Email Scanning
 */

export function setupEmailObserver(triggerScan) {
    let scanThrottleTimeout = null;

    const observer = new MutationObserver(() => {
        if (!chrome.runtime?.id) return; // Orphaned script protection

        if (scanThrottleTimeout) clearTimeout(scanThrottleTimeout);
        scanThrottleTimeout = setTimeout(() => {
            triggerScan();
        }, 1000);
    });

    observer.observe(document.body, { childList: true, subtree: true });
    return observer;
}
