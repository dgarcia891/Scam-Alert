import { analyzeUrl } from '../../extension/src/lib/pattern-analyzer.js';
import { checkEmailScams } from '../../extension/src/lib/analyzer/email-heuristics.js';
import { checkSuspiciousPort } from '../../extension/src/lib/analyzer/url-engine.js';

describe('BUG-083: False Negative on "Nostalgic Photos" Scam', () => {
    const SCAM_URL = 'https://tkygoc.rdlxlcewc.com:8443/';

    test('checkSuspiciousPort should flag non-standard port :8443', async () => {
        const result = checkSuspiciousPort(SCAM_URL);
        expect(result.flagged).toBe(true);
        expect(result.details).toContain('8443');
        expect(result.score).toBeGreaterThanOrEqual(25);
    });

    test('Standard HTTPS port 443 should NOT be flagged', async () => {
        const result = checkSuspiciousPort('https://google.com/');
        expect(result.flagged).toBe(false);
    });

    test('checkEmailScams should flag vague lure keyword + external link', async () => {
        const pageContent = {
            isEmailView: true,
            emailContext: true,
            senderEmail: '202204159228@alunos.estacio.br',
            senderName: 'Rene Rubalcava',
            bodyText: "i've been meaning to send both of them sooner. i guess they can make you a little nostalgic.",
            rawUrls: [SCAM_URL]
        };
        const result = checkEmailScams(pageContent);
        expect(result.flagged).toBe(true);
        expect(result.indicators).toContain('Vague social lure with external link');
    });

    test('analyzeUrl should produce a non-zero risk score for the scam URL', async () => {
        const result = await analyzeUrl(SCAM_URL, null, true);
        expect(result.checks.suspiciousPort.flagged).toBe(true);
        expect(result.riskScore).toBeGreaterThan(0);
    });
});
