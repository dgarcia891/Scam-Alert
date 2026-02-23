
import { checkIPAddress } from '../../src/lib/analyzer/url-engine.js';

describe('BUG-067: UI Color Regression (Logical)', () => {
    test('checkIPAddress should return severity NONE for a legitimate domain', () => {
        const result = checkIPAddress('https://mail.google.com');
        expect(result.flagged).toBe(false);
        expect(result.severity).toBe('NONE');
    });

    test('Checks with severity NONE should logically be considered non-alerting', () => {
        // This test documents the expectation for the UI layer
        const result = checkIPAddress('https://mail.google.com');
        const isAlert = result.severity !== 'NONE' && result.severity !== 'LOW';
        expect(isAlert).toBe(false);
    });
});
