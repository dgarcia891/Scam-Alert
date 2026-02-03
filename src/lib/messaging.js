/**
 * Messaging Service
 * 
 * Handles async communication between service worker, content scripts, and popup.
 * CRITICAL: All chrome.runtime.sendMessage calls MUST handle lastError to prevent
 * "Channel closed" crashes.
 */

/**
 * Send message with error handling
 * @param {Object} message - Message to send
 * @returns {Promise<any>} Response from receiver
 */
export async function sendMessage(message) {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(message, (response) => {
            if (chrome.runtime.lastError) {
                console.error('[Messaging] Error:', chrome.runtime.lastError.message);
                reject(new Error(chrome.runtime.lastError.message));
                return;
            }
            resolve(response);
        });
    });
}

/**
 * Send message to specific tab
 * @param {number} tabId - Tab ID
 * @param {Object} message - Message to send
 * @returns {Promise<any>} Response from tab
 */
export async function sendMessageToTab(tabId, message) {
    return new Promise((resolve, reject) => {
        chrome.tabs.sendMessage(tabId, message, (response) => {
            if (chrome.runtime.lastError) {
                const msg = chrome.runtime.lastError.message || '';

                // Common case: content script not injected / tab navigated / restricted URL.
                // This is not fatal and should not surface as an extension error.
                if (
                    msg.includes('Receiving end does not exist') ||
                    msg.includes('Could not establish connection')
                ) {
                    resolve(null);
                    return;
                }

                console.error('[Messaging] Tab error:', msg);
                reject(new Error(msg));
                return;
            }
            resolve(response);
        });
    });
}

/**
 * Message types
 */
export const MessageTypes = {
    // From service worker to content script
    SHOW_WARNING: 'show_warning',
    HIDE_WARNING: 'hide_warning',
    SCAN_RESULT: 'scan_result',
    SCAN_RESULT_UPDATED: 'scan_result_updated', // Layer 2: Pushed to content script
    SHOW_BANNER: 'show_banner', // Layer 4: Non-blocking top banner
    EXECUTE_SCAN: 'execute_scan', // NEW

    // From content script to service worker
    ANALYZE_PAGE: 'analyze_page',
    REPORT_SUSPICIOUS: 'report_suspicious',
    FORM_SUBMISSION: 'form_submission',
    CONTEXT_DETECTED: 'context_detected', // NEW
    SCAN_PROGRESS: 'scan_progress', // NEW

    // From popup to service worker
    GET_TAB_STATUS: 'get_tab_status',
    SCAN_CURRENT_TAB: 'scan_current_tab',
    GET_STATS: 'get_stats',
    UPDATE_SETTINGS: 'update_settings',
    ADD_TO_WHITELIST: 'add_to_whitelist',
    RESET_STATS: 'reset_stats',
    ADD_TO_BLOCKLIST: 'add_to_blocklist',
    REMOVE_FROM_BLOCKLIST: 'remove_from_blocklist',
    GET_BLOCKLIST: 'get_blocklist',
    GET_SCAN_RESULTS: 'get_scan_results', // NEW

    // Responses
    STATUS_RESPONSE: 'status_response',
    SCAN_COMPLETE: 'scan_complete',
    ERROR: 'error',

    // Reporting
    REPORT_SCAM: 'report_scam',
    SYNC_BLOCKLIST: 'sync_blocklist'
};

/**
 * Create typed message
 * @param {string} type - Message type from MessageTypes
 * @param {Object} data - Message data
 * @returns {Object} Typed message
 */
export function createMessage(type, data = {}) {
    return {
        type,
        data,
        timestamp: Date.now()
    };
}

/**
 * Message handler wrapper with error handling
 * @param {Function} handler - Handler function
 * @returns {Function} Wrapped handler
  */
export function createMessageHandler(handler) {
    return (message, sender, sendResponse) => {
        // Execute handler and return result via sendResponse
        handler(message, sender)
            .then(result => {
                sendResponse({ success: true, data: result });
            })
            .catch(error => {
                console.error('[Messaging] Handler error:', error);
                sendResponse({
                    success: false,
                    error: error.message
                });
            });

        return true; // Keep channel open for async response
    };
}
