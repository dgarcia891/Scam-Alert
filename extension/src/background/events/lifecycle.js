/**
 * Background Lifecycle Events (v19.2 Refactored)
 */
import { repairStatistics, getSettings, updateSettings, clearCache } from '../../lib/storage.js';
import { syncPatterns } from '../../lib/database.js';

export async function onInstalled(details, scanActiveTabs) {
    console.log('[Hydra Guard] Extension installed/updated:', details.reason);
    try {
        await repairStatistics();
        const settings = await getSettings();

        if (settings.usePhishTank) {
            await updateSettings({ usePhishTank: false, preferOffline: false });
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
        await scanActiveTabs();
    } catch (err) {
        console.error('[Hydra Guard] onInstalled error:', err);
    }
}

export function onStartup() {
    chrome.storage.local.remove('emailPromptSessionDismissed');
}
