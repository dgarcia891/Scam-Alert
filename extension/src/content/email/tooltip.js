/**
 * Tooltip and Highlighting Logic
 * 
 * Features:
 * - Shadow DOM Tooltip for styling safety
 * - Range API highlighting to preserve DOM events
 * - Interactive Report False Positive form
 */

import { MessageTypes, sendMessage } from '../../lib/messaging.js';

let tooltipManager = null;
const metadataMap = new Map();

class TooltipManager {
    constructor() {
        this.container = document.createElement('div');
        this.container.id = 'hydra-guard-tooltip-root';
        Object.assign(this.container.style, {
            position: 'absolute',
            top: '0',
            left: '0',
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            zIndex: '2147483647'
        });

        this.shadow = this.container.attachShadow({ mode: 'open' });

        const style = document.createElement('style');
        style.textContent = `
            :host {
                font-family: system-ui, -apple-system, sans-serif;
            }
            .tooltip {
                position: absolute;
                background: #1e293b;
                color: #f8fafc;
                border: 1px solid #334155;
                border-radius: 12px;
                padding: 16px;
                width: 320px;
                box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);
                font-size: 14px;
                line-height: 1.5;
                display: none;
                pointer-events: auto;
                transition: opacity 0.2s, transform 0.2s;
                opacity: 0;
                transform: translateY(5px);
            }
            .tooltip.visible {
                display: block;
                opacity: 1;
                transform: translateY(0);
            }
            .header {
                font-weight: 600;
                color: #fca5a5;
                margin-bottom: 8px;
                font-size: 15px;
            }
            .description {
                color: #cbd5e1;
                margin-bottom: 12px;
            }
            .actions {
                border-top: 1px solid #334155;
                padding-top: 12px;
                margin-top: 12px;
            }
            .btn-link {
                background: none;
                border: none;
                color: #94a3b8;
                text-decoration: underline;
                cursor: pointer;
                font-size: 13px;
                padding: 0;
            }
            .btn-link:hover {
                color: #fff;
            }
            .form-container {
                display: none;
                margin-top: 12px;
                animation: slideDown 0.2s ease-out;
            }
            .form-container.active {
                display: block;
            }
            textarea {
                width: 100%;
                height: 60px;
                background: #0f172a;
                border: 1px solid #475569;
                border-radius: 6px;
                color: #f8fafc;
                padding: 8px;
                font-size: 13px;
                resize: vertical;
                box-sizing: border-box;
                font-family: inherit;
            }
            textarea:focus {
                outline: 1px solid #3b82f6;
                border-color: #3b82f6;
            }
            .consent {
                font-size: 11px;
                color: #64748b;
                margin: 8px 0;
                line-height: 1.3;
            }
            .form-actions {
                display: flex;
                gap: 8px;
                justify-content: flex-end;
            }
            button {
                padding: 6px 12px;
                border-radius: 6px;
                border: none;
                font-size: 13px;
                font-weight: 500;
                cursor: pointer;
            }
            .btn-primary {
                background: #3b82f6;
                color: white;
            }
            .btn-primary:hover:not(:disabled) { background: #2563eb; }
            .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
            .btn-secondary {
                background: #334155;
                color: white;
            }
            .btn-secondary:hover { background: #475569; }
            .status-message {
                margin-top: 12px;
                font-size: 13px;
                padding: 8px;
                border-radius: 6px;
                display: none;
            }
            .status-success {
                background: rgba(34, 197, 94, 0.2);
                color: #4ade80;
                border: 1px solid #22c55e;
            }
            .status-error {
                background: rgba(239, 68, 68, 0.2);
                color: #f87171;
                border: 1px solid #ef4444;
            }
            @keyframes slideDown {
                from { opacity: 0; transform: translateY(-5px); }
                to { opacity: 1; transform: translateY(0); }
            }
        `;

        this.tooltip = document.createElement('div');
        this.tooltip.className = 'tooltip';
        this.tooltip.innerHTML = `
            <div class="header" id="tt-header">Indicator</div>
            <div class="description" id="tt-desc">Description goes here</div>
            <div class="actions" id="tt-actions">
                <button class="btn-link" id="btn-report">Not what you think?</button>
            </div>
            <div class="form-container" id="tt-form">
                <textarea id="fp-reason" placeholder="Why is this not a scam? (Min 15 chars)"></textarea>
                <div class="consent">Submitting will send only the highlighted phrase and your comment for review.</div>
                <div class="form-actions">
                    <button class="btn-secondary" id="btn-cancel">Cancel</button>
                    <button class="btn-primary" id="btn-submit" disabled>Submit</button>
                </div>
            </div>
            <div class="status-message" id="tt-status"></div>
        `;

        this.shadow.appendChild(style);
        this.shadow.appendChild(this.tooltip);
        document.body.appendChild(this.container);

        this.isLocked = false;
        this.currentSpan = null;
        this.currentIssueId = null;

        this._bindEvents();
    }

