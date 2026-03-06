import { describe, test, expect, jest, beforeEach, beforeAll } from '@jest/globals';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const contentSrc = (rel) => resolve(__dirname, '../../extension/src/content', rel);
const libSrc = (rel) => resolve(__dirname, '../../extension/src/lib', rel);

let createOverlay, OVERLAY_ID;

beforeAll(async () => {
    jest.unstable_mockModule(libSrc('messaging.js'), () => ({
        MessageTypes: {
            CONTEXT_DETECTED: 'context_detected', SCAN_RESULT: 'scan_result',
            SCAN_RESULT_UPDATED: 'scan_result_updated', SHOW_WARNING: 'show_warning',
            HIDE_WARNING: 'hide_warning', SHOW_BANNER: 'show_banner',
            OPEN_REPORT_MODAL: 'open_report_modal', EXECUTE_SCAN: 'execute_scan',
            SCAN_PROGRESS: 'scan_progress', REPORT_SCAM: 'report_scam',
            ANALYZE_PAGE: 'analyze_page', NAVIGATE_BACK: 'navigate_back'
        }
    }));
    jest.unstable_mockModule(libSrc('context-detector.js'), () => ({
        detectContext: () => ({ type: 'web' }),
        detectEmailMetadata: () => null
    }));
    jest.unstable_mockModule(libSrc('detector.js'), () => ({
        scanUrl: jest.fn().mockResolvedValue({ overallSeverity: 'SAFE' })
    }));
    jest.unstable_mockModule(contentSrc('highlighter.js'), () => ({
        highlightDetections: jest.fn(),
        removeHighlights: jest.fn()
    }));

    const mod = await import('../../extension/src/content/content.js');
    createOverlay = mod.createOverlay;
    OVERLAY_ID = mod.OVERLAY_ID;
});

describe('BUG-072: Interactive Risk Explanations', () => {
    beforeEach(() => {
        document.documentElement.innerHTML = '<head></head><body></body>';
        jest.clearAllMocks();
        if (window.sessionStorage) window.sessionStorage.clear();
    });

    test('Overlay should render technical indicators from checks', () => {
        createOverlay({
            recommendations: ['Suspicious generic activity'],
            checks: {
                urgency: { flagged: true, title: 'Urgency Detected', details: 'High pressure language found.' },
                impersonation: { flagged: true, title: 'Authority Impersonation', details: 'Religious leader mentioned.' }
            }
        });

        const overlayRoot = document.getElementById(OVERLAY_ID);
        expect(overlayRoot).not.toBeNull();

        const shadow = overlayRoot.shadowRoot;
        const detailsPanel = shadow.getElementById('pnl-details');
        const findingsList = detailsPanel.querySelector('ul').innerHTML;

        expect(findingsList).toContain('Urgency Detected');
        expect(findingsList).toContain('High pressure language found');
        expect(findingsList).toContain('Authority Impersonation');
        expect(findingsList).toContain('Religious leader mentioned');
    });

    test('Reason button should toggle details panel visibility', () => {
        createOverlay({
            recommendations: ['Phishing attempt'],
            checks: { scam: { flagged: true, title: 'Scam Match', details: 'Matches gift card scam.' } }
        });

        const shadow = document.getElementById(OVERLAY_ID).shadowRoot;
        const btnReason = shadow.getElementById('btn-reason');
        const pnlDetails = shadow.getElementById('pnl-details');

        expect(pnlDetails.classList.contains('visible')).toBe(false);
        btnReason.click();
        expect(pnlDetails.classList.contains('visible')).toBe(true);
        btnReason.click();
        expect(pnlDetails.classList.contains('visible')).toBe(false);
    });
});
