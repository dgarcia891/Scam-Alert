/**
 * Scam Highlighter (v1.0.111)
 * Visualizes detected threats directly on the page with tooltips.
 *
 * Design decisions:
 * - Uses <mark> elements + TreeWalker (non-destructive to site layout)
 * - Tooltip is positioned as `fixed` so it works in scrolled documents
 * - Phrase string is safe-set via textContent, not innerHTML (XSS guard)
 * - Animation keyframe style is injected once and never removed until all
 *   highlights are cleaned up
 */

const HIGHLIGHT_CLASS = 'scam-alert-highlight';
const TOOLTIP_ID = 'scam-alert-tooltip';
const ANIMATION_STYLE_ID = 'sa-highlight-animation';

let activeTooltip = null;

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Main entry point. Collects visualIndicators from all checks and highlights
 * the matching phrases in the live DOM.
 * @param {object} scanResult  - The scan result object with a `checks` map.
 */
export function highlightDetections(scanResult) {
    if (!scanResult || !scanResult.checks) return;

    // 1. Collect all visualIndicators from every flagged check
    const allIndicators = [];
    Object.values(scanResult.checks).forEach(check => {
        if (check.visualIndicators && Array.isArray(check.visualIndicators)) {
            allIndicators.push(...check.visualIndicators);
        }
    });

    if (allIndicators.length === 0) return;

    // 2. Clear any existing highlights before applying new ones
    removeHighlights();

    // 3. Inject the animation keyframe once (shared by all highlights)
    _injectAnimationStyle();

    // 4. Sort longest phrase first to avoid partial double-wrapping
    allIndicators.sort((a, b) => b.phrase.length - a.phrase.length);

    allIndicators.forEach(indicator => _applyHighlight(indicator));
}

/**
 * Removes all highlights from the DOM and hides any active tooltip.
 * Safe to call even if no highlights exist.
 */
export function removeHighlights() {
    const highlights = document.querySelectorAll(`.${HIGHLIGHT_CLASS}`);
    highlights.forEach(h => {
        const parent = h.parentNode;
        if (parent) {
            parent.replaceChild(document.createTextNode(h.textContent), h);
            parent.normalize(); // Merge adjacent text nodes
        }
    });
    _hideTooltip();

    // Remove the animation style when there are no more highlights
    const style = document.getElementById(ANIMATION_STYLE_ID);
    if (style) style.remove();
}

// ─── Internal ────────────────────────────────────────────────────────────────

function _injectAnimationStyle() {
    if (document.getElementById(ANIMATION_STYLE_ID)) return; // Already present
    const style = document.createElement('style');
    style.id = ANIMATION_STYLE_ID;
    style.textContent = `
        @keyframes sa-tooltip-in {
            from { opacity: 0; transform: translateY(6px); }
            to   { opacity: 1; transform: translateY(0);   }
        }
        @keyframes sa-pulse {
            0%,100% { background-color: rgba(239, 68, 68, 0.12); }
            50%      { background-color: rgba(239, 68, 68, 0.28); }
        }
    `;
    document.head.appendChild(style);
}

function _applyHighlight(indicator) {
    const { phrase, category, reason } = indicator;
    // Strip fuzzy-match annotation (handles both 'Fuzzy Match' and 'fuzzy match')
    const cleanPhrase = phrase.replace(/\s*\(fuzzy\s+match\)/i, '').trim();
    if (!cleanPhrase) return;

    const regex = new RegExp(`(${_escapeRegExp(cleanPhrase)})`, 'gi');

    // Walk only text nodes — skip scripts, styles, and already-highlighted spans
    const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        {
            acceptNode: (node) => {
                const parent = node.parentElement;
                if (!parent) return NodeFilter.FILTER_REJECT;
                if (
                    parent.closest(`.${HIGHLIGHT_CLASS}`) ||
                    parent.closest('#scam-alert-overlay-root') ||
                    parent.closest(`#${TOOLTIP_ID}`) ||
                    ['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'INPUT'].includes(parent.tagName)
                ) return NodeFilter.FILTER_REJECT;

                // Reset lastIndex before test (global regex is stateful!)
                regex.lastIndex = 0;
                return regex.test(node.nodeValue)
                    ? NodeFilter.FILTER_ACCEPT
                    : NodeFilter.FILTER_SKIP;
            }
        }
    );

    // Collect first so mutations during replacement don't confuse the walker
    const nodesToProcess = [];
    while (walker.nextNode()) nodesToProcess.push(walker.currentNode);

    nodesToProcess.forEach(node => {
        const parent = node.parentElement;
        if (!parent) return;

        const text = node.nodeValue;
        const fragment = document.createDocumentFragment();
        let lastIdx = 0;

        // Reset lastIndex for the actual replace pass
        regex.lastIndex = 0;
        text.replace(regex, (match, _p1, offset) => {
            // Prepend any plain text before the match
            if (offset > lastIdx) {
                fragment.appendChild(document.createTextNode(text.substring(lastIdx, offset)));
            }

            // Build the highlight element
            const mark = document.createElement('mark');
            mark.className = HIGHLIGHT_CLASS;
            mark.textContent = match; // Safe – no innerHTML

            Object.assign(mark.style, {
                all: 'unset',
                display: 'inline',          // `all:unset` removes display — restore it
                backgroundColor: 'rgba(220, 38, 38, 0.12)', // red-600
                borderBottom: '2px dashed #dc2626',         // red-600
                borderRadius: '2px',
                color: 'inherit',
                cursor: 'help',
                position: 'relative',
                animation: 'sa-pulse 3s ease-in-out 0.5s 2', // Subtle pulse on load
                transition: 'background-color 0.2s'
            });

            mark.addEventListener('mouseenter', (e) => _showTooltip(e, { phrase: match, category, reason }));
            mark.addEventListener('mouseleave', _hideTooltip);

            fragment.appendChild(mark);
            lastIdx = offset + match.length;
        });

        // Remaining text after the last match
        if (lastIdx < text.length) {
            fragment.appendChild(document.createTextNode(text.substring(lastIdx)));
        }

        parent.replaceChild(fragment, node);
    });
}

