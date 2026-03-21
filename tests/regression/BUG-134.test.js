import { checkUrlObfuscation } from '../../extension/src/lib/analyzer/url-engine.js';
import assert from 'assert';

function runTest() {
    console.log('Running BUG-134 regression test...');

    const targetUrlWithQuery = 'https://www.youtube.com/signin_prompt?app=desktop&next=https%3A%2F%2Fwww.youtube.com%2F';
    const targetUrlWithAt = 'https://www.youtube.com/@mkbhd';

    try {
        // 1. Check query string encoding false positive
        const queryResult = checkUrlObfuscation(targetUrlWithQuery);
        console.log('Query Obfuscation Check Score:', queryResult.score);
        assert.strictEqual(queryResult.flagged, false, `Expected query URL not to be flagged, got ${queryResult.details}`);

        // 2. Check path @ symbol false positive
        const atResult = checkUrlObfuscation(targetUrlWithAt);
        console.log('@ Symbol Obfuscation Check Score:', atResult.score);
        assert.strictEqual(atResult.flagged, false, `Expected @ URL not to be flagged, got ${atResult.details}`);

        console.log('✅ BUG-134 regression test passed!');
    } catch (error) {
        console.error('❌ BUG-134 regression test failed:', error.message);
        process.exit(1);
    }
}

runTest();
