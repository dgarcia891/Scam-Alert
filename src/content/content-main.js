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
  REPORT_SUSPICIOUS: 'report_suspicious',
  OPEN_REPORT_MODAL: 'OPEN_REPORT_MODAL', // NEW
  REPORT_SCAM: 'report_scam', // NEW
  SHOW_BANNER: 'show_banner', // Layer 4
  SCAN_RESULT_UPDATED: 'scan_result_updated' // Layer 2
};

console.log('[Scam Alert Content] Script loaded');

// ============================================================================
// State Management
// ============================================================================

let currentScanResult = null; // Stores the latest scan result for Layer 2 decisions

// ============================================================================
// Form Monitoring (Layer 2: Moment of Action)
// ============================================================================

document.addEventListener('submit', async (event) => {
  const form = event.target;

  // 1. Identify Sensitive Fields
  const hasPassword = form.querySelector('input[type="password"]');
  const hasCreditCard = form.querySelector('input[autocomplete*="cc"]');

  if (!hasPassword && !hasCreditCard) return;

  // 2. Evaluate Risk (Policy)
  const isHttps = window.location.protocol === 'https:';

  // Rule A: Always warn on HTTP with sensitive fields
  if (!isHttps) {
    event.preventDefault();
    showInlineInterceptionModal(form, {
      headline: 'Connection not secure',
      reason: 'You are about to send private information over an unencrypted connection.',
      severity: 'MEDIUM' // HTTP is treated as Medium for interception
    });
    return;
  }

  // Rule B: Warn if Scan Result suggests CAUTION or higher
  if (currentScanResult) {
    const severity = currentScanResult.severity || currentScanResult.overallSeverity; // Support both schemas
    const isRisky = severity === 'MEDIUM' || severity === 'HIGH' || severity === 'CRITICAL';

    if (isRisky) {
      event.preventDefault();
      showInlineInterceptionModal(form, {
        headline: 'Wait! Are you sure?',
        reason: `This site was flagged as ${severity}. Submitting information is risky.`,
        severity: severity
      });
      return;
    }
  }
}, true);

// ============================================================================
// Message Handling
// ============================================================================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const { type, data } = message;

  switch (type) {
    case MessageTypes.SCAN_RESULT_UPDATED: // Layer 2: Update local state
      currentScanResult = data.result;
      console.log('[Scam Alert Content] Scan result updated:', currentScanResult?.severity);
      sendResponse({ success: true });
      break;

    case MessageTypes.SHOW_WARNING:
      showWarningOverlay(data.result);
      sendResponse({ success: true });
      break;

    case MessageTypes.HIDE_WARNING:
      hideWarningOverlay();
      sendResponse({ success: true });
      break;

    case MessageTypes.ANALYZE_PAGE:
      sendResponse({ success: true, data: collectPageSignals() });
      break;

    case MessageTypes.SHOW_BANNER:
      showTopBanner(data.result);
      sendResponse({ success: true });
      break;

    case MessageTypes.OPEN_REPORT_MODAL:
      showReportModal();
      sendResponse({ success: true });
      break;

    default:
      console.warn('[Scam Alert Content] Unknown message:', type);
      sendResponse({ success: false, error: 'Unknown message type' });
  }

  return true;
});

// ============================================================================
// Inline Interception Modal (Layer 2)
// ============================================================================

