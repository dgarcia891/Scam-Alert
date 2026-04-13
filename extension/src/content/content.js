import { MessageTypes } from '../lib/messaging.js';
import { detectContext, detectEmailMetadata } from '../lib/context-detector.js';
import { scanUrl } from '../lib/detector.js';
import { highlightDetections, removeHighlights } from './highlighter.js';
import { OVERLAY_ID, CHECK_LABELS } from '../lib/constants.js';
export { OVERLAY_ID };



console.log('[Hydra Guard] Content script loaded (Hydra Guard)');

// Guard immediate execution for tests/environments without chrome.runtime
if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
    // Immediate Context Detection
    const initialContext = detectContext();
    const initialMetadata = initialContext.type === 'email' ? detectEmailMetadata(initialContext) : null;

    chrome.runtime.sendMessage({
        type: MessageTypes.CONTEXT_DETECTED,
        data: {
            context: initialContext,
            emailMetadata: initialMetadata
        }
    });
}

// Export for unit testing
let warningAcknowledged = false;
try {
    if (window.sessionStorage.getItem('hydra_guard_suppressed') === 'true') {
        warningAcknowledged = true;
    }
} catch (e) {
    // Ignore Storage access errors (e.g. strict third-party cookie settings)
}
let currentScanResult = null; // Track latest result for Layer 2 decisions

export function resetWarningAcknowledgement() {
    warningAcknowledged = false;
}

/**
 * Internal helper to apply highlights if allowed by settings
 */
async function _applyHighlightsIfEnabled(result) {
    if (!result) return;
    const { settings } = await chrome.storage.local.get(['settings']);
    const highlightingEnabled = settings?.highlightingEnabled ?? true;
    if (highlightingEnabled) {
        highlightDetections(result);
    }
}

// ============================================================================
// Form Monitoring (Layer 2: Moment of Action)
// ============================================================================
document.addEventListener('submit', async (event) => {
    const form = event.target;
    // 1. Identify Sensitive Fields
    const hasPassword = form.querySelector('input[type="password"]');
    const hasCreditCard = form.querySelector('input[autocomplete*="cc" i], input[name*="card" i]');
    if (!hasPassword && !hasCreditCard) return;

    // 2. Evaluate Risk
    const isHttps = window.location.protocol === 'https:';

    // Rule A: Warn on HTTP with sensitive fields
    if (!isHttps) {
        event.preventDefault();
        showInlineInterceptionModal(form, {
            headline: 'Connection not secure',
            reason: 'You are about to send private information over an unencrypted connection.',
            severity: 'MEDIUM'
        });
        return;
    }

    // Rule B: Warn if latest scan flagged high risk
    if (currentScanResult) {
        const severity = currentScanResult.overallSeverity || currentScanResult.severity;
        const isRisky = severity === 'MEDIUM' || severity === 'HIGH' || severity === 'CRITICAL';
        if (isRisky) {
            event.preventDefault();
            showInlineInterceptionModal(form, {
                headline: 'Wait! Are you sure?',
                reason: `This site was flagged as ${severity}. Submitting information is risky.`,
                severity: severity
            });
        }
    }
}, true);

// ============================================================================
// UI Components (Modals, Banners)
// ============================================================================

function showInlineInterceptionModal(form, { headline, reason, severity }) {
    if (document.getElementById('sa-intercept-modal')) return;
    const modal = document.createElement('div');
    modal.id = 'sa-intercept-modal';
    modal.style.cssText = `
        position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
        background: white; padding: 32px; border-radius: 12px;
        box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5); z-index: 2147483647;
        width: 450px; font-family: system-ui, sans-serif; text-align: center;
        border: 2px solid ${severity === 'CRITICAL' || severity === 'HIGH' ? '#ef4444' : '#f59e0b'};
        animation: sa-fade-in 0.2s ease-out;
    `;

    const backdrop = document.createElement('div');
    backdrop.style.cssText = `position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.4); z-index: 2147483646;`;

    modal.innerHTML = `
        <div style="font-size: 48px; margin-bottom: 16px;">✋</div>
        <h2 style="margin: 0 0 12px 0; color: #111827; font-size: 24px;">${headline}</h2>
        <p style="margin: 0 0 24px 0; color: #4b5563; line-height: 1.5;">${reason}</p>
        <div style="display: flex; gap: 12px; justify-content: center;">
            <button id="sa-intercept-back" style="background: #111827; color: white; border: none; padding: 12px 24px; border-radius: 6px; font-weight: 600; cursor: pointer;">Go Back</button>
            <button id="sa-intercept-proceed" style="background: transparent; color: #6b7280; border: 1px solid #d1d5db; padding: 12px 24px; border-radius: 6px; cursor: pointer;">Proceed Anyway</button>
        </div>
    `;

    document.body.appendChild(backdrop);
    document.body.appendChild(modal);

    document.getElementById('sa-intercept-back').onclick = () => { modal.remove(); backdrop.remove(); };
    document.getElementById('sa-intercept-proceed').onclick = () => { modal.remove(); backdrop.remove(); form.submit(); };
}

