/**
 * PhishTank API Integration
 * 
 * Setup:
 * 1. Register at: https://www.phishtank.com/register.php
 * 2. Get your API key from your account settings
 * 3. PhishTank focuses specifically on phishing sites
 * 
 * Rate Limits:
 * - Free tier: Limited requests (check their TOS)
 * - They also provide downloadable database for offline checking
 * 
 * Documentation: https://www.phishtank.com/api_info.php
 */

const PHISHTANK_API_URL = 'https://checkurl.phishtank.com/checkurl/';

import { normalizeUrl } from './storage.js';

/**
 * Check URL against PhishTank database
 * @param {string} url - URL to check
 * @param {Object} options - API options including apiKey
 * @returns {Promise<Object>} - Phishing status
 */
async function checkUrlWithPhishTank(url, options = {}) {
    try {
        // PhishTank requires URL-encoded form data
        const formData = new URLSearchParams();
        formData.append('url', url);
        formData.append('format', 'json');
        formData.append('app_key', options.apiKey || '');

        const response = await fetch(PHISHTANK_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': 'scam-alert-extension/1.0'
            },
            body: formData.toString()
        });

        if (!response.ok) {
            throw new Error(`PhishTank API error: ${response.status}`);
        }

        const data = await response.json();
        return parsePhishTankResponse(data);

    } catch (error) {
        console.error('PhishTank API error:', error);
        return {
            error: error.message,
            isPhishing: false,
            unknown: true
        };
    }
}

/**
 * Parse PhishTank API response
 * @param {Object} response - API response
 * @returns {Object} - Parsed phishing information
 */
function parsePhishTankResponse(response) {
    const result = response.results;

    return {
        url: result.url,
        isPhishing: result.in_database && result.valid,
        inDatabase: result.in_database,
        verified: result.verified,
        verifiedAt: result.verified_at,
        phishId: result.phish_id,
        phishDetailUrl: result.phish_detail_page,
        submittedAt: result.submission_time,
        severity: result.in_database && result.valid ? 'CRITICAL' : 'SAFE',
        unknown: false
    };
}

/**
 * Download PhishTank database for offline checking
 * @param {string} apiKey - Optional API key
 * @returns {Promise<Array>} - Array of known phishing URLs
 */
async function downloadPhishTankDatabase(apiKey = '') {
    try {
        // PhishTank data subdomain often fails on HTTPS, use HTTP.
        // Also include API key if provided to avoid 404s/rate limiting.
        let url = 'http://data.phishtank.com/data/online-valid.json';
        if (apiKey) {
            url += `?app_key=${apiKey}`;
        }

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'scam-alert-extension/1.0',
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to download database: ${response.status}`);
        }

        const phishList = await response.json();

        // Store in chrome.storage for offline checking
        await chrome.storage.local.set({
            phishTankDatabase: phishList,
            lastUpdated: Date.now()
        });

        return phishList;

    } catch (error) {
        console.error('PhishTank database download error:', error);
        return [];
    }
}

/**
 * Check URL against locally stored PhishTank database
 * Much faster than API calls, but requires periodic updates
 * @param {string} url - URL to check
 * @returns {Promise<Object>} - Phishing status
 */
async function checkUrlOffline(url) {
    try {
        const { phishTankDatabase, lastUpdated } = await chrome.storage.local.get([
            'phishTankDatabase',
            'lastUpdated'
        ]);

        // Update database if older than 1 hour
        const ONE_HOUR = 60 * 60 * 1000;
        if (!phishTankDatabase || !lastUpdated || Date.now() - lastUpdated > ONE_HOUR) {
            // We need settings here to get the key
            const { getSettings } = await import('./storage.js');
            const settings = await getSettings();
            await downloadPhishTankDatabase(settings.phishTankApiKey);
            return checkUrlOffline(url); // Retry with fresh database
        }

        // Normalize URL for comparison
        const normalizedUrl = normalizeUrl(url);

        // Check if URL is in database
        const match = phishTankDatabase.find(entry =>
            normalizeUrl(entry.url) === normalizedUrl
        );

        if (match) {
            return {
                url,
                isPhishing: true,
                verified: match.verified === 'yes',
                verifiedAt: match.verification_time,
                phishId: match.phish_id,
                phishDetailUrl: match.phish_detail_url,
                severity: 'CRITICAL',
                source: 'offline-database'
            };
        }

        return {
            url,
            isPhishing: false,
            severity: 'SAFE',
            source: 'offline-database'
        };

    } catch (error) {
        console.error('Offline check error:', error);
        return {
            error: error.message,
            isPhishing: false,
            unknown: true
        };
    }
}

// Export functions
export {
    checkUrlWithPhishTank,
    downloadPhishTankDatabase,
    checkUrlOffline
};
