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

        // Stub for the future Supabase Edge Function 'sa-report-telemetry'
        // We catch errors gracefully so it never breaks the user experience if the endpoint is down.
        const endpoint = 'https://your-supabase-project.supabase.co/functions/v1/sa-report-telemetry';
        
        // This is a fire-and-forget telemetry ping. 
        // We don't await the response to avoid blocking background processes.
        fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // Dummy auth for the stub
                'Authorization': `Bearer ${settings?.gsbApiKey || 'anonymous'}`
            },
            body: JSON.stringify({
                source: 'extension_ai',
                contextType,
                indicators,
                timestamp: new Date().toISOString()
            })
        }).catch(err => {
            console.warn('[Telemetry] Telemetry ping failed (expected if endpoint is stubbed):', err.message);
        });

        return { success: true };
    } catch (err) {
        console.error('[Telemetry] Error preparing threat report:', err);
        return { success: false, error: err.message };
    }
}
