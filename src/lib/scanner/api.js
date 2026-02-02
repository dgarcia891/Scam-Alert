/**
 * Email Scanner API Wrapper (v19.2 Refactored)
 */
import { MessageTypes } from '../messaging.js';

export async function checkExternalReputation(url) {
    // Logic for Google Safe Browsing / PhishTank via Service Worker
    return new Promise((resolve) => {
        chrome.runtime.sendMessage({
            type: MessageTypes.SCAN_URL,
            data: { url }
        }, (response) => {
            resolve(response || { safe: true });
        });
    });
}
