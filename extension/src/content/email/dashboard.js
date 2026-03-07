/**
 * Threat Dashboard UI (Locate Indicator V2)
 *
 * Phases:
 *   1. Persistent highlight — stays until user closes the minimized card
 *   2. Hover tooltip — explains why text was flagged, with "Not a threat?" link
 *   3. False-positive feedback — form → transparency preview → submit
 *   4. Cleanup on close — clears all highlights, tooltips, popovers
 */
import { openReportWorkflow } from './report-modal.js';
import { MessageTypes } from '../../lib/messaging.js';
import { extractEmailData } from './extraction-logic.js';

const DASHBOARD_ID = 'hydra-guard-threat-dashboard';
const LOCATE_TOOLTIP_ID = 'hydra-guard-locate-tooltip';
const LOCATE_FEEDBACK_ID = 'hydra-guard-locate-feedback';
const HIGHLIGHT_ATTR = 'data-hydra-locate';

// Gmail and Outlook email body selectors
const EMAIL_BODY_SELECTORS = [
    '.a3s.aiL',
    '.ii.gt',
    '[role="gridcell"] .a3s',
    '.rps_2003',
    '.rps_2016',
    '[aria-label="Message body"]',
    '.BodyFragment',
    '[data-test-id="message-view-body"]'
];

