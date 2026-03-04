/**
 * Email Heuristics Unit Tests
 * Tests all 5 detection classes in email-heuristics.js:
 *   1. Gift Card Scams
 *   2. Sender Inconsistency
 *   3. Invoice/Wire Fraud
 *   4. Authority Pressure
 *   5. Vague Lure Detection
 */
import { describe, test, expect, beforeEach } from '@jest/globals';
import { checkEmailScams } from '../../extension/src/lib/analyzer/email-heuristics.js';

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Build a minimal email pageContent for testing */
function makeEmail({
    bodyText = '',
    senderEmail = 'someone@example.com',
    senderName = 'Someone',
    isEmailView = true,
    links = [],
    rawUrls = []
} = {}) {
    return { bodyText, senderEmail, senderName, isEmailView, links, rawUrls };
}

// ─── Guard: Non-email input ─────────────────────────────────────────────────

describe('checkEmailScams — Guard Clauses', () => {
    test('returns unflagged for null input', () => {
        const result = checkEmailScams(null);
        expect(result.flagged).toBe(false);
        expect(result.score).toBe(0);
    });

    test('returns unflagged for non-email page (no isEmailView or emailContext)', () => {
        const result = checkEmailScams({ bodyText: 'buy gift card now', isEmailView: false });
        expect(result.flagged).toBe(false);
    });

    test('returns unflagged for empty email body with no indicators', () => {
        const result = checkEmailScams(makeEmail({ bodyText: '' }));
        expect(result.flagged).toBe(false);
        expect(result.score).toBe(0);
    });

    test('accepts emailContext flag as alternative to isEmailView', () => {
        const result = checkEmailScams({
            bodyText: 'buy a gift card and scratch the code',
            emailContext: true,
            senderEmail: 'x@gmail.com',
            senderName: 'x'
        });
        expect(result.flagged).toBe(true);
    });
});

// ─── Detection Class 1: Gift Card Scams ─────────────────────────────────────

describe('checkEmailScams — Gift Card Scam Detection', () => {
    test('flags classic "buy gift card + scratch code" pattern', () => {
        const result = checkEmailScams(makeEmail({
            bodyText: 'I need you to buy some Google Play gift cards and scratch the back. Send me a photo of the code.'
        }));
        expect(result.flagged).toBe(true);
        expect(result.score).toBeGreaterThanOrEqual(50);
        expect(result.severity).toBe('CRITICAL');
        expect(result.indicators).toContain('Gift card payment request');
    });

    test('flags Amazon card + purchase command', () => {
        const result = checkEmailScams(makeEmail({
            bodyText: 'Please purchase 5 amazon card each $100. Let me know when done.'
        }));
        expect(result.flagged).toBe(true);
        expect(result.indicators).toContain('Gift card payment request');
    });

    test('flags Steam card + "get this done" command', () => {
        const result = checkEmailScams(makeEmail({
            bodyText: 'Pick up some steam card from Walmart and get this done today.'
        }));
        expect(result.flagged).toBe(true);
        expect(result.score).toBeGreaterThanOrEqual(50);
    });

    test('flags iTunes + reimbursement promise', () => {
        const result = checkEmailScams(makeEmail({
            bodyText: 'I need itunes gift cards. You will get reimbursed. How many can you pick up?'
        }));
        expect(result.flagged).toBe(true);
        expect(result.indicators).toContain('Gift card payment request');
    });

    test('does NOT flag gift card keyword alone without command word', () => {
        const result = checkEmailScams(makeEmail({
            bodyText: 'Happy Birthday! I got you a Google Play gift card!'
        }));
        // No command word → should NOT flag the gift card check
        expect(result.indicators).not.toContain('Gift card payment request');
    });

    test('does NOT flag command word alone without gift card keyword', () => {
        const result = checkEmailScams(makeEmail({
            bodyText: 'Can you please purchase some office supplies and let me know when done?'
        }));
        expect(result.indicators).not.toContain('Gift card payment request');
    });
});

// ─── Detection Class 2: Sender Inconsistency ────────────────────────────────

