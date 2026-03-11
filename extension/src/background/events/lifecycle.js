/**
 * Background Lifecycle Events (v19.2 Refactored)
 */
import { repairStatistics, getSettings, updateSettings, clearCache } from '../../lib/storage.js';
import { syncPatterns } from '../../lib/database.js';
import { syncManager } from '../lib/sync-manager.js';

export async function onInstalled(details, scanActiveTabsCb) {
    console.log('[Hydra Guard] Extension installed/updated:', details.reason);
    try {
        await repairStatistics();
        const settings = await getSettings();

        if (settings.usePhishTank) {
            await updateSettings({ usePhishTank: false, preferOffline: false });
        }

        if (details.reason === 'install' || details.reason === 'update') {
            // Clear all persistent scan caches on update to prevent legacy schema issues (e.g. 0 CHECKS)
            try {
                await clearCache();
                console.log('[Hydra Guard] Persistent scan caches cleared on update.');
            } catch (e) {
                console.warn('[Hydra Guard] Failed to clear cache on update:', e);
            }

            if (!settings.usePatternDetection && !settings.usePhishTank && !settings.useGoogleSafeBrowsing) {
                await updateSettings({
                    usePatternDetection: true,
                    useGoogleSafeBrowsing: true,
                    scanningEnabled: true
                });
            }
            await syncManager.sync(true); // Force sync
        }

        if (details.reason === 'install') {
            chrome.notifications.create({
                type: 'basic',
                iconUrl: chrome.runtime.getURL('icons/icon48.png'),
                title: 'Hydra Guard Installed',
                message: 'You\'re now protected from scams.',
                priority: 2
            });
        }

        await clearCache();
        chrome.storage.local.remove('emailPromptSessionDismissed');
        await syncPatterns();
        if (scanActiveTabsCb) await scanActiveTabsCb();
    } catch (err) {
        console.error('[Hydra Guard] onInstalled error:', err);
    }
}

export function onStartup() {
    chrome.storage.local.remove('emailPromptSessionDismissed');
}
