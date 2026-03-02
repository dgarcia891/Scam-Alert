
import { createClient } from '@supabase/supabase-js';

// Phase 24.0: Safe environment lookup for both Vite and Jest
const getEnvVar = (name, fallback) => {
    try {
        if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[name]) {
            return import.meta.env[name];
        }
    } catch (e) { }
    return fallback;
};

const SUPABASE_URL = getEnvVar('VITE_SUPABASE_URL', 'https://kuwglmwaresvmodypnnv.supabase.co');
const SUPABASE_ANON_KEY = getEnvVar('VITE_SUPABASE_ANON_KEY', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt1d2dsbXdhcmVzdm1vZHlwbm52Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk4MTE4NzksImV4cCI6MjA4NTM4Nzg3OX0.uwQxqIWfsDzr8SZIYj_wrlAL5wPHtfWGPhBg-LYC25o');

// Initialize the Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Submit a scam report to the database
 * @param {string} url - The URL of the scam site
 * @param {string} type - 'PHISHING', 'SCAM', 'MALWARE'
 * @param {string} description - Optional user description
 * @param {Object} metadata - Additional data (e.g., source, timestamp)
 * @returns {Promise<Object>} - The result of the insertion
 */
export async function submitReport(url, type, description = '', metadata = {}) {
    try {
        const { data, error } = await supabase
            .from('reported_scams')
            .insert([
                {
                    url,
                    scam_type: type,
                    description,
                    metadata,
                    severity: 'unverified',
                    status: 'pending'
                }
            ])
            .select();

        if (error) throw error;
        return { success: true, data };
    } catch (error) {
        console.error('[Hydra Guard] Failed to submit report:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Submit a false positive report for a specific detection rule
 * @param {Object} payload - The structured report payload
 * @returns {Promise<Object>} - The result of the insertion
 */
export async function submitFalsePositive(payload) {
    try {
        const { url, issueId, ruleId, issueType, severity, phrase, explanation, version } = payload;

        // Sanitize URL (strip query params)
        let sanitizedUrl = url || '';
        try {
            const urlObj = new URL(url);
            sanitizedUrl = `${urlObj.hostname}${urlObj.pathname}`;
        } catch (e) {
            // Failsafe for invalid URLs
        }

        const { data, error } = await supabase
            .from('reported_scams')
            .insert([
                {
                    url: sanitizedUrl,
                    scam_type: 'false_positive',
                    description: 'User reported highlighted phrase as a false positive',
                    metadata: {
                        rule_id: ruleId || 'unknown',
                        issue_id: issueId || 'unknown',
                        issue_type: issueType || 'unknown',
                        severity: severity || 'unknown',
                        phrase: phrase || '',
                        user_explanation: explanation || '',
                        version: version || chrome.runtime.getManifest().version
                    },
                    severity: 'unverified',
                    status: 'pending'
                }
            ])
            .select();

        if (error) throw error;
        return { success: true, data };
    } catch (error) {
        console.error('[Hydra Guard] Failed to submit false positive:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Fetch verified community reports (for blocklist)
 * @returns {Promise<Array>} - List of verified scam URLs
 */
export async function getVerifiedScams() {
    try {
        const { data, error } = await supabase
            .from('reported_scams')
            .select('url, scam_type, severity')
            .eq('status', 'verified')
            .order('created_at', { ascending: false })
            .limit(1000);

        if (error) throw error;
        return data || [];
    } catch (error) {
        console.warn('[Hydra Guard] Failed to fetch verified scams:', error);
        return [];
    }
}

export default supabase;
