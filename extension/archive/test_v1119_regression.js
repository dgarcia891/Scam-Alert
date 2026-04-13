/**
 * Regression Tests for v1.1.19 Bug Fixes
 * BUG-150: Name mismatch score reduction
 * BUG-151: SHOW_WARNING routing  
 * BUG-152: Backend sync flag
 */

// ═══════════════════════════════════════════════════════════════
// BUG-150: Name Mismatch Scoring
// ═══════════════════════════════════════════════════════════════

import { checkEmailScams } from './src/lib/analyzer/email-heuristics.js';

function runTest(name, fn) {
    try {
        fn();
        console.log(`✅ PASS: ${name}`);
        return true;
    } catch (e) {
        console.error(`❌ FAIL: ${name}\n   ${e.message}`);
        return false;
    }
}

function assert(condition, msg) {
    if (!condition) throw new Error(msg);
}

let passed = 0, failed = 0;

// Test 1: Name mismatch alone should NOT trigger HIGH
const result1 = checkEmailScams({
    isEmailView: true,
    bodyText: 'Please log into the Workday system to complete this action.',
    senderEmail: 'therealreal@myworkday.com',
    senderName: 'Workday Notification',
    subject: 'A Task Awaits You: David Garcia',
    links: [],
    rawUrls: []
});

if (runTest('Name mismatch alone → NOT HIGH', () => {
    assert(result1.severity !== 'HIGH' && result1.severity !== 'CRITICAL',
        `Expected NONE or LOW, got ${result1.severity} (score: ${result1.score})`);
})) passed++; else failed++;

if (runTest('Name mismatch alone → score <= 20', () => {
    // Name mismatch should contribute +15, which is below the 30 threshold
    assert(result1.score <= 20,
        `Expected score <= 20, got ${result1.score}`);
})) passed++; else failed++;

// Test 2: Security lure alone (score=30) should still trigger HIGH
const result2 = checkEmailScams({
    isEmailView: true,
    bodyText: 'Your account has been locked. Verify your identity immediately. Action required: confirm your identity now.',
    senderEmail: 'security@bankofamerica.com',
    senderName: 'Bank of America',
    subject: 'Action Required - Account Suspended',
    links: [],
    rawUrls: []
});

if (runTest('Security lure (2+ keywords) → still HIGH', () => {
    assert(result2.severity === 'HIGH' || result2.severity === 'CRITICAL',
        `Expected HIGH/CRITICAL, got ${result2.severity} (score: ${result2.score})`);
})) passed++; else failed++;

// Test 3: Name mismatch + security lure → should be HIGH
const result3 = checkEmailScams({
    isEmailView: true,
    bodyText: 'Your subscription has expired. Action required to verify your account. Card declined.',
    senderEmail: 'noreply@suspicious-service.com',
    senderName: 'David Garcia',
    subject: 'Urgent: Verify Your Identity',
    links: [],
    rawUrls: []
});

if (runTest('Name mismatch + security lure → HIGH', () => {
    // 15 (mismatch) + 30 (security lure 2+ keywords) = 45 → HIGH
    assert(result3.severity === 'HIGH' || result3.severity === 'CRITICAL',
        `Expected HIGH/CRITICAL, got ${result3.severity} (score: ${result3.score})`);
})) passed++; else failed++;

// Test 4: Gift card request should still be CRITICAL
const result4 = checkEmailScams({
    isEmailView: true,
    bodyText: 'Can you buy some gift cards for me? I need you to purchase a $200 apple card and scratch the back.',
    senderEmail: 'boss@gmail.com',
    senderName: 'CEO Office',
    subject: 'Urgent Request',
    links: [],
    rawUrls: []
});

if (runTest('Gift card scam → still CRITICAL', () => {
    assert(result4.severity === 'CRITICAL',
        `Expected CRITICAL, got ${result4.severity} (score: ${result4.score})`);
})) passed++; else failed++;

// Test 5: Brand spoofing still gets high score
const result5 = checkEmailScams({
    isEmailView: true,
    bodyText: 'Your payment has been declined.',
    senderEmail: 'paypal-support@evilsite.com',
    senderName: 'paypal',
    subject: 'Payment Issue',
    links: [],
    rawUrls: []
});

if (runTest('Brand spoofing in prefix → still HIGH/CRITICAL', () => {
    // "paypal" in displayName matches emailPrefix "paypal-support" → brand spoofing +55
    assert(result5.severity === 'HIGH' || result5.severity === 'CRITICAL',
        `Expected HIGH+, got ${result5.severity} (score: ${result5.score})`);
})) passed++; else failed++;

// Test 6: Legitimate enterprise email should not be flagged
const result6 = checkEmailScams({
    isEmailView: true,
    bodyText: 'You have a new notification from Jira. PROJ-1234 was assigned to you.',
    senderEmail: 'noreply@atlassian.net',
    senderName: 'Jira Cloud',
    subject: '[JIRA] (PROJ-1234) Fix login bug',
    links: [{ href: 'https://company.atlassian.net/browse/PROJ-1234' }],
    rawUrls: ['https://company.atlassian.net/browse/PROJ-1234']
});

if (runTest('Legitimate Jira email → NONE', () => {
    assert(result6.severity === 'NONE',
        `Expected NONE, got ${result6.severity} (score: ${result6.score})`);
})) passed++; else failed++;

console.log(`\n═══ RESULTS: ${passed}/${passed + failed} passed ═══`);
if (failed > 0) process.exit(1);