describe('checkEmailScams — Sender Inconsistency Detection', () => {
    test('flags official title (CEO) from free email provider (gmail)', () => {
        const result = checkEmailScams(makeEmail({
            bodyText: 'I have an urgent task for you.',
            senderEmail: 'john.smith@gmail.com',
            senderName: 'CEO John Smith'
        }));
        expect(result.flagged).toBe(true);
        expect(result.indicators).toContain('Official name from personal email address');
        expect(result.score).toBeGreaterThanOrEqual(40);
    });

    test('flags pastor from Yahoo email', () => {
        const result = checkEmailScams(makeEmail({
            bodyText: 'I need your help with something.',
            senderEmail: 'pastor.mike@yahoo.com',
            senderName: 'Pastor Mike Anderson'
        }));
        expect(result.flagged).toBe(true);
        expect(result.indicators).toContain('Official name from personal email address');
    });

    test('flags HR director from Hotmail', () => {
        const result = checkEmailScams(makeEmail({
            bodyText: 'Please review the attached document.',
            senderEmail: 'hr.dept@hotmail.com',
            senderName: 'HR Director'
        }));
        expect(result.flagged).toBe(true);
        expect(result.indicators).toContain('Official name from personal email address');
    });

    test('detects sender inconsistency in forwarded email body', () => {
        const result = checkEmailScams(makeEmail({
            bodyText: '---------- Forwarded message ----------\nFrom: Father Ivan <scammer@gmail.com>\nSubject: Urgent request',
            senderEmail: 'relay@office365.com',
            senderName: 'Relay Service'
        }));
        expect(result.flagged).toBe(true);
        expect(result.indicators).toContain('Official name from personal email address');
    });

    test('detects "Sent by:" pattern in body with official title + free provider', () => {
        const result = checkEmailScams(makeEmail({
            bodyText: 'Sent by: Principal Johnson <principal.j@outlook.com>\nPlease handle this request.',
            senderEmail: 'noreply@school.edu',
            senderName: 'School Notifications'
        }));
        expect(result.flagged).toBe(true);
        expect(result.indicators).toContain('Official name from personal email address');
    });

    test('does NOT flag official title from corporate domain', () => {
        const result = checkEmailScams(makeEmail({
            bodyText: 'Meeting at 3pm.',
            senderEmail: 'ceo@acme-corp.com',
            senderName: 'CEO Jane Doe'
        }));
        expect(result.indicators).not.toContain('Official name from personal email address');
    });

    test('does NOT flag personal name from gmail (no official keyword)', () => {
        const result = checkEmailScams(makeEmail({
            bodyText: 'Hey, want to grab lunch?',
            senderEmail: 'john@gmail.com',
            senderName: 'John Smith'
        }));
        expect(result.indicators).not.toContain('Official name from personal email address');
    });
});

// ─── Detection Class 3: Invoice / Wire Fraud ────────────────────────────────

describe('checkEmailScams — Invoice/Wire Fraud Detection', () => {
    test('flags 2+ financial keywords (invoice + wire transfer)', () => {
        const result = checkEmailScams(makeEmail({
            bodyText: 'Please find the attached invoice. Payment should be sent via wire transfer to the new account.'
        }));
        expect(result.flagged).toBe(true);
        expect(result.indicators).toContain('Suspicious financial request');
        expect(result.score).toBeGreaterThanOrEqual(30);
        expect(result.severity).toBe('HIGH');
    });

    test('flags overdue + bank details', () => {
        const result = checkEmailScams(makeEmail({
            bodyText: 'Your payment is overdue. Please send payment using the bank details below.'
        }));
        expect(result.flagged).toBe(true);
        expect(result.indicators).toContain('Suspicious financial request');
    });

    test('flags payment pending + routing number', () => {
        const result = checkEmailScams(makeEmail({
            bodyText: 'Payment pending verification. Please update your routing number for direct deposit.'
        }));
        expect(result.flagged).toBe(true);
        expect(result.indicators).toContain('Suspicious financial request');
    });

    test('does NOT flag single financial keyword', () => {
        const result = checkEmailScams(makeEmail({
            bodyText: 'The invoice for last month is attached for your records.'
        }));
        expect(result.indicators).not.toContain('Suspicious financial request');
    });
});