    _bindEvents() {
        const btnReport = this.shadow.getElementById('btn-report');
        const btnCancel = this.shadow.getElementById('btn-cancel');
        const btnSubmit = this.shadow.getElementById('btn-submit');
        const textarea = this.shadow.getElementById('fp-reason');
        const form = this.shadow.getElementById('tt-form');
        const actions = this.shadow.getElementById('tt-actions');

        btnReport.addEventListener('click', () => {
            actions.style.display = 'none';
            form.classList.add('active');
            textarea.focus();
        });

        btnCancel.addEventListener('click', () => {
            this.resetForm();
            if (!this.tooltip.matches(':hover') && (!this.currentSpan || !this.currentSpan.matches(':hover'))) {
                this.hide(true);
            }
        });

        textarea.addEventListener('input', () => {
            btnSubmit.disabled = textarea.value.trim().length < 15;
        });

        btnSubmit.addEventListener('click', async () => {
            const explanation = textarea.value.trim();
            if (explanation.length < 15) return;

            btnSubmit.disabled = true;
            btnSubmit.textContent = 'Submitting...';

            const meta = metadataMap.get(this.currentIssueId);
            const payload = {
                issueId: this.currentIssueId,
                ruleId: meta.ruleId,
                issueType: meta.issueType,
                severity: meta.severity,
                phrase: meta.phrase,
                explanation: explanation,
                url: window.location.href,
                timestamp: Date.now()
            };

            console.warn("[DEBUG] SENDING MESSAGE", payload);
            try {
                const response = await sendMessage({
                    type: MessageTypes.REPORT_FALSE_POSITIVE,
                    data: payload
                });

                console.warn("[DEBUG] RESPONSE", response);

                if (response?.success) {
                    this.showStatus('Report submitted. Thank you!', false);
                    setTimeout(() => this.hide(true), 2000);
                } else {
                    this.showStatus(response?.error || 'Failed to submit.', true);
                    btnSubmit.disabled = false;
                    btnSubmit.textContent = 'Submit';
                }
            } catch (err) {
                console.warn("[DEBUG] CATCH ERROR", err);
                this.showStatus('Network error connection.', true);
                btnSubmit.disabled = false;
                btnSubmit.textContent = 'Submit';
            }
        });

        // Global ESC to close
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isLocked) {
                this.hide(true);
            }
        });

        // Click outside to close
        document.addEventListener('click', (e) => {
            if (!this.isLocked) return;
            const path = e.composedPath();
            // If click is not inside tooltip and not on the current span
            if (!path.includes(this.tooltip) && (!this.currentSpan || !path.includes(this.currentSpan))) {
                this.hide(true);
            }
        });
    }

    showStatus(msg, isError) {
        const form = this.shadow.getElementById('tt-form');
        const statusEl = this.shadow.getElementById('tt-status');
        form.classList.remove('active');
        statusEl.className = `status-message ${isError ? 'status-error' : 'status-success'}`;
        statusEl.textContent = msg;
        statusEl.style.display = 'block';
    }

    resetForm() {
        const form = this.shadow.getElementById('tt-form');
        const actions = this.shadow.getElementById('tt-actions');
        const textarea = this.shadow.getElementById('fp-reason');
        const btnSubmit = this.shadow.getElementById('btn-submit');
        const statusEl = this.shadow.getElementById('tt-status');

        form.classList.remove('active');
        actions.style.display = 'block';
        textarea.value = '';
        btnSubmit.disabled = true;
        btnSubmit.textContent = 'Submit';
        statusEl.style.display = 'none';
        statusEl.className = 'status-message';
    }

    show(span, issueId, isClick) {
        const meta = metadataMap.get(issueId);
        if (!meta) return;

        if (this.currentSpan !== span) {
            this.resetForm();
        }

        this.currentSpan = span;
        this.currentIssueId = issueId;

        if (isClick) {
            this.isLocked = !this.isLocked; // Toggle lock on click
            if (!this.isLocked) {
                this.hide(false);
                return;
            }
        } else {
            // Hover
            if (this.isLocked) return; // Ignore hover if locked
        }

        this.shadow.getElementById('tt-header').textContent = meta.title;
        this.shadow.getElementById('tt-desc').textContent = meta.details;

        const rect = span.getBoundingClientRect();

        // Calculate position (below the element, adjusting for screen edge)
        const scrollY = window.scrollY || document.documentElement.scrollTop;
        const scrollX = window.scrollX || document.documentElement.scrollLeft;

        let top = rect.bottom + scrollY + 8;
        let left = rect.left + scrollX;

        // Naive viewport adjustment
        if (left + 320 > window.innerWidth + scrollX) {
            left = window.innerWidth + scrollX - 340;
        }

        this.tooltip.style.top = `${top}px`;
        this.tooltip.style.left = `${left}px`;
        this.tooltip.classList.add("visible");
    }

    hide(force = false) {
        if (!force && this.isLocked) return;
        this.isLocked = false;
        this.tooltip.classList.remove('visible');
        this.currentSpan = null;
        this.currentIssueId = null;
    }
}

