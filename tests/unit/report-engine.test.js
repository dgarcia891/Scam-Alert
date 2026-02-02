import { generateScanResults } from '../../src/lib/report-engine.js';

describe('Report Engine', () => {
    test('generates transparent scan results correctly', () => {
        const detections = {
            pattern: {
                riskScore: 45,
                checks: {
                    typosquatting: { flagged: true, title: 'Check Typosquatting', details: 'Brand mismatch' },
                    nonHttps: { flagged: false, title: 'Check SSL' }
                }
            },
            googleSafeBrowsing: {
                safe: true,
                description: 'Service description'
            }
        };

        const results = generateScanResults(detections, 'MEDIUM');

        expect(results.overallSeverity).toBe('MEDIUM');
        expect(results.summary.total).toBe(3); // typosquatting + nonHttps + GSB
        expect(results.summary.warnings).toBe(1); // just typosquatting

        const typoCheck = results.checksPerformed.find(c => c.id === 'typosquatting');
        expect(typoCheck.label).toBe('Brand Impersonation Check'); // From mapping
        expect(typoCheck.status).toBe('failed');
    });
});
