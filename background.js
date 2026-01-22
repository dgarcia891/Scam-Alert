/**
 * Background Service Worker
 * 
 * Handles URL scanning and threat detection in the background
 */

// Import detection modules
importScripts(
    'api-integrations/google-safe-browsing.js',
    'api-integrations/phishtank.js',
    'api-integrations/pattern-detector.js',
    'api-integrations/unified-detector.js'
);

console.log('[Scam Alert] Background service worker initialized');

// Extension installation
chrome.runtime.onInstalled.addListener(async (details) => {
    console.log('[Scam Alert] Extension installed:', details.reason);

    if (details.reason === 'install') {
        // Download PhishTank database on first install
        console.log('[Scam Alert] Downloading PhishTank database...');
        await downloadPhishTankDatabase();

        // Set default options
        await chrome.storage.local.set({
            scanningEnabled: true,
            notificationsEnabled: true,
            useGoogleSafeBrowsing: true,
            usePhishTank: true,
            usePatternDetection: true
        });

        // Show welcome notification
        chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icons/icon48.png',
            title: 'Scam Alert Installed',
            message: 'You\'re now protected from scams. The extension will scan websites in the background.',
            priority: 2
        });
    }
});

// Update PhishTank database daily
chrome.alarms.create('updatePhishTankDB', {
    periodInMinutes: 60 // Every hour
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === 'updatePhishTankDB') {
        console.log('[Scam Alert] Updating PhishTank database...');
        await downloadPhishTankDatabase();
    }
});

// Listen for navigation events
chrome.webNavigation.onBeforeNavigate.addListener(async (details) => {
    // Only scan main frame navigations
    if (details.frameId !== 0) return;

    const url = details.url;

    // Get settings
    const settings = await chrome.storage.local.get([
        'scanningEnabled',
        'useGoogleSafeBrowsing',
        'usePhishTank',
        'usePatternDetection'
    ]);

    if (!settings.scanningEnabled) {
        console.log('[Scam Alert] Scanning disabled');
        return;
    }

    // Check if URL should be scanned
    if (!shouldScanUrl(url)) {
        console.log('[Scam Alert] Skipping safe/internal URL:', url);
        return;
    }

    console.log('[Scam Alert] Scanning URL before navigation:', url);

    // Scan the URL
    const result = await scanUrlWithCache(url, {
        useGoogleSafeBrowsing: settings.useGoogleSafeBrowsing,
        usePhishTank: settings.usePhishTank,
        usePatternDetection: settings.usePatternDetection,
        preferOffline: true // Use offline checks first for speed
    });

    // Handle threat detection
    if (result.overallThreat || result.overallSeverity !== 'SAFE') {
        await handleThreatDetected(details.tabId, url, result);
    }
});

// Listen for completed navigation (for content analysis)
chrome.webNavigation.onCompleted.addListener(async (details) => {
    if (details.frameId !== 0) return;

    const url = details.url;

    if (!shouldScanUrl(url)) return;

    // Inject content script to analyze page content
    try {
        const results = await chrome.scripting.executeScript({
            target: { tabId: details.tabId },
            func: analyzePageContent
        });

        if (results && results[0] && results[0].result) {
            const pageContent = results[0].result;

            // Re-scan with page content
            const settings = await chrome.storage.local.get([
                'scanningEnabled',
                'usePatternDetection'
            ]);

            if (settings.scanningEnabled && settings.usePatternDetection) {
                const result = analyzeUrl(url, pageContent);

                if (result.riskScore >= 50) {
                    await handleThreatDetected(details.tabId, url, {
                        detections: { pattern: result },
                        overallSeverity: result.riskLevel,
                        overallThreat: true,
                        recommendations: [result.recommendation]
                    });
                }
            }
        }
    } catch (error) {
        console.error('[Scam Alert] Content analysis error:', error);
    }
});

/**
 * Function to analyze page content (injected into page)
 * @returns {Object} - Page content analysis
 */
function analyzePageContent() {
    const forms = Array.from(document.querySelectorAll('form')).map(form => ({
        action: form.action,
        method: form.method,
        hasPassword: !!form.querySelector('input[type="password"]'),
        hasCreditCard: !!form.querySelector('input[autocomplete*="cc"]')
    }));

    return {
        title: document.title,
        bodyText: document.body.innerText.substring(0, 5000), // First 5000 chars
        forms,
        hasPasswordInput: forms.some(f => f.hasPassword),
        hasCreditCard: forms.some(f => f.hasCreditCard)
    };
}

/**
 * Handle threat detection
 * @param {number} tabId - Tab ID
 * @param {string} url - URL that was flagged
 * @param {Object} result - Scan result
 */
