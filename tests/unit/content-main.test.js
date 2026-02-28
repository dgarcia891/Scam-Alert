/**
 * Tests for src/content/content-main.js
 *
 * content-main.js is a non-ESM content script that runs directly in the page.
 * It uses global `chrome`, `document`, `window` — no module exports.
 *
 * Strategy: We evaluate the script inside the test to populate the JSDOM env,
 * then exercise the DOM and chrome.runtime.onMessage listeners.
 *
 * Covers:
 *   collectPageSignals   – HTTPS detection, form scanning, link-mismatch detection
 *   normalizeHost        – strips www., lowercases
 *   showInlineInterceptionModal – form interception UI (Layer 2)
 *   showTopBanner        – Layer 4 banner rendering
 *   showReportModal      – report overlay + submit flow
 *   hideWarningOverlay   – overlay removal
 *   Message listener     – 6 message types routed correctly
 *   Form submit listener – password/cc field detection + risk gating
 */

import { jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import vm from 'vm';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const scriptPath = path.resolve(__dirname, '../../src/content/content-main.js');
const scriptSource = fs.readFileSync(scriptPath, 'utf-8');

// ── Helpers ────────────────────────────────────────────────────────

/** Set up a clean DOM + chrome mock and evaluate content-main.js */
function loadContentScript() {
  // Reset DOM
  document.body.innerHTML = '';
  document.head.innerHTML = '';

  // Grab the message listener callback registered during eval
  const messageListeners = [];
  const submitListeners = [];

  // We need to capture addEventListener calls on document for 'submit'
  const origAddEventListener = document.addEventListener.bind(document);
  document.addEventListener = jest.fn((event, handler, capture) => {
    if (event === 'submit') {
      submitListeners.push(handler);
    }
    origAddEventListener(event, handler, capture);
  });

  chrome.runtime.onMessage.addListener.mockImplementation((fn) => {
    messageListeners.push(fn);
  });

  // Mock window.location
  const locationMock = {
    protocol: 'https:',
    href: 'https://example.com/page',
    hostname: 'example.com'
  };

  // Evaluate the script in the current global context
  // We wrap to avoid `const` re-declaration errors across tests
  const wrappedSource = `(function() {
    // Provide window.location override for tests
    const _origLocation = window.location;
    ${scriptSource}
  })();`;

  try {
    // Use indirect eval to run in global scope
    const fn = new Function(wrappedSource);
    fn();
  } catch (e) {
    // Some parts may reference things not available in test - that's OK
    // as long as the functions we need are registered
    console.log('[Test Setup] Script eval note:', e.message);
  }

  return { messageListeners, submitListeners };
}

// ── Setup ──────────────────────────────────────────────────────────

let messageListeners = [];
let submitListeners = [];
let sendMessageMock;

beforeEach(() => {
  jest.restoreAllMocks();
  document.body.innerHTML = '';
  document.head.innerHTML = '';

  // Fresh chrome mock
  chrome.runtime.onMessage.addListener.mockReset();
  chrome.runtime.sendMessage.mockReset();
  sendMessageMock = chrome.runtime.sendMessage;

  const result = loadContentScript();
  messageListeners = result.messageListeners;
  submitListeners = result.submitListeners;
});

/** Dispatch a message to the registered onMessage listener */
function sendMessage(type, data = {}) {
  const sendResponse = jest.fn();
  if (messageListeners.length > 0) {
    messageListeners[messageListeners.length - 1](
      { type, data },
      {},
      sendResponse
    );
  }
  return sendResponse;
}

/* ════════════════════════════════════════════════════════════════════════
 *  Message Routing
 * ════════════════════════════════════════════════════════════════════ */
describe('Message listener routing', () => {
  test('SCAN_RESULT_UPDATED stores result and responds success', () => {
    const sendResponse = sendMessage('scan_result_updated', {
      result: { severity: 'HIGH', score: 80 }
    });
    expect(sendResponse).toHaveBeenCalledWith({ success: true });
  });

  test('SHOW_WARNING creates warning overlay and responds success', () => {
    const sendResponse = sendMessage('show_warning', {
      result: { severity: 'HIGH', reasons: [{ message: 'Phishing detected' }] }
    });
    expect(sendResponse).toHaveBeenCalledWith({ success: true });
    expect(document.getElementById('scam-alert-overlay')).not.toBeNull();
  });

  test('HIDE_WARNING removes overlay and responds success', () => {
    // First add an overlay
    const overlay = document.createElement('div');
    overlay.id = 'scam-alert-overlay';
    document.body.appendChild(overlay);

    const sendResponse = sendMessage('hide_warning');
    expect(sendResponse).toHaveBeenCalledWith({ success: true });
    expect(document.getElementById('scam-alert-overlay')).toBeNull();
  });

  test('ANALYZE_PAGE collects page signals and responds with data', () => {
    const sendResponse = sendMessage('analyze_page');
    expect(sendResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          isHttps: expect.any(Boolean),
          forms: expect.any(Array),
          linkMismatches: expect.any(Array)
        })
      })
    );
  });

  test('SHOW_BANNER creates top banner and responds success', () => {
    const sendResponse = sendMessage('show_banner', {
      result: { severity: 'HIGH', reasons: [{ message: 'Test reason' }] }
    });
    expect(sendResponse).toHaveBeenCalledWith({ success: true });
    expect(document.getElementById('sa-top-banner')).not.toBeNull();
  });

  test('OPEN_REPORT_MODAL creates report modal and responds success', () => {
    const sendResponse = sendMessage('OPEN_REPORT_MODAL');
    expect(sendResponse).toHaveBeenCalledWith({ success: true });
    expect(document.getElementById('scam-alert-report-modal')).not.toBeNull();
  });

  test('unknown message type responds with error', () => {
    const sendResponse = sendMessage('some_random_type');
    expect(sendResponse).toHaveBeenCalledWith({
      success: false,
      error: 'Unknown message type'
    });
  });
});