function showTopBanner(result) {
    if (document.getElementById('sa-top-banner')) return;
    const severity = result.overallSeverity || result.severity;
    const isCaution = severity === 'MEDIUM' || severity === 'LOW';

    const banner = document.createElement('div');
    banner.id = 'sa-top-banner';
    banner.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; z-index: 2147483647;
        background: ${isCaution ? '#fef3c7' : '#fee2e2'}; color: ${isCaution ? '#92400e' : '#991b1b'};
        padding: 12px 24px; display: flex; align-items: center; justify-content: space-between;
        font-family: system-ui, sans-serif; box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        border-bottom: 1px solid ${isCaution ? '#f59e0b' : '#ef4444'};
        animation: sa-slide-down 0.3s ease-out;
    `;

    banner.innerHTML = `
        <div style="display: flex; align-items: center; gap: 12px;">
            <span style="font-size: 18px;">${isCaution ? '⚠️' : '🚨'}</span>
            <span><strong>Hydra Guard:</strong> ${result.reasons?.[0]?.message || 'Caution advised on this site.'}</span>
        </div>
        <button onclick="this.parentElement.remove()" style="background:transparent; border:none; color:inherit; font-weight:600; cursor:pointer; text-decoration:underline;">Dismiss</button>
    `;
    document.body.appendChild(banner);
}

function showReportModal() {
    if (document.getElementById('hydra-guard-report-modal')) return;
    const overlay = document.createElement('div');
    overlay.id = 'hydra-guard-report-modal';
    overlay.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0, 0, 0, 0.7); z-index: 2147483647;
        display: flex; align-items: center; justify-content: center;
        font-family: system-ui, sans-serif;
    `;

    overlay.innerHTML = `
        <div style="background: #1e1e1e; color: #fff; padding: 24px; border-radius: 12px; width: 400px; border: 1px solid #333;">
            <h3 style="margin: 0 0 16px 0; font-size: 18px;">Report Suspicious Site</h3>
            <div style="margin-bottom: 12px;">
                <label style="display: block; font-size: 11px; color: #aaa; margin-bottom: 4px;">URL</label>
                <input type="text" value="${window.location.href}" readonly style="width:100%; padding:8px; border-radius:6px; background:#111; color:#888; border:1px solid #333; box-sizing:border-box;">
            </div>
            <textarea id="sa-report-desc" placeholder="What looks suspicious?" style="width:100%; padding:8px; height:80px; border-radius:6px; background:#2a2a2a; color:#fff; border:1px solid #444; box-sizing:border-box;"></textarea>
            <div style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 20px;">
                <button id="sa-report-cancel" style="background:none; border:none; color:#aaa; cursor:pointer;">Cancel</button>
                <button id="sa-report-submit" style="background:#ef4444; color:#fff; border:none; padding:8px 16px; border-radius:6px; font-weight:600; cursor:pointer;">Submit Report</button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    document.getElementById('sa-report-cancel').onclick = () => overlay.remove();
    document.getElementById('sa-report-submit').onclick = async () => {
        const desc = document.getElementById('sa-report-desc').value;
        const btn = document.getElementById('sa-report-submit');
        btn.textContent = 'Submitting...';
        btn.disabled = true;

        const liveContext = detectContext();
        const liveMetadata = liveContext.type === 'email' ? detectEmailMetadata(liveContext) : null;

        const reportMetadata = {
            timestamp: new Date().toISOString(),
            title: document.title,
            body_text: liveMetadata?.bodySnippet || document.body.innerText.substring(0, 4000),
            sender: liveMetadata?.senderEmail || null,
            subject: liveMetadata?.subject || null,
            severity: currentScanResult?.overallSeverity || 'UNKNOWN',
            indicators: currentScanResult ? Object.values(currentScanResult.checks || {}).filter(c => c.flagged).map(c => c.description || c.title) : [],
            scan_result: currentScanResult || {}
        };

        chrome.runtime.sendMessage({
            type: MessageTypes.REPORT_SCAM,
            data: {
                url: window.location.href,
                description: desc,
                metadata: reportMetadata
            }
        }, (response) => {
            if (response?.success) {
                overlay.querySelector('div').innerHTML = `
                    <div style="text-align: center; padding: 20px;">
                        <div style="font-size: 48px; margin-bottom: 16px;">✅</div>
                        <h3 style="margin: 0 0 8px 0;">Report Submitted</h3>
                        <p style="color: #aaa; font-size: 14px;">Thank you for helping keep the community safe.</p>
                        <button onclick="document.getElementById('hydra-guard-report-modal').remove()" style="margin-top: 20px; background:#ef4444; color:#fff; border:none; padding:8px 24px; border-radius:6px; cursor:pointer;">Close</button>
                    </div>
                `;
            } else {
                alert('Failed to submit report. Please try again.');
                btn.textContent = 'Submit Report';
                btn.disabled = false;
            }
        });
    };
}

export function createOverlay(result) {
    if (warningAcknowledged) return;
    const existing = document.getElementById(OVERLAY_ID);
    if (existing) existing.remove();

    const container = document.createElement('div');
    container.id = OVERLAY_ID;
    container.style.zIndex = '2147483647';
    const shadow = container.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = `
        :host {
            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
            background: linear-gradient(135deg, #7f1d1d 0%, #450a0a 100%);
            z-index: 2147483647; display: flex; align-items: center; justify-content: center;
            font-family: system-ui, sans-serif; color: white; backdrop-filter: blur(10px);
        }
        .card {
            background: rgba(0, 0, 0, 0.4); backdrop-filter: blur(20px); border: 1px solid rgba(255, 255, 255, 0.1);
            padding: 3rem; border-radius: 1.5rem; max-width: 600px; text-align: center;
            animation: fadeIn 0.3s ease-out; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5);
        }
        h1 { font-size: 2.5rem; font-weight: 800; margin-bottom: 0.5rem; color: #fca5a5; }
        .subtitle { margin-bottom: 2rem; color: #fecaca; opacity: 0.9; }
        .finding-item { display: flex; gap: 0.75rem; align-items: flex-start; margin-bottom: 0.75rem; text-align: left; }
        .finding-icon { color: #f87171; font-weight: bold; margin-top: 2px; }
        .details-panel { 
            display: none; background: rgba(0,0,0,0.4); border-radius: 0.75rem; 
            margin-top: 1rem; border: 1px solid rgba(255,255,255,0.05);
            text-align: left; overflow: hidden;
        }
        .details-panel.visible { display: block; }
        .details-scroll { max-height: 250px; overflow-y: auto; padding: 1.25rem; }
        .details-scroll::-webkit-scrollbar { width: 6px; }
        .details-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
        
        .technical-row { margin-bottom: 0.75rem; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 0.75rem; }
        .technical-key { font-family: monospace; font-size: 0.75rem; color: #94a3b8; margin-bottom: 2px; }
        .technical-val { font-size: 0.85rem; color: #e2e8f0; line-height: 1.4; }

        .btn-toggle {
            background: rgba(255,255,255,0.05); color: #94a3b8; border: 1px solid rgba(255,255,255,0.1);
            padding: 0.5rem 1rem; border-radius: 0.5rem; font-size: 0.75rem; font-weight: 600;
            cursor: pointer; transition: all 0.2s; margin-top: 1.5rem;
        }
        .btn-toggle:hover { background: rgba(255,255,255,0.1); color: #cbd5e1; }
        
        button.primary { 
            background: #ef4444; color: white; border: none; padding: 1.15rem 2.5rem; 
            border-radius: 0.75rem; font-size: 1.1rem; font-weight: 700; cursor: pointer;
            box-shadow: 0 4px 14px rgba(239, 68, 68, 0.4); transition: transform 0.1s;
        }
        button.primary:active { transform: translateY(1px); }
        
        .footer-links { display: flex; justify-content: center; gap: 2rem; margin-top: 2rem; }
        .footer-link { background: none; border: none; color: #94a3b8; text-decoration: underline; cursor: pointer; font-size: 0.85rem; }
        .footer-link:hover { color: #cbd5e1; }

        @keyframes fadeIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
    `;
    shadow.appendChild(style);

    const wrapper = document.createElement('div');
    wrapper.className = 'card';
    
    // Helper to get friendly labels
    const getFriendlyLabel = (key) => {
        if (CHECK_LABELS[key]) return CHECK_LABELS[key];
        // Title Case Fallback: check_suspicious_keywords -> Suspicious Keywords
        return key.replace(/^(check_|analyze_)/, '').split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    };

    const flaggedChecks = Object.entries(result?.checks || {}).filter(([, c]) => c.flagged);
    
    const summaryList = flaggedChecks.map(([key]) => `
        <div class="finding-item">
            <span class="finding-icon">✕</span>
            <div style="font-weight: 600; font-size: 1rem;">${getFriendlyLabel(key)}</div>
        </div>
    `).join('');

    const technicalLog = flaggedChecks.map(([key, c]) => `
        <div class="technical-row">
            <div class="technical-key">${key}</div>
            <div class="technical-val">${c.details || c.description || 'No detail provided.'}</div>
        </div>
    `).join('');

    wrapper.innerHTML = `
        <h1>High Risk Detected</h1>
        <p class="subtitle">We recommend leaving this page immediately.</p>
        
        <div style="margin-bottom: 2rem;">
            ${summaryList}
        </div>

        <button class="primary" id="btn-back">Go back to safety</button>

        <button class="btn-toggle" id="btn-toggle-log">Show Diagnostic Log</button>
        
        <div id="pnl-details" class="details-panel">
            <div class="details-scroll">
                <div style="font-size: 0.75rem; font-weight: 800; color: #fca5a5; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 1rem;">
                    Diagnostic Log (Advanced)
                </div>
                ${technicalLog}
            </div>
        </div>

        <div class="footer-links">
            <button class="footer-link" id="btn-proceed">I understand the risks, proceed anyway</button>
            <button class="footer-link" id="btn-whitelist">Trust this site</button>
        </div>
    `;
    shadow.appendChild(wrapper);

    shadow.getElementById('btn-toggle-log').onclick = (e) => {
        const pnl = shadow.getElementById('pnl-details');
        const btn = e.target;
        const isVisible = pnl.classList.toggle('visible');
        btn.textContent = isVisible ? 'Hide Diagnostic Log' : 'Show Diagnostic Log';
        if (isVisible) pnl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    };

    const originalUrl = window.location.href;
    shadow.getElementById('btn-back').onclick = async () => {
        container.remove();
        chrome.runtime.sendMessage({ type: MessageTypes.NAVIGATE_BACK });
        window.history.back();
        setTimeout(() => {
            try {
                if (window.location.href === originalUrl && window.location.href !== 'about:blank') {
                    window.location.href = 'about:blank';
                }
            } catch (e) { }
        }, 500);
    };

    const cleanupAndDismiss = () => {
        container.remove();
        warningAcknowledged = true;
        try { window.sessionStorage.setItem('hydra_guard_suppressed', 'true'); } catch (e) { }
        _applyHighlightsIfEnabled(result);
    };

    shadow.getElementById('btn-proceed').onclick = cleanupAndDismiss;
    shadow.getElementById('btn-whitelist').onclick = () => {
        chrome.runtime.sendMessage({ type: MessageTypes.ADD_TO_WHITELIST, data: { domain: window.location.hostname } });
        cleanupAndDismiss();
    };

    container.onclick = (e) => e.stopPropagation();
    document.documentElement.appendChild(container);
}

function showDetectionToast(result) {
    if (warningAcknowledged || result.overallSeverity === 'SAFE' || result.overallSeverity === 'LOW') return;
    const existing = document.getElementById('hydra-guard-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'hydra-guard-toast';
    toast.style.cssText = `
        position: fixed; top: 20px; right: 20px; z-index: 2147483646;
        background: #1e293b; color: white; padding: 16px; border-radius: 12px;
        border-left: 4px solid ${result.overallSeverity === 'HIGH' || result.overallSeverity === 'CRITICAL' ? '#ef4444' : '#f59e0b'};
        font-family: system-ui, sans-serif; box-shadow: 0 10px 25px rgba(0,0,0,0.5);
    `;
    toast.innerHTML = `<div><strong>${result.overallSeverity} Risk Detected</strong></div><div style="font-size:13px; opacity:0.8;">Action recommended.</div>`;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 6000);
}

console.log('[Hydra Guard] Content script initialization complete. Ready for messages.');

// Listen for messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const { type, data, payload } = message;
    const result = data?.result || payload?.result;

    switch (type) {
        case MessageTypes.CONTEXT_DETECTED:
            break; // Handled by background
        case MessageTypes.HIDE_WARNING:
            const overlay = document.getElementById(OVERLAY_ID);
            if (overlay) {
                overlay.remove();
            }
            sendResponse({ success: true });
            break;
        case MessageTypes.SCAN_RESULT:
        case MessageTypes.SCAN_RESULT_UPDATED:
            currentScanResult = result;
            if (!warningAcknowledged) {
                showDetectionToast(result);
                _applyHighlightsIfEnabled(result);
            }
            sendResponse({ success: true });
            break;
        case MessageTypes.SHOW_WARNING:
            // BUG-151: On email clients, email-scanner.js handles its own native
            // dashboard UI. The web-page overlay (createOverlay) doesn't render
            // correctly in Gmail/Outlook, so we recuse and let email-scanner handle it.
            if (detectContext().type === 'email') {
                sendResponse({ success: true, deferred: 'email-scanner' });
                break;
            }
            currentScanResult = result;
            if (!warningAcknowledged) {
                createOverlay(result);
                _applyHighlightsIfEnabled(result);
            }
            sendResponse({ success: true });
            break;
        case MessageTypes.SHOW_BANNER:
            // BUG-151: Same recusal for banners on email clients
            if (detectContext().type === 'email') {
                sendResponse({ success: true, deferred: 'email-scanner' });
                break;
            }
            showTopBanner(result);
            sendResponse({ success: true });
            break;
        case MessageTypes.OPEN_REPORT_MODAL:
            showReportModal();
            sendResponse({ success: true });
            break;
        case MessageTypes.NAVIGATE_BACK:
            removeHighlights();
            window.history.back();
            sendResponse({ success: true });
            break;
        case MessageTypes.ANALYZE_PAGE:
            sendResponse({ success: true, data: collectPageSignals() });
            break;
        case MessageTypes.EXECUTE_SCAN:
            handleExecuteScan(payload || data).then(sendResponse);
            return true;
        default:
            // Do NOT respond to unknown types — other content scripts
            // (e.g. emailScanner.js) may handle them.
            return false; // Signal no async response from this listener
    }
    return true;
});

async function handleExecuteScan(options = {}) {
    const context = detectContext();
    const emailMetadata = context.type === 'email' ? detectEmailMetadata(context) : null;
    const scanOptions = {
        ...options,
        pageContent: emailMetadata?.bodySnippet || document.body.innerText.substring(0, 10000),
        context: context
    };
    try {
        const result = await scanUrl(window.location.href, scanOptions, (progress) => {
            chrome.runtime.sendMessage({ type: MessageTypes.SCAN_PROGRESS, data: progress });
        });
        currentScanResult = result;
        return { success: true, result };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

function collectPageSignals() {
    const isHttps = window.location.protocol === 'https:';
    const forms = Array.from(document.forms).slice(0, 5).map(f => ({
        hasPassword: !!f.querySelector('input[type="password"]'),
        hasCreditCard: !!f.querySelector('input[autocomplete*="cc" i], input[name*="card" i]')
    })).filter(f => f.hasPassword || f.hasCreditCard);

    const linkMismatches = Array.from(document.links).slice(0, 50).map(a => {
        const href = a.href.toLowerCase();
        const text = (a.innerText || a.textContent || '').toLowerCase();
        try {
            const hrefHost = new URL(href).hostname.replace('www.', '');
            const visibleHostMatch = text.match(/(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}/);
            const visibleHost = visibleHostMatch ? visibleHostMatch[0].replace('www.', '') : null;
            if (visibleHost && visibleHost !== hrefHost && !hrefHost.endsWith('.' + visibleHost)) {
                return { displayedHost: visibleHost, linkHost: hrefHost };
            }
        } catch (e) { }
        return null;
    }).filter(Boolean).slice(0, 5);

    return { isHttps, forms, linkMismatches };
}

