
import { jest } from '@jest/globals';

// Silence console warnings/errors for clean test runs
jest.spyOn(console, 'warn').mockImplementation(() => { });
jest.spyOn(console, 'error').mockImplementation(() => { });

// Mock chrome.runtime.getManifest
globalThis.chrome = {
    runtime: {
        getManifest: () => ({ version: '1.0.125' })
    },
    storage: {
        local: {
            get: jest.fn((keys, cb) => {
                if (cb) cb({ settings: { saApiKey: 'test-api-key' } });
                return Promise.resolve({ settings: { saApiKey: 'test-api-key' } });
            })
        }
    }
};

// Mock fetch globally (supabase.js uses fetch via postEdgeFunction)
const mockFetch = jest.fn();
globalThis.fetch = mockFetch;

describe('Supabase Service', () => {
    let submitReport, submitUserReport, reportDetection, submitCorrection;

    beforeAll(async () => {
        const module = await import('../../extension/src/lib/supabase.js');
        submitReport = module.submitReport;
        submitUserReport = module.submitUserReport;
        reportDetection = module.reportDetection;
        submitCorrection = module.submitCorrection;
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('submitUserReport', () => {
        it('should submit a user report successfully via edge function', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ ok: true, id: 'report-123' })
            });

            const result = await submitUserReport(
                'https://scam.com',
                'phishing',
                'Suspicious email',
                { sender: 'scammer@evil.com', subject: 'You won!', body_text: 'Click here...' }
            );

            expect(result.success).toBe(true);
            expect(result.id).toBe('report-123');

            // Verify fetch was called with correct endpoint and payload
            expect(mockFetch).toHaveBeenCalledTimes(1);
            const [url, options] = mockFetch.mock.calls[0];
            expect(url).toContain('sa-report-user');
            expect(options.method).toBe('POST');

            const body = JSON.parse(options.body);
            expect(body.url).toBe('https://scam.com');
            expect(body.report_type).toBe('phishing');
            expect(body.description).toBe('Suspicious email');
            expect(body.sender_email).toBe('scammer@evil.com');
            expect(body.subject).toBe('You won!');
            expect(body.extension_version).toBe('1.0.125');
        });

        it('should handle edge function errors gracefully', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 500,
                json: () => Promise.resolve({ message: 'Internal server error' })
            });

            const result = await submitUserReport('https://scam.com', 'scam');

            expect(result.success).toBe(false);
            expect(result.error).toContain('Internal server error');
        });

        it('should handle network failures gracefully', async () => {
            mockFetch.mockRejectedValueOnce(new Error('Network error'));

            const result = await submitUserReport('https://scam.com', 'scam');

            expect(result.success).toBe(false);
            expect(result.error).toBe('Network error');
        });

        it('should default report_type to scam when not provided', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ ok: true, id: 'report-456' })
            });

            await submitUserReport('https://example.com');

            const body = JSON.parse(mockFetch.mock.calls[0][1].body);
            expect(body.report_type).toBe('scam');
        });

        it('should truncate body_preview to 4000 chars', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ ok: true, id: 'report-789' })
            });

            const longBody = 'x'.repeat(10000);
            await submitUserReport('https://example.com', 'scam', '', { body_text: longBody });

            const body = JSON.parse(mockFetch.mock.calls[0][1].body);
            expect(body.body_preview.length).toBe(4000);
        });
    });

    describe('submitReport (deprecated shim)', () => {
        it('should delegate to submitUserReport', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ ok: true, id: 'shim-123' })
            });

            const result = await submitReport('https://scam.com', 'phishing', 'Bad site');

            expect(result.success).toBe(true);
            // Should have called the sa-report-user endpoint (not sa-report-detection)
            const [url] = mockFetch.mock.calls[0];
            expect(url).toContain('sa-report-user');
        });
    });

    describe('reportDetection', () => {
        it('should report a detection via edge function', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ id: 'det-123' })
            });

            const result = await reportDetection(
                'abc123hash',
                { hard: ['phishing_url'], soft: ['suspicious_domain'] },
                'HIGH'
            );

            expect(result.success).toBe(true);
            expect(result.id).toBe('det-123');

            const [url, options] = mockFetch.mock.calls[0];
            expect(url).toContain('sa-report-detection');
            const body = JSON.parse(options.body);
            expect(body.url_hash).toBe('abc123hash');
            expect(body.severity).toBe('HIGH');
        });
    });

    describe('submitCorrection', () => {
        it('should submit a correction via edge function', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ review_triggered: true, verdict: 'pending' })
            });

            const result = await submitCorrection('abc123hash', 'false_positive', {
                userComment: 'This is a legitimate site'
            });

            expect(result.success).toBe(true);
            expect(result.reviewTriggered).toBe(true);

            const [url, options] = mockFetch.mock.calls[0];
            expect(url).toContain('sa-submit-correction');
            const body = JSON.parse(options.body);
            expect(body.feedback).toBe('false_positive');
            expect(body.user_comment).toBe('This is a legitimate site');
        });
    });
});
