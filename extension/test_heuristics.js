import { checkEmailScams } from './src/lib/analyzer/email-heuristics.js';

const safeContent = {
    isEmailView: true,
    bodyText: 'Hello David, we deduct the amounts you owe us from your purchases today. Just let me know if you need any code to login.',
    senderEmail: 'support@ebay.com',
    senderName: 'eBay Support'
};

const result = checkEmailScams(safeContent);

console.log("=== Safe Email Result ===");
console.log("- Flagged:", result.flagged);
console.log("- Score:", result.score);
console.log("- Visual Indicators:", JSON.stringify(result.visualIndicators, null, 2));

const unsafeContent = {
    isEmailView: true,
    bodyText: 'I need you to buy a gift card immediately. Send me the amount of each and scratch the back to read the code.',
    senderEmail: 'boss_personal@gmail.com',
    senderName: 'CEO'
};

const result2 = checkEmailScams(unsafeContent);

console.log("\n=== Unsafe Email Result ===");
console.log("- Flagged:", result2.flagged);
console.log("- Score:", result2.score);
console.log("- Visual Indicators:");
console.log(result2.visualIndicators.map(i => i.phrase));

const safeCompanyEmail = {
    isEmailView: true,
    bodyText: 'Your github personal access token has expired.',
    senderEmail: 'noreply@github.com',
    senderName: 'GitHub'
};

const result3 = checkEmailScams(safeCompanyEmail);

console.log("\n=== Safe Company Email Result ===");
console.log("- Flagged:", result3.flagged);
console.log("- Score:", result3.score);
if (result3.details.includes('match email address')) {
    console.log("FAIL: Sender mismatch wrongly triggered.");
} else {
    console.log("SUCCESS: Display Name check passed.");
}

const spoofCompanyEmail = {
    isEmailView: true,
    bodyText: 'Your github personal access token has expired.',
    senderEmail: 'noreply@github.notreal.com',
    senderName: 'GitHub'
};

const result4 = checkEmailScams(spoofCompanyEmail);

console.log("\n=== Spoofed Company Email Result ===");
console.log("- Flagged:", result4.flagged);
console.log("- Score:", result4.score);
if (result4.details.includes('Sender display name does not match email address')) {
    console.log("SUCCESS: Spoofed sender mismatch correctly triggered!");
} else {
    console.log("FAIL: Spoof bypassed the check!");
}

const robinhoodSpoof = {
    isEmailView: true,
    bodyText: 'Robinhood. Verify your identity. Enter the following code.',
    senderEmail: '251827-msg+security.robinhood@mg.msgsndr.biz',
    senderName: 'Robinhood',
    subject: "Here's your requested code: 786647"
};

const result5 = checkEmailScams(robinhoodSpoof);

console.log("\n=== Robinhood Prefix Spoof Result ===");
console.log("- Flagged:", result5.flagged);
console.log("- Score:", result5.score);
if (result5.details.includes('Brand spoofing detected in email prefix')) {
    console.log("SUCCESS: Prefix spoof correctly triggered!");
} else {
    console.log("FAIL: Prefix spoof bypassed the check!");
}

const robinhoodLegit = {
    isEmailView: true,
    bodyText: 'Verify your identity to log in.',
    senderEmail: 'noreply@robinhood.com',
    senderName: 'Robinhood',
    subject: "Your Robinhood verification code"
};

const result6 = checkEmailScams(robinhoodLegit);

console.log("\n=== Robinhood Legit Result ===");
console.log("- Flagged:", result6.flagged);
console.log("- Score:", result6.score);
if (result6.flagged) {
    console.log("FAIL: Legit robinhood triggered as spoof!");
} else {
    console.log("SUCCESS: Legit robinhood correctly validated!");
}

console.log("\n=== Testing Individual Highlight Extraction ===");
const robinhoodHighlight = {
    isEmailView: true,
    bodyText: 'Robinhood. Verify your identity. Enter the verification code.',
    senderEmail: '251827-msg+security.robinhood@mg.msgsndr.biz',
    senderName: 'Robinhood',
    subject: "Here's your requested code: 786647"
};

const result7 = checkEmailScams(robinhoodHighlight);
const visualPhraseChecks = result7.visualIndicators.map(i => i.phrase.toLowerCase());
if (visualPhraseChecks.includes('verify') && visualPhraseChecks.includes('identity')) {
    console.log("SUCCESS: Extracted individual words for highlighting!");
} else {
    console.log("FAIL: Individual words are missing from visualIndicators! Current details: " + visualPhraseChecks.join(', '));
}


// BUG-161: Regression — Robinhood transactional email false positive
const robinhoodTransactional = {
    isEmailView: true,
    bodyText: "You've got $5.00 available as an Instant Deposit for your recent transfer from your bank account ending in ****117. Please make sure your bank account balance is at $5.00 or more while your money is on the move! Learn more in our Help Center. - The Robinhood team",
    senderEmail: 'noreply@robinhood.com',
    senderName: 'Robinhood',
    subject: 'Funds available for investing',
    links: [{ href: 'https://robinhood.com/us/en/support/articles/deposit' }, { href: 'https://www.facebook.com/robinhoodapp' }, { href: 'https://twitter.com/RobinhoodApp' }],
    rawUrls: ['https://robinhood.com/us/en/support/articles/deposit', 'https://www.facebook.com/robinhoodapp', 'https://twitter.com/RobinhoodApp']
};
const result8 = checkEmailScams(robinhoodTransactional);
console.log("\n=== BUG-161: Robinhood Transactional (must NOT flag) ===");
console.log("Flagged:", result8.flagged, "| Score:", result8.score, "| Indicators:", result8.indicators.join(', ') || 'none');
console.log(result8.flagged ? "FAIL: Incorrectly flagged!" : "SUCCESS: Correctly NOT flagged.");

