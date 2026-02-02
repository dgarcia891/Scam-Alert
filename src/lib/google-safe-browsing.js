/**
 * Google Safe Browsing API Integration
 * 
 * Setup:
 * 1. Get API key from: https://console.cloud.google.com/apis/credentials
 * 2. Enable "Safe Browsing API" in your Google Cloud project
 * 3. Add your API key to the extension's config
 * 
 * Rate Limits: 
 * - Free tier: 10,000 requests/day
 * - Paid tier: Higher limits available
 * 
 * Documentation: https://developers.google.com/safe-browsing/v4
 */

const SAFE_BROWSING_API_URL = 'https://safebrowsing.googleapis.com/v4/threatMatches:find';

/**
 * Check URLs against Google Safe Browsing database
 * @param {string[]} urls - Array of URLs to check
 * @param {string} apiKey - Google Safe Browsing API Key
 * @returns {Promise<Object>} - Threat information for each URL
 */
async function checkUrlsWithSafeBrowsing(urls, apiKey) {
  if (!apiKey) {
    console.warn('[GSB] No API key provided, skipping check.');
    return { threats: {} };
  }
  try {
    const requestBody = {
      client: {
        clientId: 'scam-alert-extension',
        clientVersion: '1.0.0'
      },
      threatInfo: {
        threatTypes: [
          'MALWARE',
          'SOCIAL_ENGINEERING',
          'UNWANTED_SOFTWARE',
          'POTENTIALLY_HARMFUL_APPLICATION'
        ],
        platformTypes: ['ANY_PLATFORM'],
        threatEntryTypes: ['URL'],
        threatEntries: urls.map(url => ({ url }))
      }
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(
      `${SAFE_BROWSING_API_URL}?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      }
    );
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Safe Browsing API error: ${response.status}`);
    }

    const data = await response.json();
    return parseSafeBrowsingResponse(data, urls);

  } catch (error) {
    console.error('Safe Browsing API error:', error);
    return { error: error.message, threats: {} };
  }
}

/**
 * Parse Safe Browsing API response
 * @param {Object} response - API response
 * @param {string[]} urls - Original URLs checked
 * @returns {Object} - Parsed threat information
 */
function parseSafeBrowsingResponse(response, urls) {
  const threats = {};

  // If no matches found, all URLs are safe
  if (!response.matches || response.matches.length === 0) {
    urls.forEach(url => {
      threats[url] = { safe: true, threatType: null };
    });
    return { safe: true, threats };
  }

  // Mark checked URLs as safe by default
  urls.forEach(url => {
    threats[url] = { safe: true, threatType: null };
  });

  // Update with actual threats
  response.matches.forEach(match => {
    const url = match.threat.url;
    threats[url] = {
      safe: false,
      threatType: match.threatType,
      platformType: match.platformType,
      severity: getThreatSeverity(match.threatType),
      cacheDuration: match.cacheDuration
    };
  });

  return {
    safe: response.matches.length === 0,
    threats
  };
}

/**
 * Get human-readable severity level
 * @param {string} threatType - Threat type from API
 * @returns {string} - Severity level
 */
function getThreatSeverity(threatType) {
  const severityMap = {
    'MALWARE': 'CRITICAL',
    'SOCIAL_ENGINEERING': 'CRITICAL',
    'UNWANTED_SOFTWARE': 'HIGH',
    'POTENTIALLY_HARMFUL_APPLICATION': 'MEDIUM'
  };
  return severityMap[threatType] || 'UNKNOWN';
}

/**
 * Check single URL (convenience function)
 * @param {string} url - URL to check
 * @returns {Promise<Object>} - Threat information
 */
async function checkUrl(url, apiKey) {
  const result = await checkUrlsWithSafeBrowsing([url], apiKey);
  return result.threats[url] || { safe: true, threatType: null };
}

// Export functions
export {
  checkUrlsWithSafeBrowsing,
  checkUrl,
  getThreatSeverity
};
