/**
 * Threat Telemetry Client (FEAT-119)
 * 
 * Sends anonymized threat indicators extracted by the AI 
 * (suspicious emails, domains, IPs, unusual ports) to the backend
 * to help improve community protection heuristics.
 * ONLY runs if the user has explicitly opted-in via settings.telemetryOptIn.
 */

export async function reportThreatIndicators(indicators, contextType = 'WEB') {
    if (!indicators || indicators.length === 0) return { success: false, reason: 'No indicators' };

    try {
        const { settings } = await chrome.storage.local.get('settings');
        if (!settings?.telemetryOptIn) {
            console.log('[Telemetry] Opt-in not granted. Skipping threat report.');
            return { success: false, reason: 'Opt-in required' };
        }

        console.log('[Telemetry] Reporting threat indicators to community DB...', indicators);

        // Fetch current tab URL to report
        let currentUrl = 'unknown';
        try {
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tabs.length > 0 && tabs[0].url) {
                currentUrl = tabs[0].url;
            }
        } catch (e) {
            console.warn('[Telemetry] Could not fetch current tab URL:', e);
        }

        import('./supabase.js').then(supabase => {
            supabase.submitUserReport(
                currentUrl,
                'telemetry',
                `AI Extracted Indicators (${contextType})`,
                { indicators, severity: 'HIGH' }
            ).catch(err => {
                console.warn('[Telemetry] Telemetry submission failed:', err);
            });
        }).catch(err => {
            console.warn('[Telemetry] Failed to load supabase module:', err);
        });

        return { success: true };
    } catch (err) {
        console.error('[Telemetry] Error preparing threat report:', err);
        return { success: false, error: err.message };
    }
}
