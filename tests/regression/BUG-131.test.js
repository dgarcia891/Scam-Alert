import { deriveStatusFromResults } from '../../extension/src/ui/popup/status-helper.js';
import assert from 'assert';

console.log('Running BUG-131 regression test...');

try {
    const mockEmailUrl = 'https://mail.google.com/mail/u/0/#inbox/12345';
    
    // 1. Email URL with missing email content -> SHOULD RETURN 'unknown', NOT 'secure'
    const emailResultWithoutContent = {
        overallSeverity: 'SAFE',
        overallThreat: false,
        metadata: {
            linkCount: 0
        }
    };
    
    const status1 = deriveStatusFromResults(emailResultWithoutContent, false, mockEmailUrl);
    assert.strictEqual(status1, 'unknown', `Expected status to be 'unknown' for email without context, got '${status1}'`);
    
    console.log('✅ BUG-131 regression test passed!');
} catch (error) {
    console.error('❌ BUG-131 regression test failed:', error.message);
    process.exit(1);
}
