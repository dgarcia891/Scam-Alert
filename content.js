/**
 * Content Script
 * 
 * Monitors page content and forms for suspicious activity
 */

console.log('[Scam Alert] Content script loaded');

// Monitor form submissions
document.addEventListener('submit', async (event) => {
    const form = event.target;

    // Check if form has password or credit card fields
    const hasPassword = form.querySelector('input[type="password"]');
    const hasCreditCard = form.querySelector('input[autocomplete*="cc"]');

    if (!hasPassword && !hasCreditCard) return;

    // Check if current site is HTTPS
    const isHttps = window.location.protocol === 'https:';

    if (!isHttps) {
        // Warn about submitting sensitive data over HTTP
        event.preventDefault();

        const proceed = confirm(
            '⚠️ SECURITY WARNING\n\n' +
            'This form is NOT using a secure connection (HTTPS).\n' +
            'Your information could be intercepted by attackers.\n\n' +
            'Do you really want to submit this form?'
        );

        if (proceed) {
            form.submit();
        }
    }
}, true);

// Monitor for auto-redirects (common in scams)
let redirectCount = 0;
const originalUrl = window.location.href;

setInterval(() => {
    if (window.location.href !== originalUrl) {
        redirectCount++;

        if (redirectCount >= 3) {
            console.warn('[Scam Alert] Multiple redirects detected - possible scam');

            // Notify background script
            chrome.runtime.sendMessage({
                type: 'SUSPICIOUS_REDIRECTS',
                count: redirectCount,
                url: window.location.href
            });
        }
    }
}, 1000);

// Monitor clipboard hijacking
document.addEventListener('copy', (event) => {
    // Log clipboard access (scams sometimes replace copied crypto addresses)
    console.log('[Scam Alert] Clipboard access detected');
});

console.log('[Scam Alert] Content script monitoring active');
