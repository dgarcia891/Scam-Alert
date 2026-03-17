import { isKnownEmailClient, getMatchingClient } from '../../extension/src/config/email-clients.js';
import assert from 'assert';

console.log('Running email-clients.js tests...');

try {
    // 1. Valid Email Client Detection
    assert.strictEqual(isKnownEmailClient('https://mail.google.com/mail/u/0/'), true, 'Gmail should match');
    assert.strictEqual(isKnownEmailClient('https://outlook.live.com/mail/0/inbox'), true, 'Outlook Live should match');
    assert.strictEqual(isKnownEmailClient('https://outlook.office365.com/mail/'), true, 'Office 365 should match');
    assert.strictEqual(isKnownEmailClient('https://mail.yahoo.com/d/folders/1'), true, 'Yahoo should match');
    assert.strictEqual(isKnownEmailClient('https://webmail.mycompany.com/roundcube/'), true, 'Roundcube path should match');
    assert.strictEqual(isKnownEmailClient('https://roundcube.mycompany.com/'), true, 'Roundcube subdomain should match');
    assert.strictEqual(isKnownEmailClient('https://mail.proton.me/u/0/inbox'), true, 'ProtonMail should match');

    // 2. Specific matching checks
    const gmailMatch = getMatchingClient('https://mail.google.com/mail/u/0/');
    assert.strictEqual(gmailMatch?.id, 'gmail');

    const outlookMatch = getMatchingClient('https://outlook.office.com/mail/');
    assert.strictEqual(outlookMatch?.id, 'outlook');

    const rcMatch = getMatchingClient('https://webmail.example.com/roundcubemail/');
    assert.strictEqual(rcMatch?.id, 'roundcube');

    // 3. Title-based matching
    const titleMatch = getMatchingClient('https://unknown-domain.com/mail/', 'Roundcube Webmail :: Inbox');
    assert.strictEqual(titleMatch?.id, 'roundcube', 'Should match Roundcube by title if URL fails');

    // 4. False Positives (Broad matching prevention)
    assert.strictEqual(isKnownEmailClient('https://github.com/roundcube/roundcubemail'), false, 'GitHub repo should NOT match');
    assert.strictEqual(isKnownEmailClient('https://example.com/blog/how-to-install-roundcube'), false, 'Blog post should NOT match');
    assert.strictEqual(isKnownEmailClient('https://news.ycombinator.com/item?id=12345'), false, 'Random URL should NOT match');

    console.log('✅ All email-clients.js tests passed!');
} catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
}
