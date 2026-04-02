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

