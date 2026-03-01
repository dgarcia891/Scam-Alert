import { jest } from '@jest/globals';
import { checkAICanRun, incrementRateCounters } from '../../extension/src/lib/ai-rate-limiter.js';

describe('AI Rate Limiter (FEAT-088)', () => {
    beforeEach(() => {
        chrome.storage.local.get.mockClear();
        chrome.storage.local.set.mockClear();
    });

    test('allowed when cache is empty', async () => {
        chrome.storage.local.get.mockReturnValue({});
        const result = await checkAICanRun('https://example.com', { aiDailyCeiling: 50 });
        expect(result.allowed).toBe(true);
    });

    test('blocked if daily ceiling reached', async () => {
        const today = new Date().toISOString().split('T')[0];
        const key = `sa_ai_rate_global_${today}`;
        chrome.storage.local.get.mockReturnValue({ [key]: 50 });

        const result = await checkAICanRun('https://example.com', { aiDailyCeiling: 50 });
        expect(result.allowed).toBe(false);
        expect(result.reason).toBe('daily_ceiling');
    });

    test('blocked if domain in cooldown', async () => {
        const hostname = 'example.com';
        const key = `sa_ai_rate_domain_${hostname}`;
        chrome.storage.local.get.mockReturnValue({ [key]: Date.now() - 1000 }); // Just called

        const result = await checkAICanRun('https://example.com', { aiDailyCeiling: 50 });
        expect(result.allowed).toBe(false);
        expect(result.reason).toBe('domain_cooldown');
    });

    test('increment correctly updates both counters', async () => {
        const hostname = 'test.com';
        chrome.storage.local.get.mockReturnValue({});

        await incrementRateCounters(hostname);

        expect(chrome.storage.local.set).toHaveBeenCalledTimes(1);
        const setArgs = chrome.storage.local.set.mock.calls[0][0];

        expect(setArgs[`sa_ai_rate_domain_${hostname}`]).toBeDefined();

        const globalKeys = Object.keys(setArgs).filter(k => k.startsWith('sa_ai_rate_global_'));
        expect(globalKeys.length).toBe(1);
    });
});
