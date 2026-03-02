/**
 * Popup UI Tests
 * Tests the ui-renderers.js pure functions and tooltip-helper.js:
 *   - getClassNameForSeverity (5 severity levels)
 *   - getStatusTextForSeverity (5 severity levels)
 *   - escapeHtml (XSS prevention)
 *   - renderSources (detection source display)
 *   - renderReport (category status icons)
 *   - renderPatternChecks (check item rendering)
 *   - renderKeywordHighlights (keyword chip rendering)
 *   - renderScanSummary (scan summary display)
 *   - clamp (tooltip-helper utility)
 */
import { describe, test, expect, beforeEach } from '@jest/globals';
import {
    getClassNameForSeverity,
    getStatusTextForSeverity,
    escapeHtml,
    renderSources,
    renderReport,
    renderPatternChecks,
    renderKeywordHighlights
} from '../../extension/src/popup/ui-renderers.js';
import { clamp } from '../../extension/src/popup/tooltip-helper.js';

// ─── getClassNameForSeverity ────────────────────────────────────────────────

describe('getClassNameForSeverity', () => {
    test('CRITICAL → danger', () => {
        expect(getClassNameForSeverity('CRITICAL')).toBe('danger');
    });

    test('HIGH → warning', () => {
        expect(getClassNameForSeverity('HIGH')).toBe('warning');
    });

    test('MEDIUM → warning', () => {
        expect(getClassNameForSeverity('MEDIUM')).toBe('warning');
    });

    test('LOW → warning', () => {
        expect(getClassNameForSeverity('LOW')).toBe('warning');
    });

    test('SAFE → safe', () => {
        expect(getClassNameForSeverity('SAFE')).toBe('safe');
    });

    test('undefined → safe (default)', () => {
        expect(getClassNameForSeverity(undefined)).toBe('safe');
    });

    test('null → safe (default)', () => {
        expect(getClassNameForSeverity(null)).toBe('safe');
    });
});

// ─── getStatusTextForSeverity ───────────────────────────────────────────────

describe('getStatusTextForSeverity', () => {
    test('CRITICAL → recommends leaving', () => {
        expect(getStatusTextForSeverity('CRITICAL')).toContain('recommend leaving');
    });

    test('HIGH → be careful', () => {
        expect(getStatusTextForSeverity('HIGH')).toContain('careful');
    });

    test('MEDIUM → be careful', () => {
        expect(getStatusTextForSeverity('MEDIUM')).toContain('careful');
    });

    test('LOW → be careful', () => {
        expect(getStatusTextForSeverity('LOW')).toContain('careful');
    });

    test('SAFE → looks safe', () => {
        expect(getStatusTextForSeverity('SAFE')).toContain('safe');
    });

    test('undefined → looks safe (default)', () => {
        expect(getStatusTextForSeverity(undefined)).toContain('safe');
    });
});

// ─── escapeHtml ─────────────────────────────────────────────────────────────

describe('escapeHtml', () => {
    test('escapes < and >', () => {
        expect(escapeHtml('<script>alert("xss")</script>')).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
    });

    test('escapes &', () => {
        expect(escapeHtml('a & b')).toBe('a &amp; b');
    });

    test('escapes single quotes', () => {
        expect(escapeHtml("it's")).toBe('it&#039;s');
    });

    test('escapes double quotes', () => {
        expect(escapeHtml('"hello"')).toBe('&quot;hello&quot;');
    });

    test('passes through clean text unchanged', () => {
        expect(escapeHtml('hello world')).toBe('hello world');
    });

    test('handles non-string input by converting', () => {
        expect(escapeHtml(42)).toBe('42');
        expect(escapeHtml(null)).toBe('null');
    });
});

// ─── renderSources ──────────────────────────────────────────────────────────

