/**
 * Sync Manager
 * 
 * Orchestrates synchronization of community-reported scams from Supabase to local storage.
 */
import { getVerifiedScams } from '../../lib/supabase.js';
import { mergeBlocklist } from '../../lib/storage.js';

const SYNC_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours

export class SyncManager {
    constructor() {
        this.syncInProgress = false;
    }

    /**
     * Trigger a synchronization
     * @param {boolean} force - Ignore cache/interval checks
     */
    async sync(force = false) {
        if (this.syncInProgress) {
            console.log('[SyncManager] Sync already in progress, skipping.');
            return { success: false, reason: 'in_progress' };
        }

        try {
            this.syncInProgress = true;

            const lastSync = (await chrome.storage.local.get('lastBlocklistSync')).lastBlocklistSync || 0;
            const now = Date.now();

            if (!force && (now - lastSync < SYNC_INTERVAL)) {
                console.log('[SyncManager] Sync skipped (interval not met).');
                return { success: true, skipped: true };
            }

            console.log('[SyncManager] Fetching verified scams...');
            const verified = await getVerifiedScams();

            if (verified && verified.length > 0) {
                const urls = verified.map(v => v.url);
                const added = await mergeBlocklist(urls);
                console.log(`[SyncManager] Sync complete. Added ${added} new domains.`);
            }

            await chrome.storage.local.set({ lastBlocklistSync: now });
            return { success: true };

        } catch (error) {
            console.error('[SyncManager] Sync failed:', error);
            return { success: false, error: error.message };
        } finally {
            this.syncInProgress = false;
        }
    }
}

export const syncManager = new SyncManager();
