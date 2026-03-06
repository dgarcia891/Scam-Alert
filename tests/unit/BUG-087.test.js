import { jest } from '@jest/globals';
import { highlightDetections, removeHighlights } from '../../extension/src/content/highlighter.js';

describe('BUG-087: Tooltip Blinking and Orange Color', () => {
    beforeEach(() => {
        document.body.innerHTML = '<p>Claim your prize!</p>';
    });

    test('highlight border color should be red (now #dc2626)', () => {
        highlightDetections({
            checks: {
                test: {
                    flagged: true,
                    visualIndicators: [{ phrase: 'claim your prize', category: 'A', reason: 'B' }]
                }
            }
        });

        const mark = document.querySelector('.hydra-guard-highlight');
        expect(mark.style.borderBottom).toContain('#dc2626');
    });

    test('tooltip should have pointer-events none to prevent blinking', () => {
        highlightDetections({
            checks: {
                test: {
                    flagged: true,
                    visualIndicators: [{ phrase: 'claim your prize', category: 'A', reason: 'B' }]
                }
            }
        });

        const mark = document.querySelector('.hydra-guard-highlight');
        mark.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));

        const tooltip = document.getElementById('hydra-guard-tooltip');
        expect(tooltip.style.pointerEvents).toBe('none');
    });

    test('showTooltip guard prevents redundant re-renders', () => {
        highlightDetections({
            checks: {
                test: {
                    flagged: true,
                    visualIndicators: [{ phrase: 'claim your prize', category: 'A', reason: 'B' }]
                }
            }
        });

        const mark = document.querySelector('.hydra-guard-highlight');

        // First hover
        mark.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
        const t1 = document.getElementById('hydra-guard-tooltip');

        // Second hover on the same element
        mark.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
        const t2 = document.getElementById('hydra-guard-tooltip');

        expect(t1).toBe(t2); // Should be the exact same element, not replaced
    });
});
