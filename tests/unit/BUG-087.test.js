import { jest } from '@jest/globals';
import { highlightDetections, removeHighlights } from '../../src/content/highlighter.js';

describe('BUG-087: Tooltip Blinking and Orange Color', () => {
    beforeEach(() => {
        document.body.innerHTML = '<p>Claim your prize!</p>';
    });

    test('highlight border color should be red (now #dc2626)', () => {
        highlightDetections({
            checks: {
                test: {
                    visualIndicators: [{ phrase: 'claim your prize', category: 'A', reason: 'B' }]
                }
            }
        });

        const mark = document.querySelector('.scam-alert-highlight');
        expect(mark.style.borderBottom).toContain('#dc2626');
    });

    test('tooltip should have pointer-events none to prevent blinking', () => {
        highlightDetections({
            checks: {
                test: {
                    visualIndicators: [{ phrase: 'claim your prize', category: 'A', reason: 'B' }]
                }
            }
        });

        const mark = document.querySelector('.scam-alert-highlight');
        mark.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));

        const tooltip = document.getElementById('scam-alert-tooltip');
        expect(tooltip.style.pointerEvents).toBe('none');
    });

    test('showTooltip guard prevents redundant re-renders', () => {
        // Spy on remove (part of _hideTooltip which _showTooltip calls)
        // Since we can't easily spy on internal functions, we check the DOM
        highlightDetections({
            checks: {
                test: {
                    visualIndicators: [{ phrase: 'claim your prize', category: 'A', reason: 'B' }]
                }
            }
        });

        const mark = document.querySelector('.scam-alert-highlight');

        // First hover
        mark.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
        const t1 = document.getElementById('scam-alert-tooltip');

        // Second hover on the same element
        mark.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
        const t2 = document.getElementById('scam-alert-tooltip');

        expect(t1).toBe(t2); // Should be the exact same element, not replaced
    });
});