// ============================================================
// TEST-DB-1: securityKeywords DB-pattern end-to-end wire test
// Verifies: DB patterns with category='securityKeywords' flow
// from getMergedEmailKeywords() → checkEmailScams() and
// correctly activate the 'Account security or payment lure' heuristic.
// ============================================================
console.log("\n=== TEST-DB-1: DB-sourced securityKeywords end-to-end ===");

// Simulate two DB patterns (category: securityKeywords) that aren't in the hardcoded list
const mockDbSecurityPatterns = ['payment overdue', 'billing issue detected'];

const dbKeywordsEmail = {
    isEmailView: true,
    bodyText: 'Your account has a payment overdue notice. We detected a billing issue detected on your account. Please verify to continue.',
    senderEmail: 'billing@randomdomain.net',
    senderName: 'Billing Department'
};

// Pass dynamicEmailKeywords as second arg — simulating what pattern-analyzer.js does
const result9 = checkEmailScams(dbKeywordsEmail, {
    securityKeywords: mockDbSecurityPatterns
});

console.log("- Flagged:", result9.flagged);
console.log("- Score:", result9.score);
console.log("- Indicators:", result9.indicators?.join(', ') || 'none');

if (result9.flagged && result9.indicators.includes('Account security or payment lure')) {
    console.log("SUCCESS: DB securityKeywords correctly activated 'Account security or payment lure'!");
} else {
    console.log("FAIL: DB securityKeywords did NOT activate the heuristic.");
    console.log("  Evidence:", JSON.stringify(result9.evidence?.securityKeywordsFound));
}

// Also verify that ONE DB keyword alone is NOT enough (requires ≥2 matches)
const singleKeywordEmail = {
    isEmailView: true,
    bodyText: 'Your account has a payment overdue notice. Please contact us.',
    senderEmail: 'billing@randomdomain.net',
    senderName: 'Billing Department'
};
const result10 = checkEmailScams(singleKeywordEmail, {
    securityKeywords: mockDbSecurityPatterns
});
console.log("\n=== TEST-DB-1b: Single DB keyword (must NOT fire — requires ≥2) ===");
if (!result10.flagged || !result10.indicators.includes('Account security or payment lure')) {
    console.log("SUCCESS: Single DB keyword correctly did not trigger (threshold = 2).");
} else {
    console.log("FAIL: Single DB keyword incorrectly triggered the heuristic!");
}

// ============================================================
// TC-CASE-1: Uppercase DB phrase detection (case-sensitivity fix)
// Validates: Phrases with mixed case from the remote DB are correctly
// matched against the lowercased email body.
// ============================================================
console.log("\n=== TC-CASE-1: Uppercase DB phrase in email (no links) ===");

const caseTestEmail = {
    isEmailView: true,
    bodyText: 'IRS has filed a lawsuit against you. Do not discuss this with anyone.',
    senderEmail: 'agent@fake-irs.gov.com',
    senderName: 'IRS Agent'
};
const caseResult = checkEmailScams(caseTestEmail, {
    genericPhrases: ['IRS has filed a lawsuit against you', 'do not discuss this with anyone']
});
console.log("- Flagged:", caseResult.flagged);
console.log("- Score:", caseResult.score);
console.log("- Indicators:", caseResult.indicators?.join(', ') || 'none');

if (caseResult.flagged && caseResult.indicators.includes('Remote scam phrase detected')) {
    console.log("SUCCESS: Uppercase DB phrases correctly detected via standalone check!");
} else {
    console.log("FAIL: Uppercase DB phrases NOT detected. Case-sensitivity or routing bug persists.");
}
if (caseResult.score >= 40) {
    console.log("SUCCESS: Score >= 40 (dual match bonus applied).");
} else {
    console.log("FAIL: Score too low (" + caseResult.score + "). Expected >= 40 for 2 generic phrases.");
}

// ============================================================
// TC-ROUTE-1: Generic phrases fire WITHOUT external links
// Validates: The standalone generic phrase check fires unconditionally,
// NOT gated on hasExternalLinks like vagueLureKeywords.
// This is the exact scenario the v2 plan would have MISSED.
// ============================================================
console.log("\n=== TC-ROUTE-1: Generic phrases fire without external links ===");

const noLinksEmail = {
    isEmailView: true,
    bodyText: 'Purchase gift cards to resolve this matter. Scratch the back of the card and send me a picture.',
    senderEmail: 'boss@gmail.com',
    senderName: 'CEO'
};
const noLinksResult = checkEmailScams(noLinksEmail, {
    genericPhrases: ['purchase gift cards to resolve', 'scratch the back of the card']
});
console.log("- Flagged:", noLinksResult.flagged);
console.log("- Score:", noLinksResult.score);
console.log("- Indicators:", noLinksResult.indicators?.join(', ') || 'none');

if (noLinksResult.flagged) {
    console.log("SUCCESS: Flagged even with zero external links!");
} else {
    console.log("FAIL: Not flagged — standalone check is broken or phrases routed to vagueLureKeywords.");
}
if (noLinksResult.indicators.includes('Remote scam phrase detected')) {
    console.log("SUCCESS: 'Remote scam phrase detected' indicator present.");
} else {
    console.log("FAIL: Missing 'Remote scam phrase detected' indicator.");
}

