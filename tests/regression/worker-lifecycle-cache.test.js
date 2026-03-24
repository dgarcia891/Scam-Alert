/**
 * Regression Test: MV3 Service Worker Cache Persistence
 * 
 * Guards against Finding 1 from the critic report:
 * The domain reputation cache must survive service worker restarts.
 */
import { jest, describe, test, expect, beforeEach } from '@jest/globals';

// Simulate chrome.storage.session as a persistent store
const persistentStore = {};
global.chrome = {
    storage: {
        session: {
            get: jest.fn(async (keyOrKeys) => {
                if (typeof keyOrKeys === 'string') {
                    return { [keyOrKeys]: persistentStore[keyOrKeys] || undefined };
                }
                if (keyOrKeys === null) {
                    return { ...persistentStore };
                }
                return {};
            }),
            set: jest.fn(async (items) => {
                Object.assign(persistentStore, items);
            }),
            remove: jest.fn(async (keys) => {
                const keyArr = Array.isArray(keys) ? keys : [keys];
                for (const k of keyArr) {
                    delete persistentStore[k];
                }
            }),
        },
    },
};

Object.defineProperty(global, 'navigator', {
    value: { onLine: true },
    writable: true,
    configurable: true,
});

describe('MV3 Cache Persistence (Regression)', () => {
    beforeEach(() => {
        for (const key of Object.keys(persistentStore)) {
            delete persistentStore[key];
        }
        jest.clearAllMocks();
    });

    test('cached reputation data persists in chrome.storage.session', async () => {
        const { cacheReputation, getCachedReputation } = await import('../../extension/src/lib/domain-reputation.js');
        
        // Write data
        await cacheReputation('evil.com', { score: 100, status: 'confirmed_dangerous' });

        // Verify it was written to chrome.storage.session (not in-memory)
        expect(chrome.storage.session.set).toHaveBeenCalled();
        expect(persistentStore['domain_rep_evil.com']).toBeDefined();

        // Data should be readable
        const cached = await getCachedReputation('evil.com');
        expect(cached).not.toBeNull();
        expect(cached.score).toBe(100);
        expect(cached.status).toBe('confirmed_dangerous');
    });

    test('does NOT use in-memory cache that would be lost on restart', async () => {
        const { cacheReputation } = await import('../../extension/src/lib/domain-reputation.js');
        await cacheReputation('test.com', { score: 5 });

        // Verify the data went through chrome.storage.session, not an in-memory Map
        expect(chrome.storage.session.set).toHaveBeenCalledTimes(1);
        const callArg = chrome.storage.session.set.mock.calls[0][0];
        expect('domain_rep_test.com' in callArg).toBe(true);
    });
});