function _showTooltip(event, { phrase, category, reason }) {
    // If we're already showing a tooltip for this specific element, ignore
    if (activeTooltip && activeTooltip.dataset.phrase === phrase && activeTooltip.dataset.target === event.target.textContent) {
        return;
    }

    _hideTooltip();

    const tooltip = document.createElement('div');
    tooltip.id = TOOLTIP_ID;
    tooltip.dataset.phrase = phrase;
    tooltip.dataset.target = event.target.textContent;

    // Base styles — position will be set after layout measurement
    Object.assign(tooltip.style, {
        position: 'fixed',
        zIndex: '2147483647',
        background: 'linear-gradient(145deg, #7f1d1d, #450a0a)', // Deep red (red-900)
        color: 'white',
        padding: '12px 16px',
        borderRadius: '10px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: '13px',
        lineHeight: '1.5',
        maxWidth: '270px',
        boxShadow: '0 12px 20px -4px rgba(0,0,0,0.7), 0 0 0 1px rgba(185,28,28,0.5)',
        border: '1px solid rgba(239,68,68,0.4)',
        pointerEvents: 'none',
        opacity: '0',           // Start invisible for measurement
        animation: 'sa-tooltip-in 0.2s ease-out forwards'
    });

    // Build tooltip contents with textContent (XSS-safe)
    const categoryEl = document.createElement('div');
    Object.assign(categoryEl.style, {
        fontWeight: '800',
        color: '#fca5a5',
        fontSize: '10px',
        textTransform: 'uppercase',
        letterSpacing: '0.07em',
        marginBottom: '4px'
    });
    categoryEl.textContent = category || 'Scam Indicator';

    const phraseEl = document.createElement('div');
    Object.assign(phraseEl.style, {
        fontWeight: '600',
        fontSize: '14px',
        marginBottom: '7px',
        color: '#fff'
    });
    phraseEl.textContent = `"${phrase}"`;

    const reasonEl = document.createElement('p');
    Object.assign(reasonEl.style, {
        color: '#fecaca',
        fontSize: '12px',
        margin: '0',
        lineHeight: '1.5'
    });
    reasonEl.textContent = reason;

    tooltip.appendChild(categoryEl);
    tooltip.appendChild(phraseEl);
    tooltip.appendChild(reasonEl);

    // Append to DOM first so getBoundingClientRect() gives real dimensions
    document.body.appendChild(tooltip);

    // Now measure and position
    const targetRect = event.target.getBoundingClientRect();
    const ttRect = tooltip.getBoundingClientRect();

    // Increase gap to 14px to move it further from the cursor hotspot
    let top = targetRect.top - ttRect.height - 14;
    let left = targetRect.left + (targetRect.width / 2) - (ttRect.width / 2);

    // Flip below if not enough room above
    if (top < 10) top = targetRect.bottom + 14;
    // Clamp to viewport edges
    if (left < 10) left = 10;
    if (left + ttRect.width > window.innerWidth - 10) {
        left = window.innerWidth - ttRect.width - 10;
    }
    // Make sure it doesn't go below the viewport either
    if (top + ttRect.height > window.innerHeight - 10) {
        top = targetRect.top - ttRect.height - 10;
    }

    tooltip.style.top = `${top}px`;
    tooltip.style.left = `${left}px`;
    tooltip.style.opacity = ''; // Let the animation handle fade-in

    activeTooltip = tooltip;
}

function _hideTooltip() {
    if (activeTooltip) {
        activeTooltip.remove();
        activeTooltip = null;
    }
}

function _escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
