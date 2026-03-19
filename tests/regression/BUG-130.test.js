import { extractEmailText } from '../../extension/src/lib/scanner/parser.js';
import assert from 'assert';

console.log('Running BUG-130 regression test...');

try {
    // Mock a global document object specifically for parser.js inside this test
    global.document = {
        querySelector: (selector) => {
            // Simulate that .a3s variants don't match, but .ii.gt does
            if (selector === '.ii.gt') {
                return {
                    innerText: "Why is this message in spam? This message is similar to messages that were identified as spam in the past. \n\nOn Wednesday, March 18, 2026 06:38 AM, Erica wrote: \nCouldn't help but feel a little bit sentimental about that photo."
                };
            }
            return null;
        },
        querySelectorAll: (selector) => {
            if (selector === 'iframe') return [];
            return [];
        }
    };

    const text = extractEmailText();
    
    assert.ok(text.includes('sentimental about that photo'), 'Failed to extract email text using fallback .ii.gt selector');
    
    console.log('✅ BUG-130 regression test passed!');
} catch (error) {
    console.error('❌ BUG-130 regression test failed:', error.message);
    process.exit(1);
}