async function handleThreatDetected(tabId, url, result) {
    console.warn('[Scam Alert] THREAT DETECTED:', url, result);

    // Store threat info for the tab
    await chrome.storage.session.set({
        [`threat_${tabId}`]: {
            url,
            result,
            timestamp: Date.now()
        }
    });

    // Update badge
    chrome.action.setBadgeText({ tabId, text: '!' });
    chrome.action.setBadgeBackgroundColor({ tabId, color: '#FF0000' });

    // Show notification if critical
    const settings = await chrome.storage.local.get('notificationsEnabled');

    if (settings.notificationsEnabled && result.overallSeverity === 'CRITICAL') {
        chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icons/icon48.png',
            title: '⚠️ SCAM WARNING',
            message: `This website may be dangerous!\n\n${result.recommendations[0] || 'Proceed with extreme caution.'}`,
            priority: 2,
            requireInteraction: true
        });
    }

    // Inject warning overlay on the page
    try {
        await chrome.scripting.executeScript({
            target: { tabId },
            func: showWarningOverlay,
            args: [result]
        });
    } catch (error) {
        console.error('[Scam Alert] Failed to inject warning:', error);
    }
}

/**
 * Show warning overlay (injected into page)
 * @param {Object} result - Scan result
 */
function showWarningOverlay(result) {
    // Don't show multiple overlays
    if (document.getElementById('scam-alert-overlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'scam-alert-overlay';
    overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.95);
    z-index: 999999999;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  `;

    const getSeverityColor = (severity) => {
        const colors = {
            'CRITICAL': '#dc2626',
            'HIGH': '#ea580c',
            'MEDIUM': '#f59e0b',
            'LOW': '#eab308'
        };
        return colors[severity] || '#dc2626';
    };

    overlay.innerHTML = `
    <div style="background: white; border-radius: 16px; padding: 48px; max-width: 600px; text-align: center; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3);">
      <div style="font-size: 72px; margin-bottom: 24px;">⚠️</div>
      <h1 style="color: ${getSeverityColor(result.overallSeverity)}; font-size: 32px; margin: 0 0 16px 0; font-weight: 700;">
        WARNING: Potential Scam Detected
      </h1>
      <p style="color: #374151; font-size: 18px; line-height: 1.6; margin: 0 0 32px 0;">
        ${result.recommendations[0] || 'This website shows signs of being a scam. Do not enter personal information, passwords, or payment details.'}
      </p>
      <div style="background: #f3f4f6; border-radius: 8px; padding: 16px; margin-bottom: 32px; text-align: left;">
        <div style="font-weight: 600; color: #1f2937; margin-bottom: 8px;">Threat Level: ${result.overallSeverity}</div>
        <div style="font-size: 14px; color: #6b7280;">
          ${Object.keys(result.detections).length} detection method(s) flagged this site
        </div>
      </div>
      <div style="display: flex; gap: 16px; justify-content: center;">
        <button id="scam-alert-go-back" style="
          background: #dc2626;
          color: white;
          border: none;
          padding: 16px 32px;
          border-radius: 8px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.2s;
        ">
          ← Go Back to Safety
        </button>
        <button id="scam-alert-proceed" style="
          background: transparent;
          color: #6b7280;
          border: 2px solid #d1d5db;
          padding: 16px 32px;
          border-radius: 8px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        ">
          Proceed Anyway (Not Recommended)
        </button>
      </div>
    </div>
  `;

    document.body.appendChild(overlay);

    // Add event listeners
    document.getElementById('scam-alert-go-back').onclick = () => {
        window.history.back();
    };

    document.getElementById('scam-alert-proceed').onclick = () => {
        overlay.remove();
    };

    // Hover effects
    const goBackBtn = document.getElementById('scam-alert-go-back');
    goBackBtn.onmouseenter = () => goBackBtn.style.background = '#b91c1c';
    goBackBtn.onmouseleave = () => goBackBtn.style.background = '#dc2626';

    const proceedBtn = document.getElementById('scam-alert-proceed');
    proceedBtn.onmouseenter = () => {
        proceedBtn.style.background = '#f3f4f6';
        proceedBtn.style.borderColor = '#9ca3af';
    };
    proceedBtn.onmouseleave = () => {
        proceedBtn.style.background = 'transparent';
        proceedBtn.style.borderColor = '#d1d5db';
    };
}

// Message handler for popup communication
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'GET_TAB_THREAT') {
        chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
            if (tabs[0]) {
                const threat = await chrome.storage.session.get(`threat_${tabs[0].id}`);
                sendResponse(threat[`threat_${tabs[0].id}`] || null);
            }
        });
        return true; // Keep channel open for async response
    }

    if (message.type === 'SCAN_CURRENT_TAB') {
        chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
            if (tabs[0]) {
                const result = await scanUrlWithCache(tabs[0].url, { forceRefresh: true });
                sendResponse(result);
            }
        });
        return true;
    }
});

console.log('[Scam Alert] Background service worker ready');