// ─── Module-level state for persistent highlights ────────────────────────────
let _locateHighlights = [];  // { el, prevStyle, listeners }
let _tooltipHideTimer = null;

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Show the threat dashboard.
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
        .sa-card { position: relative; pointer-events: auto; background: #0f172a; color: #f8fafc; width: 440px; max-height: calc(100vh - 48px); border-radius: 24px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.8); border: 1px solid ${accentColor}66; border-top: 6px solid ${accentColor}; overflow: hidden; display: flex; flex-direction: column; animation: sa-slide-in 0.5s cubic-bezier(0.16, 1, 0.3, 1); }
        .sa-card.sa-minimized { width: 320px; border-radius: 16px; }
        .sa-card.sa-minimized .sa-content, .sa-card.sa-minimized .sa-footer { display: none; }
        @keyframes sa-slide-in { from { transform: translateX(500px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        .sa-header { padding: 16px 20px; background: linear-gradient(to bottom, ${accentBg}, transparent); display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #1e293b; flex-shrink: 0; }
        .sa-title { font-weight: 900; color: ${accentColor}; }
        .sa-close { background: transparent; border: none; color: #64748b; cursor: pointer; font-size: 18px; padding: 4px 8px; }
        .sa-close:hover { color: #f8fafc; }
        .sa-content { padding: 24px; flex: 1 1 auto; overflow-y: auto; min-height: 0; }
        .sa-badge { display: inline-block; padding: 6px 14px; background: ${accentColor}; color: white; border-radius: 99px; font-size: 11px; font-weight: 800; margin-bottom: 16px; }
        .sa-summary { font-size: 15px; line-height: 1.6; margin-bottom: 24px; }
        .sa-finding { background: rgba(30, 41, 59, 0.4); border: 1px solid #1e293b; border-radius: 16px; padding: 16px; margin-bottom: 12px; }
        .sa-jump-btn { background: ${accentColor}22; color: ${accentColor}; border: 1px solid ${accentColor}44; padding: 8px 14px; border-radius: 10px; cursor: pointer; font-size: 13px; font-weight: 600; transition: background 0.15s; }
        .sa-jump-btn:hover { background: ${accentColor}44; }
        .sa-jump-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .sa-jump-feedback { font-size: 12px; color: #94a3b8; margin-top: 8px; display: none; }
        .sa-footer { padding: 20px; background: #020617; border-top: 1px solid #1e293b; display: flex; flex-direction: column; gap: 12px; flex-shrink: 0; }
        .sa-btn { width: 100%; padding: 12px; border-radius: 12px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; border: 1px solid transparent; font-size: 14px; }
        .sa-btn-primary { background: rgba(225, 29, 72, 0.1); color: #fb7185; border-color: rgba(225, 29, 72, 0.2); }
        .sa-btn-primary:hover { background: rgba(225, 29, 72, 0.2); }
        .sa-btn-secondary { background: rgba(16, 185, 129, 0.1); color: #34d399; border-color: rgba(16, 185, 129, 0.2); }
        .sa-btn-secondary:hover { background: rgba(16, 185, 129, 0.2); }
    `;
    shadow.appendChild(style);

    const backdrop = document.createElement('div');
    backdrop.className = 'sa-backdrop';
    shadow.appendChild(backdrop);

    const findings = Object.values(result.checks || {}).filter(c => c.flagged);
    const findingSearchPhrases = findings.map(f => _buildSearchPhrases(f));

    const findingsHtml = findings.map((f, idx) => {
        const isAI = f.title === 'ai_second_opinion';
        const hasLocatable = findingSearchPhrases[idx].length > 0;
        const matchedKeywords = (f.matches || []).filter(m => typeof m === 'string');

        // For AI card: show expandable details
        if (isAI) {
            const verdictLabel = f.verdict === 'DOWNGRADED' ? 'Likely Safe'
                : f.verdict === 'ESCALATED' ? 'Dangerous'
                : 'Suspicious';
            const verdictColor = f.verdict === 'DOWNGRADED' ? '#34d399'
                : f.verdict === 'ESCALATED' ? '#fb7185'
                : '#fbbf24';
            return `
                <div class="sa-finding" style="cursor: pointer;" data-ai-card>
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
                        <div style="font-weight: 800;">AI SECOND OPINION</div>
                        <div style="font-size: 10px; color: #64748b; background: rgba(100,116,139,0.1); padding: 2px 8px; border-radius: 6px; letter-spacing: 0.03em;">Auto-analyzed</div>
                    </div>
                    <div style="font-size: 13px; color: #94a3b8; margin-bottom: 10px;">${f.details || f.description}</div>
                    <div data-ai-details style="display: none; border-top: 1px solid #1e293b; padding-top: 12px; margin-top: 8px;">
                        <div style="display: flex; gap: 12px; margin-bottom: 10px;">
                            <div style="flex: 1;">
                                <div style="font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em;">Verdict</div>
                                <div style="font-size: 14px; font-weight: 700; color: ${verdictColor};">${verdictLabel}</div>
                            </div>
                            <div style="flex: 1;">
                                <div style="font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em;">Confidence</div>
                                <div style="font-size: 14px; font-weight: 700;">${f.confidence ?? '—'}%</div>
                            </div>
                        </div>
                        ${f.dataChecked ? `<div style="font-size: 11px; color: #64748b;">Analyzed: ${f.dataChecked}</div>` : ''}
                    </div>
                    <div data-ai-toggle style="font-size: 11px; color: #60a5fa; font-weight: 600; margin-top: 8px;">Show details ▾</div>
                </div>
            `;
        }

        // For non-AI cards: show Locate button if locatable, otherwise show matched keywords inline
        let actionHtml = '';
        if (hasLocatable) {
            actionHtml = `
                <button class="sa-jump-btn" data-jump-idx="${idx}">Locate Indicator</button>
                <div class="sa-jump-feedback" data-feedback-idx="${idx}"></div>
            `;
        } else if (matchedKeywords.length > 0) {
            // Show matched keywords as inline tags when we can't locate them
            const tags = matchedKeywords.slice(0, 8).map(k =>
                `<span style="display: inline-block; padding: 3px 8px; margin: 2px; background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.2); border-radius: 6px; font-size: 11px; color: #fca5a5;">${k}</span>`
            ).join('');
            actionHtml = `
                <div style="margin-top: 8px;">
                    <div style="font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px;">Matched keywords</div>
                    <div style="display: flex; flex-wrap: wrap; gap: 2px;">${tags}</div>
                </div>
            `;
        }

        return `
            <div class="sa-finding">
                <div style="font-weight: 800; margin-bottom: 6px;">${_humanizeTitle(f.title).toUpperCase()}</div>
                <div style="font-size: 13px; color: #94a3b8; margin-bottom: 14px;">${f.details || f.description}</div>
                ${actionHtml}
            </div>
        `;
    }).join('');

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

    // ── Close / Dismiss (Phase 4: full cleanup) ──────────────────────
    const close = () => {
        _clearLocateHighlights();
        _hideLocateTooltip();
        _hideLocateFeedback();
        container.remove();
        if (onDismiss) onDismiss();
    };
    shadow.getElementById('sa-close-btn').onclick = close;
    backdrop.onclick = close;

    // ── Locate Indicator buttons (Phase 1 + 2) ──────────────────────
    const jumpButtons = shadow.querySelectorAll('.sa-jump-btn[data-jump-idx]');
    jumpButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = parseInt(btn.dataset.jumpIdx, 10);
            const phrases = findingSearchPhrases[idx];
            const finding = findings[idx];
            if (!phrases || phrases.length === 0) return;

            // Clear any previous locate highlights before applying new ones
            _clearLocateHighlights();
            _hideLocateTooltip();
            _hideLocateFeedback();

            // Minimize the dashboard
            _minimizeDashboard(shadow, card, backdrop);

            // Find the email body container
            const emailBody = _findEmailBody();

            // Try each phrase (longest first)
            let found = false;
            let matchedPhrase = '';
            for (const phrase of phrases) {
                const searchText = phrase
                    .replace(/\s*\(fuzzy\s+match\)/i, '')
                    .trim()
                    .toLowerCase();

                if (!searchText || searchText.length < 3) continue;

                const searchRoot = emailBody || document.body;

                // Build search variants: full phrase first, then progressively
                // shorter substrings (for fuzzy matches where exact text differs)
                const searchVariants = [searchText];
                const words = searchText.split(/\s+/);
                if (words.length >= 4) {
                    // Try dropping last word, then first word
                    searchVariants.push(words.slice(0, -1).join(' '));
                    searchVariants.push(words.slice(1).join(' '));
                    // Try middle chunk (drop first and last word)
                    if (words.length >= 5) {
                        searchVariants.push(words.slice(1, -1).join(' '));
                    }
                }

                for (const variant of searchVariants) {
                    if (variant.length < 3) continue;

                    // 1. Try Hydra Guard highlight marks inside email body
                    const highlights = searchRoot.querySelectorAll('.hydra-guard-highlight');
                    for (const el of highlights) {
                        if (el.textContent.toLowerCase().includes(variant)) {
                            _applyPersistentHighlight(el, finding, phrase);
                            found = true;
                            matchedPhrase = phrase;
                            break;
                        }
                    }
                    if (found) break;

                    // 2. TreeWalker on the email body
                    const targetEl = _findTextInElement(searchRoot, variant);
                    if (targetEl) {
                        _applyPersistentHighlight(targetEl, finding, phrase);
                        found = true;
                        matchedPhrase = phrase;
                        break;
                    }

                    // 3. Fallback to full document.body
                    if (emailBody && emailBody !== document.body) {
                        const fallbackEl = _findTextInElement(document.body, variant);
                        if (fallbackEl) {
                            _applyPersistentHighlight(fallbackEl, finding, phrase);
                            found = true;
                            matchedPhrase = phrase;
                            break;
                        }
                    }
                }
                if (found) break;
            }

            // Show feedback if nothing was found
            const feedback = shadow.querySelector(`[data-feedback-idx="${idx}"]`);
            if (!found && feedback) {
                feedback.style.display = 'block';
                feedback.textContent = 'Could not locate the exact text. This may be a pattern-based or fuzzy detection rather than an exact phrase match.';
                setTimeout(() => { feedback.style.display = 'none'; }, 5000);
            }
        });
    });

    // ── AI Second Opinion card: toggle details ─────────────────────
    const aiCards = shadow.querySelectorAll('[data-ai-card]');
    aiCards.forEach(card => {
        const details = card.querySelector('[data-ai-details]');
        const toggle = card.querySelector('[data-ai-toggle]');
        if (details && toggle) {
            card.addEventListener('click', () => {
                const isHidden = details.style.display === 'none';
                details.style.display = isHidden ? 'block' : 'none';
                toggle.textContent = isHidden ? 'Hide details ▴' : 'Show details ▾';
            });
        }
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

// ─── Phase 1: Persistent Highlight ──────────────────────────────────────────

/**
 * Apply a persistent red highlight to an element. Stays until _clearLocateHighlights().
 * Also wires up hover tooltip (Phase 2).
 */
function _applyPersistentHighlight(el, finding, matchedPhrase) {
    // Save original style so we can restore it
    const prevStyle = el.style.cssText;

    el.style.outline = '3px solid #ef4444';
    el.style.outlineOffset = '2px';
    el.style.backgroundColor = 'rgba(239, 68, 68, 0.08)';
    el.style.borderRadius = '4px';
    el.setAttribute(HIGHLIGHT_ATTR, 'true');

    // Scroll into view
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });

    // ── Phase 2: Wire hover tooltip ──────────────────────────────────
    const onEnter = () => {
        clearTimeout(_tooltipHideTimer);
        _showLocateTooltip(el, finding, matchedPhrase);
    };
    const onLeave = () => {
        // Delay hide so user can move mouse into the tooltip itself
        _tooltipHideTimer = setTimeout(() => _hideLocateTooltip(), 400);
    };

    el.addEventListener('mouseenter', onEnter);
    el.addEventListener('mouseleave', onLeave);

    _locateHighlights.push({ el, prevStyle, listeners: { onEnter, onLeave } });
}

/**
 * Clear all persistent locate highlights and restore original styles.
 */
function _clearLocateHighlights() {
    for (const item of _locateHighlights) {
        item.el.style.cssText = item.prevStyle;
        item.el.removeAttribute(HIGHLIGHT_ATTR);
        item.el.removeEventListener('mouseenter', item.listeners.onEnter);
        item.el.removeEventListener('mouseleave', item.listeners.onLeave);
    }
    _locateHighlights = [];
}

// ─── Phase 2: Hover Tooltip ─────────────────────────────────────────────────

/**
 * Show a tooltip near the highlighted element explaining why it was flagged.
 * Includes a "Not a threat? Let us know" link that opens the feedback form.
 */
function _showLocateTooltip(el, finding, matchedPhrase) {
    _hideLocateTooltip(); // Remove any existing tooltip first

    // Resolve explanation data
    const viMatch = (finding.visualIndicators || []).find(vi =>
        vi.phrase && matchedPhrase.toLowerCase().includes(vi.phrase.toLowerCase())
    );
    const category = viMatch?.category || _humanizeTitle(finding.title) || 'Scam Indicator';
    const reason = viMatch?.reason || finding.details || finding.description || 'This was flagged based on known scam patterns.';
    const displayPhrase = matchedPhrase.replace(/\s*\(fuzzy\s+match\)/i, '').trim();

    const tooltip = document.createElement('div');
    tooltip.id = LOCATE_TOOLTIP_ID;

    Object.assign(tooltip.style, {
        position: 'fixed',
        zIndex: '2147483647',
        background: 'linear-gradient(145deg, #1e293b, #0f172a)',
        color: 'white',
        padding: '16px 18px',
        borderRadius: '12px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: '13px',
        lineHeight: '1.5',
        maxWidth: '300px',
        boxShadow: '0 16px 32px -4px rgba(0,0,0,0.6), 0 0 0 1px rgba(239,68,68,0.3)',
        border: '1px solid rgba(239, 68, 68, 0.3)',
        opacity: '0',
        transform: 'translateY(6px)',
        transition: 'opacity 0.2s ease-out, transform 0.2s ease-out'
    });

    // Category label
    const catEl = document.createElement('div');
    Object.assign(catEl.style, {
        fontWeight: '800',
        color: '#fca5a5',
        fontSize: '10px',
        textTransform: 'uppercase',
        letterSpacing: '0.07em',
        marginBottom: '4px'
    });
    catEl.textContent = category;

    // Matched phrase
    const phraseEl = document.createElement('div');
    Object.assign(phraseEl.style, {
        fontWeight: '600',
        fontSize: '14px',
        marginBottom: '8px',
        color: '#fff'
    });
    phraseEl.textContent = `"${displayPhrase}"`;

    // Reason
    const reasonEl = document.createElement('p');
    Object.assign(reasonEl.style, {
        color: '#cbd5e1',
        fontSize: '12px',
        margin: '0 0 12px 0',
        lineHeight: '1.5'
    });
    reasonEl.textContent = reason;

    // Divider
    const divider = document.createElement('div');
    Object.assign(divider.style, {
        borderTop: '1px solid rgba(255,255,255,0.1)',
        margin: '0 0 10px 0'
    });

    // "Not a threat?" link
    const feedbackLink = document.createElement('button');
    Object.assign(feedbackLink.style, {
        background: 'none',
        border: 'none',
        color: '#60a5fa',
        cursor: 'pointer',
        fontSize: '12px',
        fontWeight: '600',
        padding: '0',
        textDecoration: 'underline',
        textUnderlineOffset: '2px',
        fontFamily: 'inherit'
    });
    feedbackLink.textContent = 'Not a threat? Let us know';
    feedbackLink.addEventListener('click', (e) => {
        e.stopPropagation();
        _hideLocateTooltip();
        _showLocateFeedback(el, finding, matchedPhrase, category);
    });

    tooltip.appendChild(catEl);
    tooltip.appendChild(phraseEl);
    tooltip.appendChild(reasonEl);
    tooltip.appendChild(divider);
    tooltip.appendChild(feedbackLink);

    // Hover-intent: keep tooltip open when mouse moves into it
    tooltip.addEventListener('mouseenter', () => clearTimeout(_tooltipHideTimer));
    tooltip.addEventListener('mouseleave', () => {
        _tooltipHideTimer = setTimeout(() => _hideLocateTooltip(), 400);
    });

    document.body.appendChild(tooltip);

    // Position
    const rect = el.getBoundingClientRect();
    const ttRect = tooltip.getBoundingClientRect();
    let top = rect.top - ttRect.height - 12;
    let left = rect.left + (rect.width / 2) - (ttRect.width / 2);

    // Flip below if no room above
    if (top < 10) top = rect.bottom + 12;
    // Clamp to viewport
    if (left < 10) left = 10;
    if (left + ttRect.width > window.innerWidth - 10) left = window.innerWidth - ttRect.width - 10;
    if (top + ttRect.height > window.innerHeight - 10) top = rect.top - ttRect.height - 10;

    tooltip.style.top = `${top}px`;
    tooltip.style.left = `${left}px`;

    // Animate in
    requestAnimationFrame(() => {
        tooltip.style.opacity = '1';
        tooltip.style.transform = 'translateY(0)';
    });
}

function _hideLocateTooltip() {
    clearTimeout(_tooltipHideTimer);
    const existing = document.getElementById(LOCATE_TOOLTIP_ID);
    if (existing) existing.remove();
}

// ─── Phase 3: False-Positive Feedback Flow ──────────────────────────────────

/**
 * Show the feedback form near the highlighted element.
 * Step 1: Reason selection → Step 2: Transparency preview → Step 3: Submit
 */
function _showLocateFeedback(el, finding, matchedPhrase, category) {
    _hideLocateFeedback(); // Remove any existing

    const displayPhrase = matchedPhrase.replace(/\s*\(fuzzy\s+match\)/i, '').trim();
    const panel = document.createElement('div');
    panel.id = LOCATE_FEEDBACK_ID;

    Object.assign(panel.style, {
        position: 'fixed',
        zIndex: '2147483647',
        background: '#0f172a',
        color: '#f8fafc',
        padding: '0',
        borderRadius: '16px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: '13px',
        lineHeight: '1.5',
        width: '340px',
        boxShadow: '0 20px 40px -8px rgba(0,0,0,0.7), 0 0 0 1px rgba(96,165,250,0.3)',
        border: '1px solid rgba(96, 165, 250, 0.3)',
        overflow: 'hidden',
        opacity: '0',
        transform: 'translateY(6px)',
        transition: 'opacity 0.2s ease-out, transform 0.2s ease-out'
    });

    // ── Step 1: Reason form ──────────────────────────────────────────
    panel.innerHTML = `
        <div style="padding: 18px 20px 14px; border-bottom: 1px solid #1e293b;">
            <div style="font-weight: 800; font-size: 15px; margin-bottom: 2px;">Tell Us Why This Isn't a Threat</div>
            <div style="font-size: 11px; color: #64748b;">Your feedback helps us improve</div>
        </div>
        <div style="padding: 16px 20px;" id="hg-fb-body">
            <label style="display: flex; align-items: flex-start; gap: 10px; padding: 10px 0; cursor: pointer; border-bottom: 1px solid #1e293b22;">
                <input type="radio" name="hg-fb-reason" value="legitimate_email" style="margin-top: 2px; accent-color: #60a5fa;">
                <span>This is a legitimate email</span>
            </label>
            <label style="display: flex; align-items: flex-start; gap: 10px; padding: 10px 0; cursor: pointer; border-bottom: 1px solid #1e293b22;">
                <input type="radio" name="hg-fb-reason" value="trusted_sender" style="margin-top: 2px; accent-color: #60a5fa;">
                <span>I know and trust this sender</span>
            </label>
            <label style="display: flex; align-items: flex-start; gap: 10px; padding: 10px 0; cursor: pointer; border-bottom: 1px solid #1e293b22;">
                <input type="radio" name="hg-fb-reason" value="normal_phrase" style="margin-top: 2px; accent-color: #60a5fa;">
                <span>This word/phrase is used normally here</span>
            </label>
            <label style="display: flex; align-items: flex-start; gap: 10px; padding: 10px 0; cursor: pointer;">
                <input type="radio" name="hg-fb-reason" value="other" style="margin-top: 2px; accent-color: #60a5fa;">
                <span>Other reason</span>
            </label>
            <textarea id="hg-fb-note" placeholder="Add a note (optional)" style="
                width: 100%; margin-top: 12px; padding: 10px 12px; border-radius: 8px;
                background: #1e293b; color: #f8fafc; border: 1px solid #334155;
                font-family: inherit; font-size: 13px; resize: vertical; min-height: 48px;
                box-sizing: border-box;
            "></textarea>
        </div>
        <div id="hg-fb-buttons" style="padding: 12px 20px 16px; display: flex; gap: 10px;">
            <button id="hg-fb-cancel" style="
                flex: 1; padding: 10px; border-radius: 10px; font-weight: 600;
                cursor: pointer; font-size: 13px; font-family: inherit;
                background: transparent; color: #94a3b8; border: 1px solid #334155;
            ">Cancel</button>
            <button id="hg-fb-review" style="
                flex: 1; padding: 10px; border-radius: 10px; font-weight: 700;
                cursor: pointer; font-size: 13px; font-family: inherit;
                background: rgba(96, 165, 250, 0.15); color: #60a5fa; border: 1px solid rgba(96, 165, 250, 0.3);
            ">Review Before Sending</button>
        </div>
    `;

    document.body.appendChild(panel);

    // Position near the highlighted element
    _positionNearElement(panel, el);

    // Animate in
    requestAnimationFrame(() => {
        panel.style.opacity = '1';
        panel.style.transform = 'translateY(0)';
    });

    // ── Wire Step 1 buttons ──────────────────────────────────────────
    panel.querySelector('#hg-fb-cancel').addEventListener('click', () => _hideLocateFeedback());

    panel.querySelector('#hg-fb-review').addEventListener('click', () => {
        const selected = panel.querySelector('input[name="hg-fb-reason"]:checked');
        if (!selected) {
            // Briefly highlight the radio buttons
            const labels = panel.querySelectorAll('label');
            labels.forEach(l => { l.style.transition = 'background 0.3s'; l.style.background = 'rgba(239,68,68,0.1)'; });
            setTimeout(() => labels.forEach(l => { l.style.background = ''; }), 800);
            return;
        }

        const userReason = selected.value;
        const userNote = (panel.querySelector('#hg-fb-note').value || '').trim();
        const reasonLabels = {
            legitimate_email: 'This is a legitimate email',
            trusted_sender: 'I know and trust this sender',
            normal_phrase: 'This word/phrase is used normally here',
            other: 'Other reason'
        };

        // ── Step 2: Transparency preview ─────────────────────────────
        _showTransparencyPreview(panel, {
            displayPhrase,
            category,
            userReasonLabel: reasonLabels[userReason],
            userReason,
            userNote,
            finding,
            pageHost: window.location.hostname
        });
    });
}

/**
 * Step 2: Show the user exactly what data will be sent.
 */
function _showTransparencyPreview(panel, data) {
    const { displayPhrase, category, userReasonLabel, userReason, userNote, finding, pageHost } = data;

    const body = panel.querySelector('#hg-fb-body');
    if (!body) return;

    // Replace the form with the preview
    body.innerHTML = `
        <div style="margin-bottom: 14px;">
            <div style="font-size: 11px; color: #64748b; margin-bottom: 3px;">FLAGGED TEXT</div>
            <div style="font-size: 14px; font-weight: 600; color: #fca5a5;">"${_escapeHtml(displayPhrase)}"</div>
        </div>
        <div style="margin-bottom: 14px;">
            <div style="font-size: 11px; color: #64748b; margin-bottom: 3px;">DETECTION CATEGORY</div>
            <div style="font-size: 13px;">${_escapeHtml(category)}</div>
        </div>
        <div style="margin-bottom: 14px;">
            <div style="font-size: 11px; color: #64748b; margin-bottom: 3px;">YOUR REASON</div>
            <div style="font-size: 13px;">${_escapeHtml(userReasonLabel)}</div>
        </div>
        ${userNote ? `
        <div style="margin-bottom: 14px;">
            <div style="font-size: 11px; color: #64748b; margin-bottom: 3px;">YOUR NOTE</div>
            <div style="font-size: 13px; color: #cbd5e1;">"${_escapeHtml(userNote)}"</div>
        </div>
        ` : ''}
        <div style="margin-bottom: 14px;">
            <div style="font-size: 11px; color: #64748b; margin-bottom: 3px;">PAGE</div>
            <div style="font-size: 13px;">${_escapeHtml(pageHost)} (email context)</div>
        </div>
        <div style="background: rgba(96,165,250,0.08); border: 1px solid rgba(96,165,250,0.15); border-radius: 8px; padding: 10px 12px; font-size: 11px; color: #94a3b8; line-height: 1.5;">
            This will be sent to Hydra Guard's review team to improve detection accuracy. No personal email content beyond the flagged text above is included.
        </div>
    `;

    // Update header
    const header = panel.querySelector('div:first-child');
    if (header) {
        header.querySelector('div:first-child').textContent = "Here's What Will Be Sent";
        header.querySelector('div:last-child').textContent = 'Review the information below';
    }

    // Update buttons
    const btnContainer = panel.querySelector('#hg-fb-buttons');
    if (btnContainer) {
        btnContainer.innerHTML = `
            <button id="hg-fb-back" style="
                flex: 1; padding: 10px; border-radius: 10px; font-weight: 600;
                cursor: pointer; font-size: 13px; font-family: inherit;
                background: transparent; color: #94a3b8; border: 1px solid #334155;
            ">Cancel</button>
            <button id="hg-fb-send" style="
                flex: 1; padding: 10px; border-radius: 10px; font-weight: 700;
                cursor: pointer; font-size: 13px; font-family: inherit;
                background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.3);
            ">Send Feedback</button>
        `;

        btnContainer.querySelector('#hg-fb-back').addEventListener('click', () => _hideLocateFeedback());

        btnContainer.querySelector('#hg-fb-send').addEventListener('click', () => {
            // ── Step 3: Submit ────────────────────────────────────────
            const payload = {
                flaggedText: displayPhrase,
                checkTitle: finding.title || '',
                category: category,
                userReason: userReason,
                userNote: userNote || '',
                pageUrl: pageHost,
                timestamp: Date.now()
            };

            try {
                chrome.runtime.sendMessage({
                    type: MessageTypes.REPORT_FALSE_POSITIVE,
                    data: payload
                });
            } catch (e) {
                console.error('[Hydra Guard] Failed to send feedback:', e);
            }

            // Show thank you state
            panel.innerHTML = `
                <div style="padding: 32px 20px; text-align: center;">
                    <div style="font-size: 36px; margin-bottom: 12px;">✓</div>
                    <div style="font-weight: 800; font-size: 16px; margin-bottom: 6px;">Thank You</div>
                    <div style="font-size: 13px; color: #94a3b8;">Your feedback has been submitted for review.</div>
                </div>
            `;

            setTimeout(() => _hideLocateFeedback(), 2500);
        });
    }
}

function _hideLocateFeedback() {
    const existing = document.getElementById(LOCATE_FEEDBACK_ID);
    if (existing) existing.remove();
}

// ─── Shared Helpers ─────────────────────────────────────────────────────────

function _buildSearchPhrases(finding) {
    const phrases = [];
    const seen = new Set();

    // Known high-level labels that are NOT actual email text — skip these for search.
    // These are indicator category names generated by email-heuristics.js, NOT text
    // that actually appears in the email body.
    const LABEL_PHRASES = new Set([
        'gift card payment request',
        'official name from personal email address',
        'suspicious financial request',
        'authority pressure + secrecy language',
        'vague social lure with external link',
        // Common description-style strings that aren't real email text
        'email scam indicators',
        'urgent wording',
        'no risky forms or links found',
        'no email-specific scams detected',
    ]);

    // 1. Pull from matches FIRST (these are actual keywords found in the email)
    if (Array.isArray(finding.matches)) {
        for (const m of finding.matches) {
            const p = (typeof m === 'string' ? m : '').replace(/\s*\(fuzzy\s+match\)/i, '').trim();
            if (p && p.length >= 4 && !seen.has(p.toLowerCase()) && !LABEL_PHRASES.has(p.toLowerCase())) {
                seen.add(p.toLowerCase());
                phrases.push(p);
            }
        }
    }

    // 2. Then pull from visualIndicators, but skip label-style phrases
    if (Array.isArray(finding.visualIndicators)) {
        for (const vi of finding.visualIndicators) {
            const p = (vi.phrase || '').replace(/\s*\(fuzzy\s+match\)/i, '').trim();
            if (p && p.length >= 4 && !seen.has(p.toLowerCase()) && !LABEL_PHRASES.has(p.toLowerCase())) {
                seen.add(p.toLowerCase());
                phrases.push(p);
            }
        }
    }

    // Sort: prefer longer phrases (more specific), but cap search to top 6
    phrases.sort((a, b) => b.length - a.length);
    return phrases.slice(0, 6);
}

function _findEmailBody() {
    for (const sel of EMAIL_BODY_SELECTORS) {
        const el = document.querySelector(sel);
        if (el) return el;
    }
    return null;
}

function _findTextInElement(root, searchText) {
    const walker = document.createTreeWalker(
        root,
        NodeFilter.SHOW_TEXT,
        {
            acceptNode: (node) => {
                const parent = node.parentElement;
                if (!parent) return NodeFilter.FILTER_REJECT;
                if (['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(parent.tagName)) return NodeFilter.FILTER_REJECT;
                if (parent.closest('#' + DASHBOARD_ID)) return NodeFilter.FILTER_REJECT;
                if (parent.closest('#' + LOCATE_TOOLTIP_ID)) return NodeFilter.FILTER_REJECT;
                if (parent.closest('#' + LOCATE_FEEDBACK_ID)) return NodeFilter.FILTER_REJECT;
                return node.nodeValue.toLowerCase().includes(searchText)
                    ? NodeFilter.FILTER_ACCEPT
                    : NodeFilter.FILTER_SKIP;
            }
        }
    );

    const targetNode = walker.nextNode();
    return targetNode?.parentElement || null;
}

function _minimizeDashboard(shadow, card, backdrop) {
    backdrop.style.display = 'none';
    card.classList.add('sa-minimized');

    const header = card.querySelector('.sa-header');
    if (header && !header.dataset.restoreWired) {
        header.dataset.restoreWired = 'true';
        header.style.cursor = 'pointer';
        header.addEventListener('click', (e) => {
            if (e.target.classList.contains('sa-close')) return;
            backdrop.style.display = '';
            card.classList.remove('sa-minimized');
        });
    }
}

/**
 * Position a panel near a target element, preferring below-right.
 */
function _positionNearElement(panel, el) {
    const rect = el.getBoundingClientRect();
    const pRect = panel.getBoundingClientRect();

    let top = rect.bottom + 12;
    let left = rect.left;

    // If no room below, go above
    if (top + pRect.height > window.innerHeight - 10) {
        top = rect.top - pRect.height - 12;
    }
    // Clamp horizontally
    if (left + pRect.width > window.innerWidth - 10) {
        left = window.innerWidth - pRect.width - 10;
    }
    if (left < 10) left = 10;
    // Clamp vertically
    if (top < 10) top = 10;

    panel.style.top = `${top}px`;
    panel.style.left = `${left}px`;
}

/**
 * Convert a check title like "check_urgency_signals" to "Urgency Signals".
 */
function _humanizeTitle(title) {
    if (!title) return '';
    return title
        .replace(/^check_/, '')
        .replace(/^analyze_/, '')
        .replace(/_/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Escape HTML special characters (XSS-safe for innerHTML).
 */
function _escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}