let globalEventsBound = false;

function initTooltipManager() {
    if (!tooltipManager) {
        tooltipManager = new TooltipManager();

        if (!globalEventsBound) {
            globalEventsBound = true;

            // Setup global event delegation for highlights
            document.addEventListener('mouseover', (e) => {
                const span = e.target.closest('.hydra-guard-highlight');
                if (span && tooltipManager) {
                    const issueId = span.getAttribute('data-scam-issue-id');
                    tooltipManager.show(span, issueId, false);
                }
            });

            document.addEventListener('mouseout', (e) => {
                const span = e.target.closest('.hydra-guard-highlight');
                if (span && tooltipManager && !tooltipManager.isLocked) {
                    tooltipManager.hide(false);
                }
            });

            document.addEventListener('click', (e) => {
                const span = e.target.closest('.hydra-guard-highlight');
                if (span && tooltipManager) {
                    e.preventDefault();
                    e.stopPropagation();
                    const issueId = span.getAttribute('data-scam-issue-id');
                    tooltipManager.show(span, issueId, true);
                }
            });
        }
    }
}

export function applyInPageHighlighting(result) {
    if (!result || !result.checks) return;

    initTooltipManager();

    // Generate stable CSS for the highlights
    if (!document.getElementById('hydra-guard-highlight-styles')) {
        const style = document.createElement('style');
        style.id = 'hydra-guard-highlight-styles';
        style.textContent = `
            .hydra-guard-highlight {
                background-color: rgba(225, 29, 72, 0.2) !important;
                border-bottom: 2px solid #e11d48 !important;
                cursor: pointer !important;
                border-radius: 2px;
                transition: background-color 0.2s;
            }
            .hydra-guard-highlight:hover {
                background-color: rgba(225, 29, 72, 0.4) !important;
            }
        `;
        document.head.appendChild(style);
    }

    let issueCounter = 0;
    const findings = Object.entries(result.checks).filter(([_, c]) => c.flagged && c.matches?.length);

    findings.forEach(([ruleId, f]) => {
        f.matches.forEach(match => {
            const issueId = `scam-issue-${++issueCounter}`;

            // Store Metadata
            metadataMap.set(issueId, {
                ruleId: ruleId,
                issueType: f.type || ruleId,
                severity: f.severity || 'HIGH',
                phrase: match,
                title: f.title || 'Suspicious Activity',
                details: f.details || f.description || 'This phrase matches known scam patterns.'
            });

            // Range API Highlighting
            const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
            let node;

            // Keep track of nodes to replace to avoid infinite loops during mutation
            const replacements = [];

            while (node = walker.nextNode()) {
                if (node.parentElement && node.parentElement.closest('.hydra-guard-highlight')) continue;
                if (node.parentElement && ['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(node.parentElement.tagName)) continue;

                const text = node.textContent;
                let index = text.toLowerCase().indexOf(match.toLowerCase());

                if (index !== -1) {
                    replacements.push({ node, index, length: match.length });
                }
            }

            // Apply replacements safely
            for (const { node, index, length } of replacements) {
                try {
                    const range = document.createRange();
                    range.setStart(node, index);
                    range.setEnd(node, index + length);

                    const span = document.createElement('span');
                    span.className = 'hydra-guard-highlight';
                    span.setAttribute('data-scam-issue-id', issueId);

                    range.surroundContents(span);
                } catch (e) {
                    // Ignore DOM exception if range is invalid (e.g. text node changed)

                }
            }
        });
    });
}

// For unit tests
export function _resetTooltipManager() {
    if (tooltipManager && tooltipManager.container.parentNode) {
        tooltipManager.container.remove();
    }
    tooltipManager = null;
    metadataMap.clear();
}
