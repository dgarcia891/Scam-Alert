import { jest } from '@jest/globals';
import { highlightDetections, removeHighlights } from '../../extension/src/content/highlighter.js';
import { getExplanation } from '../../extension/src/lib/analyzer/explanations.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const mockResult = (indicators) => ({
    checks: {
        contentAnalysis: {
            flagged: true,
            visualIndicators: indicators
        }
    }
});

function resetDOM() {
    document.body.innerHTML = '';
    document.head.innerHTML = '';
}

// ─── Suite ───────────────────────────────────────────────────────────────────

describe('Scam Highlighter (FEAT-086 polish)', () => {
    beforeEach(resetDOM);

    // ── Core highlighting ─────────────────────────────────────────────────────

    test('highlights matched phrase in the DOM', () => {
        document.body.innerHTML = '<p>Claim your prize immediately!</p>';
        highlightDetections(mockResult([
            { phrase: 'claim your prize', category: 'Fake Prize', reason: 'Scam lure.' }
        ]));
        const marks = document.querySelectorAll('.hydra-guard-highlight');
        expect(marks).toHaveLength(1);
        expect(marks[0].textContent).toBe('Claim your prize');
    });

    test('mark element has display:inline set (fixes all:unset collapse)', () => {
        document.body.innerHTML = '<p>Claim your prize!</p>';
        highlightDetections(mockResult([
            { phrase: 'claim your prize', category: 'Fake Prize', reason: 'Lure.' }
        ]));
        const mark = document.querySelector('.hydra-guard-highlight');
        expect(mark.style.display).toBe('inline');
    });

    test('mark textContent is set — not innerHTML (XSS guard)', () => {
        document.body.innerHTML = '<p>Claim your prize!</p>';
        highlightDetections(mockResult([
            { phrase: 'claim your prize', category: '<b>XSS</b>', reason: '<script>alert(1)</script>' }
        ]));
        const mark = document.querySelector('.hydra-guard-highlight');
        expect(mark).not.toBeNull();
        // The mark itself is safe — textContent only
        expect(mark.textContent).toBe('Claim your prize');
    });

    test('tooltip textContent is safe — XSS in phrase/category/reason is not rendered as HTML', () => {
        document.body.innerHTML = '<p>Claim your prize!</p>';
        highlightDetections(mockResult([
            { phrase: 'claim your prize', category: '<img src=x onerror=alert(1)>', reason: 'safe' }
        ]));
        const mark = document.querySelector('.hydra-guard-highlight');
        mark.dispatchEvent(new MouseEvent('mouseenter'));

        const tooltip = document.getElementById('hydra-guard-tooltip');
        expect(tooltip).not.toBeNull();
        // Should contain literal angle brackets as text, not rendered tags
        expect(tooltip.querySelector('img')).toBeNull();
        expect(tooltip.textContent).toContain('<img src=x onerror=alert(1)>');
    });

    test('animation style is injected once for multiple phrases', () => {
        document.body.innerHTML = '<p>Claim your prize. Act now!</p>';
        highlightDetections(mockResult([
            { phrase: 'claim your prize', category: 'A', reason: 'B' },
            { phrase: 'act now', category: 'C', reason: 'D' }
        ]));
        const styleEls = document.querySelectorAll('#sa-highlight-animation');
        expect(styleEls).toHaveLength(1);
    });

    test('removeHighlights tears down marks and animation style', () => {
        document.body.innerHTML = '<p>Claim your prize!</p>';
        highlightDetections(mockResult([
            { phrase: 'claim your prize', category: 'A', reason: 'B' }
        ]));
        expect(document.querySelectorAll('.hydra-guard-highlight')).toHaveLength(1);
        expect(document.getElementById('sa-highlight-animation')).not.toBeNull();

        removeHighlights();

        expect(document.querySelectorAll('.hydra-guard-highlight')).toHaveLength(0);
        expect(document.getElementById('sa-highlight-animation')).toBeNull();
        expect(document.body.textContent).toContain('Claim your prize!');
    });

    test('overlapping phrases: longer match wins', () => {
        document.body.innerHTML = '<p>Claim your prize!</p>';
        highlightDetections(mockResult([
            { phrase: 'your prize', category: 'A', reason: 'B' },
            { phrase: 'claim your prize', category: 'C', reason: 'D' }
        ]));
        // Only 1 mark — the longer phrase consumed the shorter
        const marks = document.querySelectorAll('.hydra-guard-highlight');
        expect(marks).toHaveLength(1);
        expect(marks[0].textContent).toBe('Claim your prize');
    });

    test('skips SCRIPT, STYLE, TEXTAREA nodes', () => {
        document.body.innerHTML = `
            <script>var x = "claim your prize";</script>
            <textarea>claim your prize</textarea>
            <p>Normal text only</p>
        `;
        highlightDetections(mockResult([
            { phrase: 'claim your prize', category: 'A', reason: 'B' }
        ]));
        expect(document.querySelectorAll('.hydra-guard-highlight')).toHaveLength(0);
    });

    // ── Explanations ──────────────────────────────────────────────────────────

    test('getExplanation handles fuzzy match annotation (case-insensitive)', () => {
        const result1 = getExplanation('claim your prize (Fuzzy Match)');
        const result2 = getExplanation('claim your prize (fuzzy match)');
        const result3 = getExplanation('claim your prize');
        expect(result1.category).toBe('Fake Prize');
        expect(result2.category).toBe('Fake Prize');
        expect(result3.category).toBe('Fake Prize');
    });

    test('getExplanation returns a fallback for unknown phrases', () => {
        const result = getExplanation('completely normal sentence');
        expect(result.category).toBe('Suspicious Pattern');
        expect(result.reason).toBeTruthy();
    });
});
