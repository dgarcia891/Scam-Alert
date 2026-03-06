/**
 * Threat Dashboard UI
 */
import { openReportWorkflow } from './report-modal.js';
import { MessageTypes } from '../../lib/messaging.js';
import { extractEmailData } from './extraction-logic.js';

const DASHBOARD_ID = 'hydra-guard-threat-dashboard';

/**
 * Show the threat dashboard. Returns nothing.
 * @param {object} result - Scan result
 * @param {object} options
 * @param {Function} [options.onDismiss] - Called when the user actively closes the dashboard
 */
export function showThreatDashboard(result, { onDismiss } = {}) {
    const existing = document.getElementById(DASHBOARD_ID);
    if (existing) existing.remove();

    const container = document.createElement('div');
    container.id = DASHBOARD_ID;
    const shadow = container.attachShadow({ mode: 'open' });

    const isCritical = result.overallSeverity === 'CRITICAL' || result.overallSeverity === 'HIGH';
    const accentColor = isCritical ? '#e11d48' : '#f59e0b';
    const accentBg = isCritical ? 'rgba(225, 29, 72, 0.15)' : 'rgba(245, 158, 11, 0.15)';

    const style = document.createElement('style');
    style.textContent = `
        :host { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; pointer-events: none; z-index: 2147483647; display: flex; align-items: flex-start; justify-content: flex-end; padding: 24px; box-sizing: border-box; font-family: system-ui, sans-serif; }
        .sa-backdrop { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.3); backdrop-filter: blur(2px); pointer-events: auto; }
        .sa-card { position: relative; pointer-events: auto; background: #0f172a; color: #f8fafc; width: 440px; border-radius: 24px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.8); border: 1px solid ${accentColor}66; border-top: 6px solid ${accentColor}; overflow: hidden; animation: sa-slide-in 0.5s cubic-bezier(0.16, 1, 0.3, 1); }
        @keyframes sa-slide-in { from { transform: translateX(500px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        .sa-header { padding: 16px 20px; background: linear-gradient(to bottom, ${accentBg}, transparent); display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #1e293b; }
        .sa-title { font-weight: 900; color: ${accentColor}; }
        .sa-close { background: transparent; border: none; color: #64748b; cursor: pointer; font-size: 18px; padding: 4px 8px; }
        .sa-close:hover { color: #f8fafc; }
        .sa-content { padding: 24px; max-height: 80vh; overflow-y: auto; }
        .sa-badge { display: inline-block; padding: 6px 14px; background: ${accentColor}; color: white; border-radius: 99px; font-size: 11px; font-weight: 800; margin-bottom: 16px; }
        .sa-summary { font-size: 15px; line-height: 1.6; margin-bottom: 24px; }
        .sa-finding { background: rgba(30, 41, 59, 0.4); border: 1px solid #1e293b; border-radius: 16px; padding: 16px; margin-bottom: 12px; }
        .sa-jump-btn { background: ${accentColor}22; color: ${accentColor}; border: 1px solid ${accentColor}44; padding: 8px 14px; border-radius: 10px; cursor: pointer; font-size: 13px; font-weight: 600; transition: background 0.15s; }
        .sa-jump-btn:hover { background: ${accentColor}44; }
        .sa-footer { padding: 20px; background: #020617; border-top: 1px solid #1e293b; display: flex; flex-direction: column; gap: 12px; }
        .sa-btn { width: 100%; padding: 12px; border-radius: 12px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; border: 1px solid transparent; font-size: 14px; }
        .sa-btn-primary { background: rgba(225, 29, 72, 0.1); color: #fb7185; border-color: rgba(225, 29, 72, 0.2); }
        .sa-btn-primary:hover { background: rgba(225, 29, 72, 0.2); }
        .sa-btn-secondary { background: rgba(16, 185, 129, 0.1); color: #34d399; border-color: rgba(16, 185, 129, 0.2); }
        .sa-btn-secondary:hover { background: rgba(16, 185, 129, 0.2); }
        @keyframes sa-flash { 0%,100% { background-color: transparent; } 50% { background-color: rgba(239, 68, 68, 0.3); } }
    `;
    shadow.appendChild(style);

    const backdrop = document.createElement('div');
    backdrop.className = 'sa-backdrop';
    shadow.appendChild(backdrop);

    const findings = Object.values(result.checks || {}).filter(c => c.flagged);
    const findingsHtml = findings.map((f, idx) => `
        <div class="sa-finding">
            <div style="font-weight: 800; margin-bottom: 6px;">${f.title.toUpperCase()}</div>
            <div style="font-size: 13px; color: #94a3b8; margin-bottom: 14px;">${f.details || f.description}</div>
            ${f.matches?.length ? `<button class="sa-jump-btn" data-jump-idx="${idx}">Locate Indicator</button>` : ''}
        </div>
    `).join('');

    const card = document.createElement('div');
    card.className = 'sa-card';
    card.innerHTML = `
        <div class="sa-header">
            <div class="sa-title">HYDRA GUARD</div>
            <button class="sa-close" id="sa-close-btn">✕</button>
        </div>
        <div class="sa-content">
            <div class="sa-badge">${isCritical ? 'High Risk' : 'Suspicious'}</div>
            <div class="sa-summary">${result.summary || 'Indicators suggest this email may be unsafe.'}</div>
            ${findingsHtml}
        </div>
        <div class="sa-footer">
            <button class="sa-btn sa-btn-primary" id="sa-report-btn">Report Detected Scam</button>
            <button class="sa-btn sa-btn-secondary" id="sa-trust-btn">${result.metadata?.sender ? 'Always Trust Sender' : 'Always Trust Site'}</button>
        </div>
    `;

    shadow.appendChild(card);

    // ── Close / Dismiss ──────────────────────────────────────────────
    const close = () => {
        container.remove();
        if (onDismiss) onDismiss();
    };
    shadow.getElementById('sa-close-btn').onclick = close;
    backdrop.onclick = close;

    // ── Locate Indicator buttons ─────────────────────────────────────
    // Wire up click handlers for each "Locate Indicator" button.
    // Strategy: find the matching text in the host document (outside shadow DOM),
    // scroll to it, and flash-highlight it briefly.
    const jumpButtons = shadow.querySelectorAll('.sa-jump-btn[data-jump-idx]');
    jumpButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = parseInt(btn.dataset.jumpIdx, 10);
            const finding = findings[idx];
            if (!finding?.matches?.length) return;

            const searchText = finding.matches[0]
                .replace(/\s*\(fuzzy\s+match\)/i, '')
                .trim()
                .toLowerCase();

            if (!searchText) return;

            // 1. First try: look for Hydra Guard's own highlight marks
            const highlights = document.querySelectorAll('.hydra-guard-highlight');
            for (const el of highlights) {
                if (el.textContent.toLowerCase().includes(searchText)) {
                    _scrollAndFlash(el, container);
                    return;
                }
            }

            // 2. Fallback: walk text nodes in the page body to find the phrase
            const walker = document.createTreeWalker(
                document.body,
                NodeFilter.SHOW_TEXT,
                {
                    acceptNode: (node) => {
                        const parent = node.parentElement;
                        if (!parent) return NodeFilter.FILTER_REJECT;
                        if (['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(parent.tagName)) return NodeFilter.FILTER_REJECT;
                        if (parent.closest('#' + DASHBOARD_ID)) return NodeFilter.FILTER_REJECT;
                        return node.nodeValue.toLowerCase().includes(searchText)
                            ? NodeFilter.FILTER_ACCEPT
                            : NodeFilter.FILTER_SKIP;
                    }
                }
            );

            const targetNode = walker.nextNode();
            if (targetNode?.parentElement) {
                _scrollAndFlash(targetNode.parentElement, container);
            }
        });
    });

    // ── Report / Trust buttons ───────────────────────────────────────
    shadow.getElementById('sa-report-btn').onclick = () => openReportWorkflow(shadow, extractEmailData(), result);

    shadow.getElementById('sa-trust-btn').onclick = () => {
        const identity = result.metadata?.sender || window.location.hostname;
        chrome.runtime.sendMessage({ type: MessageTypes.ADD_TO_WHITELIST, data: { domain: identity } }, () => {
            alert('Whitelisted successfully.');
            close();
        });
    };

    document.body.appendChild(container);
}

/**
 * Scroll an element into view and apply a brief red flash to draw the eye.
 * Temporarily minimizes (not removes) the dashboard so the indicator is visible.
 */
function _scrollAndFlash(el, dashboardContainer) {
    // Briefly hide the backdrop so the user can see the highlighted text
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });

    // Apply a temporary flash outline
    const prev = el.style.cssText;
    el.style.outline = '3px solid #ef4444';
    el.style.outlineOffset = '2px';
    el.style.borderRadius = '4px';
    el.style.transition = 'outline-color 0.3s';

    // Remove after 3 seconds
    setTimeout(() => {
        el.style.cssText = prev;
    }, 3000);
}
