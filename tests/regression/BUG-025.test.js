
import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { updateStats, getStats } from '../../extension/src/lib/storage.js';

describe('BUG-025: Activity Log Persistence Failure', () => {

    beforeEach(() => {
        chrome.storage.local.get.mockClear();
        chrome.storage.local.set.mockClear();
    });

    it('should append activity even if previous recentActivity was undefined (corrupted state)', async () => {
        // Simulate a "broken" state: totalScans exists, but recentActivity is missing
        const corruptedState = {
            totalScans: 104,
            threatsBlocked: 0,
            // recentActivity is missing!
        };

        chrome.storage.local.get.mockResolvedValue({ statistics: corruptedState });
        chrome.storage.local.set.mockResolvedValue(undefined);

        const update = {
            scan: true,
            activity: {
                domain: 'test.com',
                action: 'scanned',
                time: 1234567890
            }
        };

        await updateStats(update);

        const call = chrome.storage.local.set.mock.calls[0][0];
        const savedStats = call.statistics;

        // Counter should increment
        expect(savedStats.totalScans).toBe(105);
        // Activity log should be recreated and populated
        expect(savedStats.recentActivity).toBeDefined();
        expect(savedStats.recentActivity).toHaveLength(1);
        expect(savedStats.recentActivity[0].domain).toBe('test.com');
    });

    it('should persist metadata correctly', async () => {
        const initialState = {
            totalScans: 10,
            recentActivity: []
        };
        chrome.storage.local.get.mockResolvedValue({ statistics: initialState });
        chrome.storage.local.set.mockResolvedValue(undefined);

        const update = {
            scan: true,
            activity: {
                domain: 'mail.google.com',
                action: 'scanned',
                time: Date.now(),
                metadata: { subject: 'Urgent!', sender: 'fake@scam.com' }
            }
        };

        await updateStats(update);

        const call = chrome.storage.local.set.mock.calls[0][0];
        const savedActivity = call.statistics.recentActivity[0];

        expect(savedActivity.metadata).toEqual({
            subject: 'Urgent!',
            sender: 'fake@scam.com'
        });
    });
});
