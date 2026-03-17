/**
 * Hydra Guard: Report Message Handlers
 * Extracts reporting logic out of the main handler.js
 */

import { submitCorrection } from '../../lib/supabase.js';

// Global rate limit cache for false positives
const fpRateLimits = {
    count: 0,
    timestamp: Date.now()
};

export async function handleReportScam(data, submitReport) {
    try {
        const { url, type, description, metadata } = data;
        const reportResult = await submitReport(url, type, description, metadata);
        return { success: reportResult.success, error: reportResult.error };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

export async function handleReportFalsePositive(data, submitFalsePositive) {
    try {
        const payload = data;

        // Build explanation from whichever fields the caller provides.
        // Dashboard sends: { flaggedText, checkTitle, category, userReason, userNote }
        // Legacy Locate tooltip sends: { explanation, url, phrase }
        const explanation = payload.explanation
            || [payload.userReason, payload.userNote, payload.category, payload.flaggedText]
                .filter(Boolean).join(' — ')
            || '';

        // 1. Validate: need at least some content
        if (explanation.trim().length < 3) {
            return { success: false, error: 'Please provide a reason for your feedback.' };
        }

        // 2. Rate limiting (max 10 per day per installation)
        const ONE_DAY = 24 * 60 * 60 * 1000;
        if (Date.now() - fpRateLimits.timestamp > ONE_DAY) {
            fpRateLimits.count = 0;
            fpRateLimits.timestamp = Date.now();
        }

        if (fpRateLimits.count >= 10) {
            return { success: false, error: 'Daily report limit reached. Thank you for your feedback!' };
        }

        // 3. Submit with normalized payload
        const normalizedPayload = {
            url: payload.pageUrl || payload.url || '',
            phrase: payload.flaggedText || payload.phrase || '',
            explanation: explanation
        };
        const result = await submitFalsePositive(normalizedPayload);

        if (result.success) {
            fpRateLimits.count++;
        }

        return result;
    } catch (error) {
        console.error('[Hydra Guard] False positive handler error:', error);
        return { success: false, error: error.message };
    }
}

export async function handleSubmitCorrectionUnified(msgData) {
    try {
        const { url, feedback, comment, detectionResult } = msgData;

        // Hash the URL using Web Crypto API
        const encoder = new TextEncoder();
        const data = encoder.encode((url || '').toLowerCase().replace(/\/+$/, ''));
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const urlHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

        const detectionId = detectionResult?.detectionId || null;

        // Route through unified supabase.js (correct URL + API key)
        const result = await submitCorrection(urlHash, feedback, {
            detectionId,
            userComment: comment || null,
        });

        return result;
    } catch (error) {
        console.error('[Hydra Guard] Failed to submit correction:', error);
        return { success: false, error: error.message };
    }
}