// ─── Detection Class 4: Authority Pressure ──────────────────────────────────

describe('checkEmailScams — Authority Pressure Detection', () => {
    test('flags secrecy language combined with gift card mention', () => {
        const result = checkEmailScams(makeEmail({
            bodyText: 'This should be confidential. I need you to buy some gift cards for employee rewards. Get this done today.'
        }));
        expect(result.flagged).toBe(true);
        expect(result.indicators).toContain('Authority pressure + secrecy language');
    });

    test('flags "cannot take calls" + existing indicator (gift card)', () => {
        const result = checkEmailScams(makeEmail({
            bodyText: 'I cannot take calls right now. Purchase some google play gift cards. Amount of each should be $200.'
        }));
        expect(result.flagged).toBe(true);
        expect(result.indicators).toContain('Authority pressure + secrecy language');
        // Gift card should also be flagged
        expect(result.indicators).toContain('Gift card payment request');
    });

    test('flags "requires discretion" when other indicators exist', () => {
        const result = checkEmailScams(makeEmail({
            bodyText: 'This requires discretion. Please review the unpaid invoice and send the wire transfer.',
        }));
        expect(result.flagged).toBe(true);
        expect(result.indicators).toContain('Authority pressure + secrecy language');
        expect(result.indicators).toContain('Suspicious financial request');
    });

    test('does NOT flag authority pressure alone without other indicators', () => {
        const result = checkEmailScams(makeEmail({
            bodyText: 'This should be confidential. Please handle carefully.'
        }));
        // Authority pressure requires either hasGiftCard or indicators.length > 0
        expect(result.indicators).not.toContain('Authority pressure + secrecy language');
    });
});

// ─── Detection Class 5: Vague Lure + External Link ──────────────────────────

describe('checkEmailScams — Vague Lure Detection', () => {
    test('flags nostalgic photo lure + external link', () => {
        const result = checkEmailScams(makeEmail({
            bodyText: "I've been meaning to send both of them sooner. I guess they can make you a little nostalgic.",
            rawUrls: ['https://tkygoc.rdlxlcewc.com:8443/']
        }));
        expect(result.flagged).toBe(true);
        expect(result.indicators).toContain('Vague social lure with external link');
        expect(result.score).toBeGreaterThanOrEqual(35);
    });

    test('flags "those pics" + "remember them" lure with external link', () => {
        const result = checkEmailScams(makeEmail({
            bodyText: "I hope you still remember them — those pics.",
            rawUrls: ['https://bwrjz.neaccola.com:8443/AQUACAAM']
        }));
        expect(result.flagged).toBe(true);
        expect(result.indicators).toContain('Vague social lure with external link');
    });

    test('flags "check out this" lure with links', () => {
        const result = checkEmailScams(makeEmail({
            bodyText: 'Hey! Check out this amazing document I found.',
            links: [{ href: 'https://malware.site/doc' }]
        }));
        expect(result.flagged).toBe(true);
        expect(result.indicators).toContain('Vague social lure with external link');
    });

    test('flags voicemail lure with external link', () => {
        const result = checkEmailScams(makeEmail({
            bodyText: 'You have a new voice message. Click to listen.',
            rawUrls: ['https://suspicious.site/vm.mp3']
        }));
        expect(result.flagged).toBe(true);
        expect(result.indicators).toContain('Vague social lure with external link');
    });

    test('flags "shared a document" lure with links', () => {
        const result = checkEmailScams(makeEmail({
            bodyText: 'Someone shared a document with you. Please review this document.',
            links: [{ href: 'https://phishing-site.tk/doc' }]
        }));
        expect(result.flagged).toBe(true);
        expect(result.indicators).toContain('Vague social lure with external link');
    });

    test('does NOT flag vague lure without external link', () => {
        const result = checkEmailScams(makeEmail({
            bodyText: 'I found this old picture from our trip. It made me nostalgic.',
            rawUrls: [],
            links: []
        }));
        expect(result.indicators).not.toContain('Vague social lure with external link');
    });

    test('does NOT flag external link without lure language', () => {
        const result = checkEmailScams(makeEmail({
            bodyText: 'Here is the meeting agenda for tomorrow.',
            rawUrls: ['https://zoom.us/meeting/123']
        }));
        expect(result.indicators).not.toContain('Vague social lure with external link');
    });
});

