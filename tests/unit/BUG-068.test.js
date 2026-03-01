
import { checkEmailScams } from '../../extension/src/lib/analyzer/email-heuristics.js';

// The exact text from the reported scam email (Jesse gift card email scam)
const SCAM_BODY = `
I need you to pick up gift cards for few selected staff members on my list and get reimbursed. Are you in good space to get this done now or later today?

I have been working on incentives and I aimed at surprising some of our diligent staff and church families with gift cards this week. This should be Confidential until they all have the gift cards as it's a surprise and you will keep one for yourself too. Can you get this done today?

I need your help with something that requires discretion. I'm not able to take calls right now.

Yes, I can pick up gift cards. Just let me know how many, the amount of each card, and what you want me to do with them once I have them.
`.toLowerCase();

describe('BUG-068: Authority Impersonation Gift Card Scam (Missed Detection)', () => {
    test('Gift card pickup + reimbursement should be flagged', () => {
        const pageContent = {
            isEmailView: true,
            bodyText: SCAM_BODY,
            senderName: 'Father Iván Melchor',
            senderEmail: 'offiece55@gmail.com',
        };
        const result = checkEmailScams(pageContent);
        // The email contains "gift card", "pick up", "reimbursed" and authority language
        expect(result.flagged).toBe(true);
        expect(result.score).toBeGreaterThanOrEqual(50);
    });

    test('"get reimbursed" keyword should be recognized as a scam signal', () => {
        const pageContent = {
            isEmailView: true,
            bodyText: 'please pick up gift cards and get reimbursed later',
            senderName: 'Boss Man',
            senderEmail: 'boss@gmail.com',
        };
        const result = checkEmailScams(pageContent);
        expect(result.flagged).toBe(true);
    });

    test('Authority title using free email should be flagged (pastor/father/priest/bishop/ceo)', () => {
        const pageContent = {
            isEmailView: true,
            bodyText: 'I need your help with something that requires discretion.',
            senderName: 'Father Iván Melchor',
            senderEmail: 'offiece55@gmail.com',
        };
        const result = checkEmailScams(pageContent);
        // A "Father/Pastor" using a free Gmail should trigger sender inconsistency
        expect(result.indicators).toContain('Official name from personal email address');
    });
});
