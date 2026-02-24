import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import { createOverlay, OVERLAY_ID } from '../../src/content/content.js';

describe('BUG-072: Interactive Risk Explanations', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        jest.clearAllMocks();
    });

    test('Overlay should render technical indicators from checks', () => {
        const mockResult = {
            recommendations: ['Suspicious generic activity'],
            checks: {
                urgency: {
                    flagged: true,
                    title: 'Urgency Detected',
                    details: 'High pressure language found.'
                },
                impersonation: {
                    flagged: true,
                    title: 'Authority Impersonation',
                    details: 'Religious leader mentioned.'
                }
            }
        };

        createOverlay(mockResult);

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
        const mockResult = {
            recommendations: ['Phishing attempt'],
            checks: {
                scam: { flagged: true, title: 'Scam Match', details: 'Matches gift card scam.' }
            }
        };

        createOverlay(mockResult);

        const shadow = document.getElementById(OVERLAY_ID).shadowRoot;
        const btnReason = shadow.getElementById('btn-reason');
        const pnlDetails = shadow.getElementById('pnl-details');

        // Initial state
        expect(pnlDetails.classList.contains('visible')).toBe(false);

        // Click to expand
        btnReason.click();
        expect(pnlDetails.classList.contains('visible')).toBe(true);

        // Click to collapse
        btnReason.click();
        expect(pnlDetails.classList.contains('visible')).toBe(false);
    });
});