describe('renderSources', () => {
    beforeEach(() => {
        document.body.innerHTML = `
            <div id="sourcesSection" style="display:none">
                <div id="sourcesList"></div>
            </div>
        `;
    });

    test('renders pattern analysis source with severity', () => {
        renderSources({
            pattern: { overallSeverity: 'HIGH', flagged: true }
        });

        const section = document.getElementById('sourcesSection');
        const list = document.getElementById('sourcesList');
        expect(section.style.display).toBe('block');
        expect(list.innerHTML).toContain('Pattern Analysis');
        expect(list.innerHTML).toContain('HIGH');
    });

    test('renders safe Google Safe Browsing source', () => {
        renderSources({
            pattern: { overallSeverity: 'SAFE' },
            googleSafeBrowsing: { safe: true }
        });

        const list = document.getElementById('sourcesList');
        expect(list.innerHTML).toContain('Google Safe Browsing');
        expect(list.innerHTML).toContain('Safe');
    });

    test('renders error state for failed source', () => {
        renderSources({
            pattern: { error: 'API timeout' }
        });

        const list = document.getElementById('sourcesList');
        expect(list.innerHTML).toContain('API timeout');
        expect(list.innerHTML).toContain('✗');
    });

    test('hides section when no detections', () => {
        renderSources({});

        const section = document.getElementById('sourcesSection');
        expect(section.style.display).toBe('none');
    });

    test('returns early when elements are missing', () => {
        document.body.innerHTML = '';
        // Should not throw
        expect(() => renderSources({ pattern: { overallSeverity: 'SAFE' } })).not.toThrow();
    });
});

// ─── renderReport ───────────────────────────────────────────────────────────

describe('renderReport', () => {
    beforeEach(() => {
        document.body.innerHTML = `
            <span id="fraudStatus"></span>
            <span id="identityStatus"></span>
            <span id="malwareStatus"></span>
            <span id="deceptiveStatus"></span>
            <div id="reportExplanation"></div>
            <div id="indicatorsList"></div>
            <div id="reportTimestamp"></div>
        `;
    });

    test('renders SAFE status icons correctly', () => {
        renderReport({
            fraud: { status: 'SAFE' },
            identity: { status: 'SAFE' },
            malware: { status: 'SAFE' },
            deceptive: { status: 'SAFE' },
            summary: 'All clear.',
            indicators: []
        }, Date.now());

        expect(document.getElementById('fraudStatus').textContent).toBe('✓');
        expect(document.getElementById('fraudStatus').className).toContain('safe');
    });

    test('renders CAUTION status with warning icon', () => {
        renderReport({
            fraud: { status: 'CAUTION' },
            identity: { status: 'SAFE' },
            malware: { status: 'SAFE' },
            deceptive: { status: 'SAFE' },
            summary: 'Some concerns.',
            indicators: ['Suspicious link detected']
        }, Date.now());

        expect(document.getElementById('fraudStatus').textContent).toBe('⚠️');
        expect(document.getElementById('fraudStatus').className).toContain('caution');
    });

    test('renders summary text', () => {
        renderReport({
            fraud: { status: 'SAFE' },
            identity: { status: 'SAFE' },
            malware: { status: 'SAFE' },
            deceptive: { status: 'SAFE' },
            summary: 'This site appears legitimate.',
            indicators: []
        }, Date.now());

        expect(document.getElementById('reportExplanation').textContent).toBe('This site appears legitimate.');
    });

    test('renders indicators list', () => {
        renderReport({
            fraud: { status: 'SAFE' },
            identity: { status: 'SAFE' },
            malware: { status: 'SAFE' },
            deceptive: { status: 'SAFE' },
            summary: '',
            indicators: ['Fake login form', 'Suspicious URL']
        }, Date.now());

        const list = document.getElementById('indicatorsList');
        expect(list.innerHTML).toContain('Fake login form');
        expect(list.innerHTML).toContain('Suspicious URL');
        expect(list.style.display).toBe('block');
    });

    test('hides indicators when empty', () => {
        renderReport({
            fraud: { status: 'SAFE' },
            identity: { status: 'SAFE' },
            malware: { status: 'SAFE' },
            deceptive: { status: 'SAFE' },
            summary: '',
            indicators: []
        }, Date.now());

        expect(document.getElementById('indicatorsList').style.display).toBe('none');
    });

    test('renders timestamp', () => {
        const ts = Date.now();
        renderReport({
            fraud: { status: 'SAFE' },
            identity: { status: 'SAFE' },
            malware: { status: 'SAFE' },
            deceptive: { status: 'SAFE' },
            summary: '',
            indicators: []
        }, ts);

        expect(document.getElementById('reportTimestamp').textContent).toContain('Checked:');
    });
});

// ─── renderPatternChecks ────────────────────────────────────────────────────

