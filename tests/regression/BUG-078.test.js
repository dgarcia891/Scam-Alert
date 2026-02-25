import { describe, test, expect } from '@jest/globals';
import { checkEmailScams } from '../../src/lib/analyzer/email-heuristics.js';

describe('BUG-078: Gift Card Scam Email False Negative', () => {
    test('forwarded plain-text extraction', () => {
        // The problem is likely that the "AI Overview" or forwarded quote blocks 
        // in Gmail are preventing the core message from being parsed correctly,
        // or the specific sender extracting logic failed.
        
        // In the screenshot, the real sender is "jesse avila <avilajesse@yahoo.com>"
        // but the 'to' is "Father Iván Melchor <offiece55@gmail.com>"
        
        const emailContent = {
            isEmailView: true,
            senderEmail: 'avilajesse@yahoo.com', 
            senderName: 'jesse avila',
            // Notice the body is extremely short and doesn't contain the "confidentiality" words 
            // inside the *actual* email body. The context was in the "AI Overview" or previous chain.
            bodyText: `Here you go.  These are the first ones I recieved.

Jesse Avila

----- Forwarded Message -----
From: jesse avila <avilajesse@yahoo.com>
To: Father Iván Melchor <offiece55@gmail.com>
Sent: Monday, January 19, 2026 at 11:24:39 AM PST
Subject: Re: Jesse

Yes, I can pick up gift cards. Just let me know how many, the amount of each card,and what you want me to do with them once I have them.

Sent from Yahoo Mail for iPhone`
        };

        const result = checkEmailScams(emailContent);
        
        expect(result.score).toBeGreaterThanOrEqual(70); 
    });
});
