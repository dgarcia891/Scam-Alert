import { checkEmailScams } from './src/lib/analyzer/email-heuristics.js';

const body = `Robinhood

Verify your identity

To finish logging in, please enter the following verification code. This code will expire in 10 minutes.

786647

Didn't request this? If you didn't try to log in to your Robinhood account, please contact us immediately at (852690-123 (8 to secure your account.

Robinhood Financial LLC is a registered broker-dealer (member SIPC). Robinhood Securities, LLC provides brokerage clearing services. Robinhood Crypto, LLC provides crypto currency trading. All are subsidiaries of Robinhood Markets, Inc.

© 2026 Robinhood. All rights reserved.

85 Willow Road, Menlo Park, CA 94025`;

const result = checkEmailScams({
    isEmailView: true,
    bodyText: body,
    senderEmail: '251827-msg+security.robinhood@mg.msgsndr.biz',
    senderName: 'Robinhood',
    subject: "Here's your requested code: 786647"
});

console.log(JSON.stringify(result, null, 2));
