import { detectContext, detectEmailMetadata } from '../../src/lib/context-detector.js';

describe('Context Detector', () => {
    beforeEach(() => {
        // Mock window.location
        delete window.location;
        window.location = { href: 'http://localhost' };
        document.body.innerHTML = '';
    });

    test('detects generic context by default', () => {
        const context = detectContext();
        expect(context.type).toBe('generic');
    });

    test('detects Gmail context via URL and DOM', () => {
        window.location.href = 'https://mail.google.com/mail/u/0/#inbox';
        document.body.innerHTML = '<div role="main"></div>';

        const context = detectContext();
        expect(context.type).toBe('email');
        expect(context.provider).toBe('gmail');
        expect(context.confidence).toBeGreaterThanOrEqual(70);
    });

    test('scores link suspicion correctly', () => {
        const context = { type: 'email', provider: 'gmail' };
        document.body.innerHTML = `
            <div class="ii gt">
                <div class="a3s">
                    <a href="http://scam-site.com/login">paypal.com</a>  <!-- Mismatch: +40 -->
                    <a href="http://192.168.1.1/login">Click here</a> <!-- IP: +50 -->
                    <a href="https://google.com">Safe link</a>
                </div>
            </div>
        `;

        const metadata = detectEmailMetadata(context);
        const suspiciousLinks = metadata.links.filter(l => l.suspicious);

        expect(suspiciousLinks.length).toBe(2);
        expect(metadata.links.find(l => l.href.includes('google.com')).suspicious).toBe(false);
    });
});