// ─── Compound / Multi-Signal Scenarios ──────────────────────────────────────

describe('checkEmailScams — Compound Detection', () => {
    test('gift card + sender inconsistency + authority pressure stacks correctly', () => {
        const result = checkEmailScams(makeEmail({
            bodyText: 'This is confidential. I need you to buy some iTunes gift cards now. Scratch the code and send me a photo. Get this done today.',
            senderEmail: 'pastor.tom@gmail.com',
            senderName: 'Pastor Thomas'
        }));
        expect(result.flagged).toBe(true);
        expect(result.indicators).toContain('Gift card payment request');
        expect(result.indicators).toContain('Official name from personal email address');
        expect(result.indicators).toContain('Authority pressure + secrecy language');
        // 50 (gift card) + 40 (sender) + 30 (authority) = 120
        expect(result.score).toBeGreaterThanOrEqual(120);
        expect(result.severity).toBe('CRITICAL');
    });

    test('invoice fraud + authority pressure stacks to HIGH+', () => {
        const result = checkEmailScams(makeEmail({
            bodyText: 'This requires discretion. The invoice is overdue and wire transfer must happen today. Here are the new bank details.',
        }));
        expect(result.flagged).toBe(true);
        expect(result.indicators).toContain('Suspicious financial request');
        expect(result.indicators).toContain('Authority pressure + secrecy language');
        // 30 (invoice) + 30 (authority) = 60
        expect(result.score).toBeGreaterThanOrEqual(60);
        expect(result.severity).toBe('CRITICAL');
    });

    test('clean legitimate email returns SAFE', () => {
        const result = checkEmailScams(makeEmail({
            bodyText: 'Hi team, please review the Q4 report and let me know your thoughts before Friday.',
            senderEmail: 'manager@company.com',
            senderName: 'Sarah Chen'
        }));
        expect(result.flagged).toBe(false);
        expect(result.score).toBe(0);
        expect(result.severity).toBe('NONE');
    });
});

// ─── Output Schema Validation ───────────────────────────────────────────────

describe('checkEmailScams — Output Shape', () => {
    test('returns all expected fields', () => {
        const result = checkEmailScams(makeEmail({
            bodyText: 'buy a gift card and let me know'
        }));
        expect(result).toHaveProperty('title', 'check_email_scams');
        expect(result).toHaveProperty('description');
        expect(result).toHaveProperty('flagged');
        expect(result).toHaveProperty('severity');
        expect(result).toHaveProperty('details');
        expect(result).toHaveProperty('indicators');
        expect(result).toHaveProperty('visualIndicators');
        expect(result).toHaveProperty('dataChecked');
        expect(result).toHaveProperty('matches');
        expect(result).toHaveProperty('score');
        expect(Array.isArray(result.indicators)).toBe(true);
        expect(Array.isArray(result.visualIndicators)).toBe(true);
        expect(Array.isArray(result.matches)).toBe(true);
    });

    test('matches array contains the specific keywords found', () => {
        const result = checkEmailScams(makeEmail({
            bodyText: 'Please buy google play gift cards and scratch the code.'
        }));
        expect(result.matches).toContain('google play');
        expect(result.matches).toContain('buy');
        expect(result.matches).toContain('scratch');
    });

    test('dataChecked truncates at 5000 chars', () => {
        const longBody = 'x'.repeat(6000);
        const result = checkEmailScams(makeEmail({ bodyText: longBody }));
        expect(result.dataChecked.length).toBeLessThanOrEqual(5000);
    });
});