/* ════════════════════════════════════════════════════════════════════════
 *  showTopBanner
 * ════════════════════════════════════════════════════════════════════ */
describe('showTopBanner', () => {
  test('shows amber-colored banner for MEDIUM severity', () => {
    sendMessage('show_banner', {
      result: { severity: 'MEDIUM', reasons: [{ message: 'Minor risk' }] }
    });
    const banner = document.getElementById('sa-top-banner');
    expect(banner).not.toBeNull();
    // Amber background — JSDOM normalizes hex to rgb
    expect(banner.style.background).toBe('rgb(254, 243, 199)');
  });

  test('shows red-colored banner for HIGH severity', () => {
    sendMessage('show_banner', {
      result: { severity: 'HIGH', reasons: [{ message: 'Major risk' }] }
    });
    const banner = document.getElementById('sa-top-banner');
    expect(banner).not.toBeNull();
    // Red background — JSDOM normalizes hex to rgb
    expect(banner.style.background).toBe('rgb(254, 226, 226)');
  });

  test('does not create duplicate banners', () => {
    sendMessage('show_banner', { result: { severity: 'HIGH' } });
    sendMessage('show_banner', { result: { severity: 'HIGH' } });
    const banners = document.querySelectorAll('#sa-top-banner');
    expect(banners.length).toBe(1);
  });

  test('dismiss button removes the banner', () => {
    sendMessage('show_banner', { result: { severity: 'HIGH' } });
    const banner = document.getElementById('sa-top-banner');
    const dismissBtn = banner.querySelector('button');
    dismissBtn.click();
    expect(document.getElementById('sa-top-banner')).toBeNull();
  });

  test('falls back to default message when no reasons provided', () => {
    sendMessage('show_banner', { result: { severity: 'HIGH' } });
    const banner = document.getElementById('sa-top-banner');
    // innerText may not work in jsdom, use textContent
    expect(banner.textContent).toContain('Caution advised');
  });

  test('accepts overallSeverity as alternative to severity', () => {
    sendMessage('show_banner', {
      result: { overallSeverity: 'LOW', reasons: [] }
    });
    const banner = document.getElementById('sa-top-banner');
    expect(banner).not.toBeNull();
    // LOW is treated as caution → amber — JSDOM normalizes hex to rgb
    expect(banner.style.background).toBe('rgb(254, 243, 199)');
  });
});

