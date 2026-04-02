import { analyzeUrl } from './src/lib/pattern-analyzer.js';

const pageContent = {
    isEmailView: true,
    bodyText: "Robinhood Verify your identity To finish logging in, please enter the following verification code...",
    senderEmail: '251827-msg+security.robinhood@mg.msgsndr.biz',
    senderName: 'Robinhood',
    subject: "Here's your requested code: 786647"
};

async function run() {
    const result = await analyzeUrl('https://mail.google.com/mail/u/0', pageContent);

    const allIndicators = [];
    Object.values(result.checks).forEach(check => {
        if (check.flagged && check.visualIndicators && Array.isArray(check.visualIndicators)) {
            allIndicators.push(...check.visualIndicators);
        }
    });

    console.log("Flagged Checks:", Object.entries(result.checks).filter(([, v]) => v.flagged).map(([k]) => k));
    console.log("\nVisual Indicators collected:");
    console.log(JSON.stringify(allIndicators, null, 2));
}
run();
