import { jest } from '@jest/globals';

// Store original setTimeout
const originalSetTimeout = global.setTimeout;
const originalClearTimeout = global.clearTimeout;

// Use Jest's robust timers
jest.useFakeTimers();

// Mute console output during tests
const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

import { verifyWithAI } from '../../extension/src/lib/ai-verifier.js';

describe('BUG-141: AI Background Fetch Timeout Hardenings', () => {

    afterAll(() => {
        jest.useRealTimers();
        consoleSpy.mockRestore();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should cleanly abort fetch using Promise.race + AbortController and return INCONCLUSIVE after 15s', async () => {
        
        let abortPromiseResolved = false;
        
        // Mock fetch to simulate an indefinite hang, but respect the AbortSignal
        global.fetch = jest.fn((url, options) => {
            return new Promise((resolve, reject) => {
                if (options.signal) {
                    // Listen for the abort event
                    options.signal.addEventListener('abort', () => {
                        abortPromiseResolved = true;
                        const abortError = new Error('The operation was aborted');
                        abortError.name = 'AbortError';
                        reject(abortError);
                    });
                }
                // Never resolve naturally to simulate dead TCP socket or Gemini stall
            });
        });

        // Start the verification routine (this internally sets up the 15s timeout and abort controller)
        const verificationPromise = verifyWithAI('http://example.com/stalled', {
            signals: ['PHISHTANK_MATCH'],
            phrases: [],
            intentKeywords: [],
            emailContext: null,
            contextType: 'WEB'
        }, { apiKey: 'dummy_key' });

        // Fast forward 16 seconds (past the 15s internal timeout)
        jest.advanceTimersByTime(16000);

        // Await the promise to ensure it resolved instead of hanging
        const result = await verificationPromise;

        // VERIFICATIONS
        expect(global.fetch).toHaveBeenCalled();
        expect(abortPromiseResolved).toBe(true);

        // Result should be the clean INCONCLUSIVE timeout verdict, NOT the CONFIRMED fallback
        expect(result.verdict).toBe('INCONCLUSIVE');
        expect(result.reason).toContain('timed out');
        
        // Critically: _isTimeout flag MUST be true, ensuring handler.js won't write a false positive to cache!
        expect(result._isTimeout).toBe(true);
    });
});
