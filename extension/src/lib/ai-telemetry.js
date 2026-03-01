/**
 * AI Telemetry (FEAT-088)
 * 
 * Tracks AI verdict distribution and performance metrics locally.
 * Max 500 records (rolling window).
 */

const METRICS_KEY = 'sa_ai_metrics';
const MAX_RECORDS = 500;

/**
 * Record a single AI validation event.
 * @param {Object} event - { url, localSeverity, verdict, confidence, latencyMs }
 */
export async function recordAICall({ url, localSeverity, verdict, confidence, latencyMs }) {
    try {
        const hostname = new URL(url).hostname;
        const data = await chrome.storage.local.get(METRICS_KEY);
        let records = data[METRICS_KEY] || [];

        const newRecord = {
            hostname,
            localSeverity,
            verdict,
            confidence,
            latencyMs,
            timestamp: Date.now()
        };

        records.push(newRecord);

        // Rolling window: keep last 500
        if (records.length > MAX_RECORDS) {
            records = records.slice(records.length - MAX_RECORDS);
        }

        await chrome.storage.local.set({ [METRICS_KEY]: records });
    } catch (err) {
        console.warn('[AI Telemetry] Failed to record metrics:', err);
    }
}

/**
 * Aggregate metrics for the dashboard.
 * @returns {Promise<Object>}
 */
export async function getAIMetricsSummary() {
    const data = await chrome.storage.local.get(METRICS_KEY);
    const records = data[METRICS_KEY] || [];

    if (records.length === 0) return null;

    const summary = {
        totalCalls: records.length,
        verdicts: { CONFIRMED: 0, DOWNGRADED: 0, ESCALATED: 0 },
        avgLatencyMs: 0,
        disagreementCount: 0, // Where local != AI (CONFIRMED is considered agreement)
    };

    let totalLatency = 0;

    records.forEach(r => {
        summary.verdicts[r.verdict] = (summary.verdicts[r.verdict] || 0) + 1;
        totalLatency += r.latencyMs;
        if (r.verdict !== 'CONFIRMED') summary.disagreementCount++;
    });

    summary.avgLatencyMs = Math.round(totalLatency / records.length);
    summary.disagreementRateCached = Math.round((summary.disagreementCount / records.length) * 100);

    return summary;
}