/* ════════════════════════════════════════════════════════════════════════
 *  showReportModal
 * ════════════════════════════════════════════════════════════════════ */
describe('showReportModal', () => {
  test('creates report modal with correct structure', () => {
    sendMessage('OPEN_REPORT_MODAL');
    const modal = document.getElementById('scam-alert-report-modal');
    expect(modal).not.toBeNull();

    // Has description textarea
    const textarea = document.getElementById('sa-report-desc');
    expect(textarea).not.toBeNull();

    // Has cancel and submit buttons
    expect(document.getElementById('sa-report-cancel')).not.toBeNull();
    expect(document.getElementById('sa-report-submit')).not.toBeNull();
  });

  test('cancel button removes the modal', () => {
    sendMessage('OPEN_REPORT_MODAL');
    document.getElementById('sa-report-cancel').click();
    expect(document.getElementById('scam-alert-report-modal')).toBeNull();
  });

  test('does not create duplicate report modals', () => {
    sendMessage('OPEN_REPORT_MODAL');
    sendMessage('OPEN_REPORT_MODAL');
    const modals = document.querySelectorAll('#scam-alert-report-modal');
    expect(modals.length).toBe(1);
  });

  test('submit button sends REPORT_SCAM message via chrome.runtime', () => {
    sendMessage('OPEN_REPORT_MODAL');

    // Fill in description
    const textarea = document.getElementById('sa-report-desc');
    textarea.value = 'This looks like a phishing page';

    const submitBtn = document.getElementById('sa-report-submit');
    submitBtn.click();

    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'report_scam',
        data: expect.objectContaining({
          url: expect.any(String),
          type: 'web_scam',
          description: 'This looks like a phishing page'
        })
      }),
      expect.any(Function)
    );
  });

  test('submit button shows loading state', () => {
    sendMessage('OPEN_REPORT_MODAL');
    const submitBtn = document.getElementById('sa-report-submit');
    submitBtn.click();

    expect(submitBtn.textContent).toBe('Submitting...');
    expect(submitBtn.disabled).toBe(true);
  });
});

/* ════════════════════════════════════════════════════════════════════════
 *  hideWarningOverlay
 * ════════════════════════════════════════════════════════════════════ */
describe('hideWarningOverlay', () => {
  test('removes overlay when present', () => {
    const overlay = document.createElement('div');
    overlay.id = 'scam-alert-overlay';
    document.body.appendChild(overlay);

    sendMessage('hide_warning');
    expect(document.getElementById('scam-alert-overlay')).toBeNull();
  });

  test('does nothing when no overlay present', () => {
    // Should not throw
    const sendResponse = sendMessage('hide_warning');
    expect(sendResponse).toHaveBeenCalledWith({ success: true });
  });
});

/* ════════════════════════════════════════════════════════════════════════
 *  collectPageSignals (via ANALYZE_PAGE message)
 * ════════════════════════════════════════════════════════════════════ */