describe('renderPatternChecks', () => {
    beforeEach(() => {
        document.body.innerHTML = '<div id="patternChecksList"></div>';
    });

    test('renders check items for pattern detections', () => {
        renderPatternChecks({
            checks: {
                check_non_https: { title: 'check_non_https', flagged: true, details: 'HTTP connection' },
                check_suspicious_tld: { title: 'check_suspicious_tld', flagged: false, details: 'TLD is normal' }
            }
        });

        const list = document.getElementById('patternChecksList');
        expect(list.children.length).toBe(2);
        expect(list.innerHTML).toContain('non https');
        expect(list.innerHTML).toContain('check-flagged');
        expect(list.innerHTML).toContain('check-ok');
    });

    test('skips contentAnalysis key', () => {
        renderPatternChecks({
            checks: {
                contentAnalysis: { title: 'contentAnalysis', flagged: false },
                check_non_https: { title: 'check_non_https', flagged: false, details: 'OK' }
            }
        });

        const list = document.getElementById('patternChecksList');
        expect(list.children.length).toBe(1);
    });

    test('skips items without title', () => {
        renderPatternChecks({
            checks: {
                unnamed: { flagged: false },
                check_non_https: { title: 'check_non_https', flagged: false, details: 'OK' }
            }
        });

        const list = document.getElementById('patternChecksList');
        expect(list.children.length).toBe(1);
    });

    test('handles null patternDetection gracefully', () => {
        expect(() => renderPatternChecks(null)).not.toThrow();
        expect(document.getElementById('patternChecksList').children.length).toBe(0);
    });

    test('handles missing checks property', () => {
        expect(() => renderPatternChecks({})).not.toThrow();
    });
});

// ─── renderKeywordHighlights ────────────────────────────────────────────────

describe('renderKeywordHighlights', () => {
    beforeEach(() => {
        document.body.innerHTML = `
            <div id="keywordHighlightsSection" style="display:none">
                <div id="keywordHighlightsNote"></div>
                <div id="keywordHighlightsChips"></div>
            </div>
        `;
    });

    test('renders keyword chips when flagged', () => {
        renderKeywordHighlights({
            checks: {
                suspiciousKeywords: {
                    flagged: true,
                    keywords: ['login', 'verify'],
                    keywordReasons: {
                        login: 'Fake sign-in page',
                        verify: 'Phishing tactic'
                    }
                }
            }
        });

        const section = document.getElementById('keywordHighlightsSection');
        const chips = document.getElementById('keywordHighlightsChips');
        expect(section.style.display).toBe('block');
        expect(chips.innerHTML).toContain('login');
        expect(chips.innerHTML).toContain('verify');
        expect(chips.innerHTML).toContain('keyword-chip');
    });

    test('shows reason summary when NOT flagged but keywords found', () => {
        renderKeywordHighlights({
            checks: {
                suspiciousKeywords: {
                    flagged: false,
                    keywords: ['login'],
                    keywordReasons: { login: 'Common on real sites' },
                    reasonSummary: 'Only one keyword found.'
                }
            }
        });

        const note = document.getElementById('keywordHighlightsNote');
        expect(note.textContent).toBe('Only one keyword found.');
    });

    test('hides section when no keywords', () => {
        renderKeywordHighlights({
            checks: {
                suspiciousKeywords: {
                    flagged: false,
                    keywords: []
                }
            }
        });

        const section = document.getElementById('keywordHighlightsSection');
        expect(section.style.display).toBe('none');
    });

    test('hides section when no suspiciousKeywords data', () => {
        renderKeywordHighlights({ checks: {} });

        const section = document.getElementById('keywordHighlightsSection');
        expect(section.style.display).toBe('none');
    });

    test('handles null gracefully', () => {
        expect(() => renderKeywordHighlights(null)).not.toThrow();
    });

    test('escapes HTML in keyword names (XSS prevention)', () => {
        renderKeywordHighlights({
            checks: {
                suspiciousKeywords: {
                    flagged: true,
                    keywords: ['<script>alert("xss")</script>'],
                    keywordReasons: {}
                }
            }
        });

        const chips = document.getElementById('keywordHighlightsChips');
        expect(chips.innerHTML).not.toContain('<script>');
        expect(chips.innerHTML).toContain('&lt;script&gt;');
    });
});

// ─── clamp (tooltip-helper.js) ──────────────────────────────────────────────

describe('clamp', () => {
    test('clamps value below min', () => {
        expect(clamp(-5, 0, 100)).toBe(0);
    });

    test('clamps value above max', () => {
        expect(clamp(150, 0, 100)).toBe(100);
    });

    test('returns value when within range', () => {
        expect(clamp(50, 0, 100)).toBe(50);
    });

    test('returns min when value equals min', () => {
        expect(clamp(0, 0, 100)).toBe(0);
    });

    test('returns max when value equals max', () => {
        expect(clamp(100, 0, 100)).toBe(100);
    });
});
