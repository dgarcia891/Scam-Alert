/**
 * Content Script (Main Entry Point)
 * 
 * Runs in the context of web pages to:
 * - Inject warning overlays
 * - Monitor form submissions
 * - Detect suspicious behavior
 * - Communicate findings to service worker
 */

// Message types (replicated from lib/messaging.js since content scripts don't support ESM directly)
const MessageTypes = {
  SHOW_WARNING: 'show_warning',
  HIDE_WARNING: 'hide_warning',
  ANALYZE_PAGE: 'analyze_page',
  REPORT_SUSPICIOUS: 'report_suspicious'
};

console.log('[Scam Alert Content] Script loaded');

// ============================================================================
// Form Monitoring
// ============================================================================

document.addEventListener('submit', async (event) => {
  const form = event.target;

  // Check for sensitive input fields
  const hasPassword = form.querySelector('input[type="password"]');
  const hasCreditCard = form.querySelector('input[autocomplete*="cc"]');

  if (!hasPassword && !hasCreditCard) return;

  // Warn if submitting over HTTP
  const isHttps = window.location.protocol === 'https:';

  if (!isHttps) {
    event.preventDefault();

    const proceed = confirm(
      '⚠️ SECURITY WARNING\n\n' +
      'This form is NOT using a secure connection (HTTPS).\n' +
      'Your information could be intercepted.\n\n' +
      'Do you really want to submit?'
    );

    if (proceed) {
      form.submit();
    }
  }
}, true);

// ============================================================================
// Message Handling from Service Worker
// ============================================================================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const { type, data } = message;

  switch (type) {
    case MessageTypes.SHOW_WARNING:
      showWarningOverlay(data.result);
      sendResponse({ success: true });
      break;

    case MessageTypes.HIDE_WARNING:
      hideWarningOverlay();
      sendResponse({ success: true });
      break;

    default:
      console.warn('[Scam Alert Content] Unknown message:', type);
  }

  return true;
});

// ============================================================================
// Warning Overlay
// ============================================================================

/**
 * Show full-screen warning overlay
 * @param {Object} result - Scan result with threat info
 */
function showWarningOverlay(result) {
  // Don't show multiple overlays
  if (document.getElementById('scam-alert-overlay')) return;

  const overlay = document.createElement('div');
  overlay.id = 'scam-alert-overlay';
  overlay.style.cssText = `
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;
    right: 0 !important;
    bottom: 0 !important;
    background: rgba(0, 0, 0, 0.95) !important;
    z-index: 2147483647 !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif !important;
  `;

  const getSeverityColor = (severity) => {
    const colors = {
      'CRITICAL': '#DC2626',
      'HIGH': '#EA580C',
      'MEDIUM': '#F59E0B',
      'LOW': '#EAB308'
    };
    return colors[severity] || '#DC2626';
  };

  overlay.innerHTML = `
    <div style="background: white; border-radius: 16px; padding: 48px; max-width: 600px; text-align: center; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3);">
      <div style="font-size: 72px; margin-bottom: 24px;">⚠️</div>
      <h1 style="color: ${getSeverityColor(result.overallSeverity)}; font-size: 32px; margin: 0 0 16px 0; font-weight: 700;">
        This site may be risky
      </h1>
      <p style="color: #374151; font-size: 18px; line-height: 1.6; margin: 0 0 32px 0;">
        ${result.recommendations[0] || 'We recommend leaving this page. Avoid entering passwords or payment details unless you are sure it is safe.'}
      </p>
      <div style="background: #F3F4F6; border-radius: 8px; padding: 16px; margin-bottom: 32px; text-align: left;">
        <div style="font-weight: 600; color: #1F2937; margin-bottom: 8px;">Threat Level: ${result.overallSeverity}</div>
        <div style="font-size: 14px; color: #6B7280;">
          ${Object.keys(result.detections).length} detection method(s) flagged this site
        </div>
      </div>
      <div style="display: flex; gap: 16px; justify-content: center;">
        <button id="scam-alert-go-back" style="
          background: #DC2626;
          color: white;
          border: none;
          padding: 16px 32px;
          border-radius: 8px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
        ">
          ← Leave this page
        </button>
        <button id="scam-alert-proceed" style="
          background: transparent;
          color: #6B7280;
          border: 2px solid #D1D5DB;
          padding: 16px 32px;
          border-radius: 8px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
        ">
          Continue anyway
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  // Event listeners
  document.getElementById('scam-alert-go-back').onclick = () => {
    window.history.back();
  };

  document.getElementById('scam-alert-proceed').onclick = () => {
    overlay.remove();
  };
}

/**
 * Hide warning overlay
 */
function hideWarningOverlay() {
  const overlay = document.getElementById('scam-alert-overlay');
  if (overlay) {
    overlay.remove();
  }
}

console.log('[Scam Alert Content] Monitoring active');