function showInlineInterceptionModal(form, { headline, reason, severity }) {
  if (document.getElementById('sa-intercept-modal')) return;

  const modal = document.createElement('div');
  modal.id = 'sa-intercept-modal';

  // Style: Non-blocking, focused, near center but not full screen overlay
  modal.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: white;
        padding: 32px;
        border-radius: 12px;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
        z-index: 2147483647;
        width: 450px;
        font-family: system-ui, -apple-system, sans-serif;
        text-align: center;
        border: 2px solid ${severity === 'CRITICAL' || severity === 'HIGH' ? '#DC2626' : '#F59E0B'};
        animation: sa-fade-in 0.2s ease-out;
    `;

  // Backdrop
  const backdrop = document.createElement('div');
  backdrop.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.4); z-index: 2147483646;
        animation: sa-fade-in 0.2s ease-out;
    `;
  backdrop.onclick = () => {
    modal.remove();
    backdrop.remove();
  };

  modal.innerHTML = `
        <div style="font-size: 48px; margin-bottom: 16px;">✋</div>
        <h2 style="margin: 0 0 12px 0; color: #1F2937; font-size: 24px;">${headline}</h2>
        <p style="margin: 0 0 24px 0; color: #4B5563; line-height: 1.5; font-size: 16px;">${reason}</p>
        
        <div style="display: flex; gap: 12px; justify-content: center;">
            <button id="sa-intercept-back" style="
                background: #1F2937; color: white; border: none; padding: 12px 24px;
                border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 15px;
            ">Go Back</button>
            <button id="sa-intercept-proceed" style="
                background: transparent; color: #6B7280; border: 1px solid #D1D5DB;
                padding: 12px 24px; border-radius: 6px; cursor: pointer; font-size: 15px;
            ">I understand the risk</button>
        </div>
    `;

  document.body.appendChild(backdrop);
  document.body.appendChild(modal);

  document.getElementById('sa-intercept-back').onclick = () => {
    modal.remove();
    backdrop.remove();
  };

  document.getElementById('sa-intercept-proceed').onclick = () => {
    modal.remove();
    backdrop.remove();
    form.submit(); // Allow submission
  };

  // Add animation style
  const style = document.createElement('style');
  style.innerHTML = `@keyframes sa-fade-in { from { opacity: 0; transform: translate(-50%, -48%); } to { opacity: 1; transform: translate(-50%, -50%); } }`;
  document.head.appendChild(style);
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

/**
 * Show generic report modal
 */
function showTopBanner(result) {
  if (document.getElementById('sa-top-banner')) return;

  const banner = document.createElement('div');
  banner.id = 'sa-top-banner';

  const severity = result.severity || result.overallSeverity;
  const isCaution = severity === 'MEDIUM' || severity === 'LOW';

  banner.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    background: ${isCaution ? '#FEF3C7' : '#FEE2E2'};
    color: ${isCaution ? '#92400E' : '#991B1B'};
    padding: 12px 24px;
    z-index: 2147483647;
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-family: system-ui, -apple-system, sans-serif;
    font-size: 14px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    border-bottom: 1px solid ${isCaution ? '#F59E0B' : '#DC2626'};
    animation: sa-slide-down 0.3s ease-out;
  `;

  const content = document.createElement('div');
  content.style.display = 'flex';
  content.style.alignItems = 'center';
  content.style.gap = '12px';

  const icon = document.createElement('span');
  icon.textContent = isCaution ? '⚠️' : '🚨';
  icon.style.fontSize = '18px';

  const text = document.createElement('span');
  text.innerHTML = `<strong>Scam Alert:</strong> ${result.reasons?.[0]?.message || 'Caution advised on this site.'}`;

  content.appendChild(icon);
  content.appendChild(text);

  const actions = document.createElement('div');
  actions.style.display = 'flex';
  actions.style.gap = '16px';

  const dismiss = document.createElement('button');
  dismiss.textContent = 'Dismiss';
  dismiss.style.cssText = `
    background: transparent;
    border: none;
    color: inherit;
    font-weight: 600;
    cursor: pointer;
    text-decoration: underline;
  `;
  dismiss.onclick = () => banner.remove();

  actions.appendChild(dismiss);
  banner.appendChild(content);
  banner.appendChild(actions);

  document.body.appendChild(banner);

  // Push page down slightly if not absolute positioned
  const style = document.createElement('style');
  style.id = 'sa-banner-animations';
  style.textContent = `
    @keyframes sa-slide-down {
      from { transform: translateY(-100%); }
      to { transform: translateY(0); }
    }
    @keyframes sa-fade-in {
      from { opacity: 0; }
      to { opacity: 1; }
    }
  `;
  document.head.appendChild(style);
}

function showReportModal() {
  if (document.getElementById('scam-alert-report-modal')) return;

  const overlay = document.createElement('div');
  overlay.id = 'scam-alert-report-modal';
  overlay.style.cssText = `
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;
    width: 100% !important;
    height: 100% !important;
    background: rgba(0, 0, 0, 0.7) !important;
    z-index: 2147483647 !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif !important;
  `;

  overlay.innerHTML = `
    <div style="background: #1e1e1e; color: #fff; padding: 24px; border-radius: 12px; width: 400px; box-shadow: 0 8px 32px rgba(0,0,0,0.4); border: 1px solid #333;">
      <h3 style="margin: 0 0 16px 0; font-size: 18px; font-weight: 600;">Report Suspicious Site</h3>
      <div style="margin-bottom: 12px;">
        <label style="display: block; font-size: 12px; color: #aaa; margin-bottom: 4px;">Website URL</label>
        <input type="text" value="${window.location.href}" readonly style="width: 100%; padding: 8px; border-radius: 6px; border: 1px solid #333; background: #1a1a1a; color: #888; box-sizing: border-box;">
      </div>
      <div style="margin-bottom: 12px;">
        <label style="display: block; font-size: 12px; color: #aaa; margin-bottom: 4px;">Description (Optional)</label>
        <textarea id="sa-report-desc" placeholder="What looks suspicious?" style="width: 100%; padding: 8px; border-radius: 6px; border: 1px solid #444; background: #2a2a2a; color: #fff; box-sizing: border-box; height: 80px;"></textarea>
      </div>
      <div style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 20px;">
        <button id="sa-report-cancel" style="padding: 8px 16px; border: none; background: transparent; color: #aaa; cursor: pointer;">Cancel</button>
        <button id="sa-report-submit" style="padding: 8px 16px; border: none; background: #E63946; color: #fff; font-weight: 600; cursor: pointer; border-radius: 6px;">Submit Report</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  document.getElementById('sa-report-cancel').onclick = () => overlay.remove();

  document.getElementById('sa-report-submit').onclick = () => {
    const description = document.getElementById('sa-report-desc').value;
    const btn = document.getElementById('sa-report-submit');
    btn.textContent = 'Submitting...';
    btn.disabled = true;

    chrome.runtime.sendMessage({
      type: MessageTypes.REPORT_SCAM,
      data: {
        url: window.location.href,
        type: 'web_scam',
        description,
        metadata: {
          title: document.title,
          referrer: document.referrer
        }
      }
    }, (response) => {
      if (response && response.success) {
        alert('Report submitted successfully. Thank you!');
        overlay.remove();
      } else {
        alert('Failed to submit report. Please try again.');
        btn.textContent = 'Submit Report';
        btn.disabled = false;
      }
    });
  };
}


console.log('[Scam Alert Content] Monitoring active');

function collectPageSignals() {
  const isHttps = window.location.protocol === 'https:';

  const forms = Array.from(document.querySelectorAll('form'))
    .slice(0, 5)
    .map((form) => {
      const hasPassword = !!form.querySelector('input[type="password"]');
      const hasCreditCard = !!form.querySelector('input[autocomplete*="cc" i], input[name*="card" i]');
      const method = (form.method || 'GET').toUpperCase();
      let action = '';
      try {
        const actionUrl = new URL(form.action || window.location.href, window.location.href);
        action = actionUrl.origin;
      } catch {
        action = '';
      }

      return { hasPassword, hasCreditCard, method, action };
    })
    .filter(form => form.hasPassword || form.hasCreditCard);

  const linkMismatches = [];
  const anchors = Array.from(document.querySelectorAll('a[href^="http"]')).slice(0, 100);
  anchors.forEach((anchor) => {
    if (linkMismatches.length >= 5) return;

    const href = anchor.getAttribute('href');
    if (!href) return;

    let host;
    try {
      host = new URL(href, window.location.href).hostname;
    } catch {
      return;
    }

    const normalizedHost = normalizeHost(host);
    const text = (anchor.textContent || '').replace(/\s+/g, ' ').trim();
    if (!text) return;

    const domainMatch = text.match(/([A-Za-z0-9-]+\.)+[A-Za-z]{2,}/);
    if (!domainMatch) return;

    const displayedHost = normalizeHost(domainMatch[0]);
    if (!displayedHost || displayedHost === normalizedHost) return;

    linkMismatches.push({
      displayedHost,
      linkHost: normalizedHost,
      text: text.slice(0, 120)
    });
  });

  return {
    isHttps,
    forms,
    linkMismatches
  };
}

function normalizeHost(host) {
  return (host || '').replace(/^www\./i, '').toLowerCase();
}
