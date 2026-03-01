
import { jest } from '@jest/globals';

const mockGet = jest.fn();
const mockSet = jest.fn();
const mockRemove = jest.fn();

const mockGetVerifiedScams = jest.fn();
const mockMergeBlocklist = jest.fn();

import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const supabasePath = path.resolve(__dirname, '../../extension/src/lib/supabase.js');
const storagePath = path.resolve(__dirname, '../../extension/src/lib/storage.js');

// ESM Mocking - Use regex or absolute path to be sure
jest.unstable_mockModule(supabasePath, () => ({
    getVerifiedScams: mockGetVerifiedScams,
    submitReport: jest.fn(),
    default: { from: jest.fn() }
}));

jest.unstable_mockModule(storagePath, () => ({
    mergeBlocklist: mockMergeBlocklist,
    getSettings: jest.fn(),
    updateSettings: jest.fn(),
    getStats: jest.fn(),
    updateStats: jest.fn(),
    getCachedScan: jest.fn(),
    cacheScan: jest.fn(),
    isWhitelisted: jest.fn(),
    addToWhitelist: jest.fn(),
    getWhitelist: jest.fn(),
    clearCache: jest.fn(),
    isPro: jest.fn(),
    repairStatistics: jest.fn(),
    normalizeUrl: jest.fn(url => url),
    addToBlocklist: jest.fn(),
    removeFromBlocklist: jest.fn(),
    getBlocklist: jest.fn()
}));

const chromeMock = {
    storage: {
        local: {
            get: mockGet,
            set: mockSet,
            remove: mockRemove
        }
    }
};

global.chrome = chromeMock;

describe('Sync Manager', () => {
    let syncManager;

    beforeAll(async () => {
        const module = await import('../../extension/src/background/lib/sync-manager.js');
        syncManager = module.syncManager;
    });

    beforeEach(() => {
        jest.clearAllMocks();
        // Reset sync state via a hack (since it's a singleton)
        syncManager.syncInProgress = false;
    });

    it('should skip sync if interval not met', async () => {
        const now = Date.now();
        mockGet.mockResolvedValue({ lastBlocklistSync: now - 1000 }); // Just synced

        const result = await syncManager.sync();

        expect(result.skipped).toBe(true);
        expect(mockGetVerifiedScams).not.toHaveBeenCalled();
    });

    it('should force sync even if interval not met', async () => {
        const now = Date.now();
        mockGet.mockResolvedValue({ lastBlocklistSync: now - 1000 });
        mockGetVerifiedScams.mockResolvedValue([]);

        const result = await syncManager.sync(true); // Force = true

        expect(result.success).toBe(true);
        expect(mockGetVerifiedScams).toHaveBeenCalled();
    });

    it('should merge verified scams into blocklist', async () => {
        mockGet.mockResolvedValue({ lastBlocklistSync: 0 }); // Never synced
        const mockScams = [{ url: 'http://scam.com' }, { url: 'http://phish.net' }];
        mockGetVerifiedScams.mockResolvedValue(mockScams);
        mockMergeBlocklist.mockResolvedValue(2);

        const result = await syncManager.sync();

        expect(result.success).toBe(true);
        expect(mockGetVerifiedScams).toHaveBeenCalled();
        expect(mockMergeBlocklist).toHaveBeenCalledWith(['http://scam.com', 'http://phish.net']);
        expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({ lastBlocklistSync: expect.any(Number) }));
    });

    it('should handle API errors gracefully', async () => {
        mockGet.mockResolvedValue({ lastBlocklistSync: 0 });
        mockGetVerifiedScams.mockRejectedValue(new Error('API Down'));

        const result = await syncManager.sync();

        expect(result.success).toBe(false);
        expect(result.error).toBe('API Down');
        expect(syncManager.syncInProgress).toBe(false);
    });
});
