/**
 * Hydra Guard: Backend API Client
 * 
 * Calls AcmeZone2 Supabase edge functions for:
 * - Detection reporting (sa-report-detection)
 * - Correction/feedback submission (sa-submit-correction)
 * - Community blocklist (future)
 * 
 * Phase 25.0: Migrated from direct Supabase client to edge function calls.
 */

const getEnvVar = (name, fallback) => {
    try {
        if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[name]) {
            return import.meta.env[name];
        }
    } catch (e) { }
    return fallback;
};

const FUNCTIONS_BASE_URL = getEnvVar(
    'VITE_SUPABASE_FUNCTIONS_URL',
    'https://ypeopjbfbxmjfkejbkuq.supabase.co/functions/v1'
);

// SA_API_KEY: loaded from settings or env. Users configure this in Options.
let _cachedApiKey = null;

async function getApiKey() {
    if (_cachedApiKey) return _cachedApiKey;
    try {
        const envKey = getEnvVar('VITE_SA_API_KEY', '');
        if (envKey) {
            _cachedApiKey = envKey;
            return envKey;
        }
        // Fall back to user-configured key in extension settings
        const result = await chrome.storage.local.get(['settings']);
        const key = result?.settings?.saApiKey || '';
        if (key) _cachedApiKey = key;
        return key;
    } catch (e) {
        return '';
    }
}

/**
 * Helper: POST to an edge function
 */
async function postEdgeFunction(functionName, body) {
    const apiKey = await getApiKey();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
        const response = await fetch(`${FUNCTIONS_BASE_URL}/${functionName}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-sa-api-key': apiKey,
            },
            body: JSON.stringify(body),
            signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            const errBody = await response.json().catch(() => ({}));
            throw new Error(errBody.message || `HTTP ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        clearTimeout(timeoutId);
        throw error;
    }
}

/**
 * Report a scam detection to the backend.
 * Called when the extension flags a page.
 * 
 * @param {string} urlHash - SHA-256 hash of the URL (privacy: raw URL never sent)
 * @param {Object} signals - { hard: [...], soft: [...] }
 * @param {string} severity - SAFE|LOW|MEDIUM|HIGH|CRITICAL
 * @param {Object} options - { aiVerdict, aiConfidence, extensionVersion }
 */
export async function reportDetection(urlHash, signals, severity, options = {}) {
    try {
        const result = await postEdgeFunction('sa-report-detection', {
            url_hash: urlHash,
            signals,
            severity,
            extension_version: options.extensionVersion || chrome.runtime.getManifest().version,
            ai_verdict: options.aiVerdict || null,
            ai_confidence: options.aiConfidence ?? null,
        });
        return { success: true, id: result.id };
    } catch (error) {
        console.error('[Hydra Guard] Failed to report detection:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Submit a user correction (false positive, false negative, wrong severity).
 * Feeds the AI-powered learning loop.
 * 
 * @param {string} urlHash - SHA-256 hash of the URL
 * @param {string} feedback - false_positive|false_negative|wrong_severity
 * @param {Object} options - { detectionId, userComment }
 */
export async function submitCorrection(urlHash, feedback, options = {}) {
    try {
        const result = await postEdgeFunction('sa-submit-correction', {
            url_hash: urlHash,
            feedback,
            detection_id: options.detectionId || null,
            user_comment: options.userComment || null,
        });
        return { success: true, reviewTriggered: result.review_triggered, verdict: result.verdict };
    } catch (error) {
        console.error('[Hydra Guard] Failed to submit correction:', error);
        return { success: false, error: error.message };
    }
}

// ----- Legacy compatibility shims -----
// These map old function signatures to the new edge function calls.
// TODO: Migrate all callers to use reportDetection/submitCorrection directly.

/**
 * @deprecated Use reportDetection() instead.
 */
export async function submitReport(url, type, description = '', metadata = {}) {
    console.warn('[Hydra Guard] submitReport() is deprecated. Use reportDetection() instead.');
    try {
        // Hash the URL for privacy
        const urlHash = await hashUrl(url);
        return await reportDetection(urlHash, { hard: [], soft: [] }, 'MEDIUM', {
            extensionVersion: metadata.version || chrome.runtime.getManifest().version,
        });
    } catch (error) {
        console.error('[Hydra Guard] Failed to submit report:', error);
        return { success: false, error: error.message };
    }
}

/**
 * @deprecated Use submitCorrection() instead.
 */
export async function submitFalsePositive(payload) {
    console.warn('[Hydra Guard] submitFalsePositive() is deprecated. Use submitCorrection() instead.');
    try {
        const { url, phrase, explanation } = payload;
        const urlHash = await hashUrl(url || '');
        return await submitCorrection(urlHash, 'false_positive', {
            userComment: explanation || phrase || '',
        });
    } catch (error) {
        console.error('[Hydra Guard] Failed to submit false positive:', error);
        return { success: false, error: error.message };
    }
}

/**
 * @deprecated Community blocklist will use sa-sync-patterns in the future.
 */
export async function getVerifiedScams() {
    console.warn('[Hydra Guard] getVerifiedScams() is deprecated. Community blocklist coming soon.');
    return [];
}

/**
 * Hash a URL for privacy-preserving backend communication.
 * Uses SHA-256 via Web Crypto API.
 */
async function hashUrl(url) {
    try {
        const normalized = url.toLowerCase().replace(/\/+$/, '').replace(/^www\./, '');
        const encoder = new TextEncoder();
        const data = encoder.encode(normalized);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (e) {
        // Fallback: simple hash for environments without Web Crypto
        let hash = 0;
        for (let i = 0; i < url.length; i++) {
            const char = url.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash |= 0;
        }
        return 'fallback_' + Math.abs(hash).toString(16);
    }
}

// No default export — callers should import named functions