describe('collectPageSignals', () => {
  test('detects HTTPS protocol', () => {
    const sendResponse = sendMessage('analyze_page');
    const data = sendResponse.mock.calls[0][0].data;
    expect(typeof data.isHttps).toBe('boolean');
  });

  test('scans forms for password fields', () => {
    document.body.innerHTML = `
      <form>
        <input type="password" name="pass">
        <button type="submit">Login</button>
      </form>
    `;
    const sendResponse = sendMessage('analyze_page');
    const data = sendResponse.mock.calls[0][0].data;
    expect(data.forms.length).toBeGreaterThanOrEqual(1);
    expect(data.forms[0].hasPassword).toBe(true);
  });

  test('scans forms for credit card fields', () => {
    document.body.innerHTML = `
      <form>
        <input autocomplete="cc-number" name="card">
        <button type="submit">Pay</button>
      </form>
    `;
    const sendResponse = sendMessage('analyze_page');
    const data = sendResponse.mock.calls[0][0].data;
    expect(data.forms.length).toBeGreaterThanOrEqual(1);
    expect(data.forms[0].hasCreditCard).toBe(true);
  });

  test('filters out forms without sensitive fields', () => {
    document.body.innerHTML = `
      <form><input type="text" name="search"><button>Search</button></form>
      <form><input type="password" name="pw"><button>Login</button></form>
    `;
    const sendResponse = sendMessage('analyze_page');
    const data = sendResponse.mock.calls[0][0].data;
    // Only the password form should appear
    expect(data.forms.length).toBe(1);
    expect(data.forms[0].hasPassword).toBe(true);
  });

  test('limits to 5 forms', () => {
    let html = '';
    for (let i = 0; i < 10; i++) {
      html += `<form><input type="password"><button>Go</button></form>`;
    }
    document.body.innerHTML = html;
    const sendResponse = sendMessage('analyze_page');
    const data = sendResponse.mock.calls[0][0].data;
    expect(data.forms.length).toBeLessThanOrEqual(5);
  });

  test('returns empty arrays when page has no forms or links', () => {
    document.body.innerHTML = '<p>Simple page</p>';
    const sendResponse = sendMessage('analyze_page');
    const data = sendResponse.mock.calls[0][0].data;
    expect(data.forms).toEqual([]);
    expect(data.linkMismatches).toEqual([]);
  });

  test('detects link mismatches (display domain differs from href domain)', () => {
    document.body.innerHTML = `
      <a href="https://evil.com/login">Click to visit paypal.com</a>
    `;
    const sendResponse = sendMessage('analyze_page');
    const data = sendResponse.mock.calls[0][0].data;
    // "paypal.com" in display text != "evil.com" in href → mismatch
    expect(data.linkMismatches.length).toBeGreaterThanOrEqual(1);
    expect(data.linkMismatches[0].displayedHost).toContain('paypal.com');
    expect(data.linkMismatches[0].linkHost).toContain('evil.com');
  });

  test('does not flag matching link text and href', () => {
    document.body.innerHTML = `
      <a href="https://google.com">Visit google.com</a>
    `;
    const sendResponse = sendMessage('analyze_page');
    const data = sendResponse.mock.calls[0][0].data;
    expect(data.linkMismatches.length).toBe(0);
  });

  test('limits link mismatches to 5', () => {
    let html = '';
    for (let i = 0; i < 20; i++) {
      html += `<a href="https://evil${i}.com">Visit legit${i}.com now</a>`;
    }
    document.body.innerHTML = html;
    const sendResponse = sendMessage('analyze_page');
    const data = sendResponse.mock.calls[0][0].data;
    expect(data.linkMismatches.length).toBeLessThanOrEqual(5);
  });
});

/* ════════════════════════════════════════════════════════════════════════
 *  showInlineInterceptionModal
 * ════════════════════════════════════════════════════════════════════ */
describe('showInlineInterceptionModal', () => {
  // The modal is triggered by the form submit listener. We can't easily
  // call it directly (no exports), but we can test it indirectly by
  // setting up a scan result and submitting a form with a password field.

  test('does not intercept forms without password or credit card fields', () => {
    document.body.innerHTML = `
      <form id="test-form">
        <input type="text" name="query">
        <button type="submit">Search</button>
      </form>
    `;
    const form = document.getElementById('test-form');
    const event = new Event('submit', { bubbles: true, cancelable: true });
    form.dispatchEvent(event);

    // No interception modal should appear
    expect(document.getElementById('sa-intercept-modal')).toBeNull();
  });
});

/* ════════════════════════════════════════════════════════════════════════
 *  showWarningOverlay (via SHOW_WARNING message)
 * ════════════════════════════════════════════════════════════════════ */
