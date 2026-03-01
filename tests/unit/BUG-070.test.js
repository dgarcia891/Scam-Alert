
import { describe, test, expect, jest } from '@jest/globals';
import { scanUrl } from '../../extension/src/lib/detector.js';

describe('BUG-070: Email Heuristics Integration in Detector', () => {
    test('High-score email scam should result in CRITICAL/HIGH severity and RED icon', async () => {
        // Setup mock for chrome.storage.local
        global.chrome = {
            storage: {
                local: {
                    get: jest.fn().mockResolvedValue({}),
                    set: jest.fn().mockResolvedValue({})
                }
            },
            runtime: {
                getURL: (path) => path
            }
        };

        const SCAM_BODY = `
            I need you to pick up gift cards for few selected staff members and get reimbursed. 
            This should be Confidential. I am Father Ivan.
        `.toLowerCase();

        const pageContent = {
            isEmailView: true,
            bodyText: SCAM_BODY,
            senderName: 'Father Iván Melchor',
            senderEmail: 'offiece55@gmail.com',
        };

        const options = {
            useGoogleSafeBrowsing: false,
            usePhishTank: false,
            usePatternDetection: true,
            pageContent
        };

        const result = await scanUrl('https://mail.google.com/mail/u/0/#inbox', options);

        // BUG-070: Email scams should register as HIGH (Red Icon + Overlay)
        expect(result.overallSeverity).toBe('HIGH');
        expect(result.action).toBe('WARN_OVERLAY');
    });
});
