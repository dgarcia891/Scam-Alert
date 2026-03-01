import { analyzeUrl } from '../../extension/src/lib/pattern-analyzer.js';

describe('Regression BUG-036: Truncated Evidence & Weak Scam Detection', () => {
    const scamEmailBody = `
        Here you go. These are the first ones I received. Jesse Avila 
        ----- Forwarded Message ----- 
        From: jesse avila <avilajesse@yahoo.com> 
        To: Father Iván Melchor <office55@gmail.com> 
        Sent: Monday, January 19, 2026 at 1:24:39 AM PST 
        Subject: Re: Jesse Yes, I can pick up gift cards. 
        Just let me know how many, the amount of each card,
        and what you want me to do with them once I have them. 
        Sent from Yahoo Mail for iPhone On Monday, January 19, 2026, 11:20 AM, Father Iván Melchor <offiec
    `;

    const pageContent = {
        title: 'Gmail - Re: Jesse Yes',
        bodyText: scamEmailBody,
        isEmailView: true,
        senderEmail: 'office55@gmail.com',
        senderName: 'Father Iván Melchor'
    };

    test('should detect gift card scam in the user provided email text', async () => {
        const result = await analyzeUrl('https://mail.google.com/mail/u/0/#inbox', pageContent, false);

        // check_email_scams should be flagged
        expect(result.checks.emailScams.flagged).toBe(true);
        expect(result.checks.emailScams.indicators).toContain('Gift card payment request');

        // Analyze page content should have full dataChecked (not truncated at 500)
        expect(result.checks.contentAnalysis.dataChecked.length).toBeGreaterThan(500);
        expect(result.checks.contentAnalysis.dataChecked).toContain('amount of each card');
    });

    test('should trip urgency signal for "gift card for me"', async () => {
        const urgentResult = await analyzeUrl('https://mail.google.com/mail/u/0/#inbox', {
            ...pageContent,
            bodyText: 'Please buy a gift card for me immediately.'
        }, false);

        expect(urgentResult.checks.urgencySignals.flagged).toBe(true);
        expect(urgentResult.checks.urgencySignals.details).toContain('gift card for me');
    });
});