describe('showWarningOverlay', () => {
  test('creates full-page overlay with correct ID', () => {
    sendMessage('show_warning', {
      result: { severity: 'CRITICAL', reasons: [{ message: 'Known phishing' }] }
    });
    const overlay = document.getElementById('scam-alert-overlay');
    expect(overlay).not.toBeNull();
    expect(overlay.style.zIndex).toBe('2147483647');
  });

  test('does not create duplicate overlays', () => {
    sendMessage('show_warning', { result: { severity: 'HIGH' } });
    sendMessage('show_warning', { result: { severity: 'HIGH' } });
    const overlays = document.querySelectorAll('#scam-alert-overlay');
    expect(overlays.length).toBe(1);
  });

  test('shows CRITICAL title for CRITICAL severity', () => {
    sendMessage('show_warning', {
      result: { severity: 'CRITICAL', checks: {}, reasons: [{ message: 'test' }] }
    });
    const overlay = document.getElementById('scam-alert-overlay');
    expect(overlay.textContent).toContain('Critical Threat Detected');
  });

  test('shows HIGH title for HIGH severity', () => {
    sendMessage('show_warning', {
      result: { severity: 'HIGH', checks: {}, reasons: [{ message: 'test' }] }
    });
    const overlay = document.getElementById('scam-alert-overlay');
    expect(overlay.textContent).toContain('High Risk Detected');
  });

  test('displays reason from scan result', () => {
    sendMessage('show_warning', {
      result: { severity: 'HIGH', reasons: [{ message: 'Typosquatting paypal.com' }] }
    });
    const overlay = document.getElementById('scam-alert-overlay');
    expect(overlay.textContent).toContain('Typosquatting paypal.com');
  });

  test('fallback reason when no reasons provided', () => {
    sendMessage('show_warning', { result: { severity: 'HIGH' } });
    const overlay = document.getElementById('scam-alert-overlay');
    expect(overlay.textContent).toContain('Suspicious Activity Detected');
  });

  test('displays flagged checks as findings', () => {
    sendMessage('show_warning', {
      result: {
        severity: 'HIGH',
        checks: {
          typosquatting: { flagged: true, title: 'Typosquatting', details: 'Looks like paypal.com' },
          nonHttps: { flagged: false, title: 'HTTPS', details: 'Secure' }
        },
        reasons: [{ message: 'test' }]
      }
    });
    const overlay = document.getElementById('scam-alert-overlay');
    expect(overlay.textContent).toContain('Typosquatting');
    expect(overlay.textContent).toContain('Looks like paypal.com');
  });

  test('go back button removes overlay', () => {
    sendMessage('show_warning', { result: { severity: 'HIGH' } });
    const backBtn = document.getElementById('sa-overlay-back');
    expect(backBtn).not.toBeNull();
    backBtn.click();
    expect(document.getElementById('scam-alert-overlay')).toBeNull();
  });

  test('proceed button removes overlay', () => {
    sendMessage('show_warning', { result: { severity: 'HIGH' } });
    const proceedBtn = document.getElementById('sa-overlay-proceed');
    expect(proceedBtn).not.toBeNull();
    proceedBtn.click();
    expect(document.getElementById('scam-alert-overlay')).toBeNull();
  });

  test('reason toggle shows/hides details panel', () => {
    sendMessage('show_warning', {
      result: { severity: 'HIGH', checks: { a: { flagged: true, title: 'A', details: 'Detail A' } } }
    });
    const reasonBtn = document.getElementById('sa-overlay-reason');
    const detailsPanel = document.getElementById('sa-overlay-details');

    // Initially hidden
    expect(detailsPanel.style.display).toBe('none');

    // Click to show
    reasonBtn.click();
    expect(detailsPanel.style.display).toBe('block');

    // Click again to hide
    reasonBtn.click();
    expect(detailsPanel.style.display).toBe('none');
  });

  test('uses overallSeverity when severity is not set', () => {
    sendMessage('show_warning', {
      result: { overallSeverity: 'CRITICAL', reasons: [] }
    });
    const overlay = document.getElementById('scam-alert-overlay');
    expect(overlay).not.toBeNull();
    expect(overlay.textContent).toContain('Critical Threat Detected');
  });
});
