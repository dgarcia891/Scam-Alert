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

const HIGHLIGHT_CLASS = 'hydra-guard-highlight';
const ANIMATION_STYLE_ID = 'sa-highlight-animation';

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Main entry point. Collects visualIndicators from all checks and highlights
 * the matching phrases in the live DOM.
 * @param {object} scanResult  - The scan result object with a `checks` map.
 */
export function highlightDetections(scanResult) {
    if (!scanResult || !scanResult.checks) return;

    // 1. Collect visualIndicators only from FLAGGED checks
    const allIndicators = [];
    Object.values(scanResult.checks).forEach(check => {
        if (check.flagged && check.visualIndicators && Array.isArray(check.visualIndicators)) {
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
    if (!cleanPhrase || cleanPhrase.length <= 3) return;

    // Fast path: single-node TreeWalker (existing logic, handles 80%+ of cases)
    const fastPathMatches = _applyHighlightSingleNode(cleanPhrase);

    // Slow path: cross-node TextNodeMap fallback (for phrases split by <b>, <span>, etc.)
    if (fastPathMatches === 0) {
        _applyHighlightCrossNode(cleanPhrase);
    }
}

/**
 * Fast path: highlights a phrase that exists entirely within a single TextNode.
 * Returns the number of matches found.
 */
function _applyHighlightSingleNode(cleanPhrase) {
    const regex = new RegExp(`(${_escapeRegExp(cleanPhrase)})`, 'gi');
    let matchCount = 0;

    const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        {
            acceptNode: (node) => {
                const parent = node.parentElement;
                if (!parent) return NodeFilter.FILTER_REJECT;
                if (
                    parent.closest(`.${HIGHLIGHT_CLASS}`) ||
                    parent.closest('#hydra-guard-overlay-root') ||
                    parent.closest(`#${TOOLTIP_ID}`) ||
                    ['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'INPUT'].includes(parent.tagName)
                ) return NodeFilter.FILTER_REJECT;

                regex.lastIndex = 0;
                return regex.test(node.nodeValue)
                    ? NodeFilter.FILTER_ACCEPT
                    : NodeFilter.FILTER_SKIP;
            }
        }
    );

    const nodesToProcess = [];
    while (walker.nextNode()) nodesToProcess.push(walker.currentNode);

    nodesToProcess.forEach(node => {
        const parent = node.parentElement;
        if (!parent) return;

        const text = node.nodeValue;
        const fragment = document.createDocumentFragment();
        let lastIdx = 0;

        regex.lastIndex = 0;
        text.replace(regex, (match, _p1, offset) => {
            if (offset > lastIdx) {
                fragment.appendChild(document.createTextNode(text.substring(lastIdx, offset)));
            }
            fragment.appendChild(_createMark(match));
            lastIdx = offset + match.length;
            matchCount++;
        });

        if (lastIdx < text.length) {
            fragment.appendChild(document.createTextNode(text.substring(lastIdx)));
        }
        parent.replaceChild(fragment, node);
    });

    return matchCount;
}

/**
 * Slow path: highlights a phrase split across multiple TextNodes (e.g., "Action <b>Required</b>").
 * Uses TextNodeMap + Text.splitText() — no innerHTML, no outerHTML, XSS-safe.
 */
function _applyHighlightCrossNode(cleanPhrase) {
    // 1. Build a TextNodeMap: collect all visible TextNodes with their character offsets
    const textNodeMap = []; // { node, start, end }
    let totalLen = 0;
    const TEXT_CAP = 500 * 1024; // 500KB cap to prevent memory exhaustion

    const mapWalker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        {
            acceptNode: (node) => {
                const parent = node.parentElement;
                if (!parent) return NodeFilter.FILTER_REJECT;
                if (
                    parent.closest(`.${HIGHLIGHT_CLASS}`) ||
                    parent.closest('#hydra-guard-overlay-root') ||
                    ['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'INPUT'].includes(parent.tagName)
                ) return NodeFilter.FILTER_REJECT;
                return NodeFilter.FILTER_ACCEPT;
            }
        }
    );

    const textParts = [];
    let mapNode;
    while ((mapNode = mapWalker.nextNode())) {
        const value = mapNode.nodeValue || '';
        if (totalLen + value.length > TEXT_CAP) break;
        textParts.push(value);
        textNodeMap.push({ node: mapNode, start: totalLen, end: totalLen + value.length });
        totalLen += value.length;
    }

    if (textNodeMap.length === 0) return;

    // 2. Run regex over concatenated text
    const concatenated = textParts.join('');
    const regex = new RegExp(_escapeRegExp(cleanPhrase), 'gi');
    let match;

    // Process matches in reverse order so splitText offsets don't shift
    const matches = [];
    while ((match = regex.exec(concatenated)) !== null) {
        matches.push({ start: match.index, end: match.index + match[0].length });
    }

    // 3. For each match, find spanning TextNodes and wrap in <mark>
    for (let m = matches.length - 1; m >= 0; m--) {
        const { start: matchStart, end: matchEnd } = matches[m];
        _wrapCrossNodeMatch(textNodeMap, matchStart, matchEnd);
    }
}

/**
 * Wraps a match spanning [matchStart, matchEnd) across TextNodes using Text.splitText().
 * Only uses safe DOM APIs: Text.splitText(), Node.insertBefore(), document.createElement().
 */
function _wrapCrossNodeMatch(textNodeMap, matchStart, matchEnd) {
    for (let i = 0; i < textNodeMap.length; i++) {
        const entry = textNodeMap[i];
        // Skip nodes entirely before or after the match
        if (entry.end <= matchStart || entry.start >= matchEnd) continue;

        const node = entry.node;
        const parent = node.parentElement;
        if (!parent) continue;

        // Calculate local offsets within this TextNode
        const localStart = Math.max(0, matchStart - entry.start);
        const localEnd = Math.min(node.nodeValue.length, matchEnd - entry.start);

        // Split the text node to isolate the matching portion
        let targetNode = node;

        // Split off the leading unmatched text
        if (localStart > 0) {
            targetNode = targetNode.splitText(localStart);
        }

        // Split off the trailing unmatched text
        if (localEnd - localStart < targetNode.nodeValue.length) {
            targetNode.splitText(localEnd - localStart);
        }

        // Wrap the isolated text in a <mark>
        const mark = _createMark(targetNode.nodeValue);
        parent.insertBefore(mark, targetNode);
        parent.removeChild(targetNode);
    }
}

/**
 * Creates a styled <mark> element for scam phrase highlighting.
 * Uses textContent only — no innerHTML (XSS-safe).
 */
function _createMark(text) {
    const mark = document.createElement('mark');
    mark.className = HIGHLIGHT_CLASS;
    mark.textContent = text; // Safe – no innerHTML

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

    return mark;
}

function _escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

