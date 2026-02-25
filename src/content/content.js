import { MessageTypes } from '../lib/messaging.js';
import { detectContext, detectEmailMetadata } from '../lib/context-detector.js';
import { scanUrl } from '../lib/detector.js';

console.log('[Scam Alert] Content script loaded (Hydra Guard)');

// Immediate Context Detection
const initialContext = detectContext();
const initialMetadata = initialContext.type === 'email' ? detectEmailMetadata(initialContext) : null;

// Report context to background hub
chrome.runtime.sendMessage({
    type: MessageTypes.CONTEXT_DETECTED,
    payload: {
        context: initialContext,
        emailMetadata: initialMetadata
    }
});

// Export for unit testing
export const OVERLAY_ID = 'scam-alert-overlay-root';

export function createOverlay(result) {
    // Remove existing if any
    const existing = document.getElementById(OVERLAY_ID);
    if (existing) existing.remove();

    // Create container
    const container = document.createElement('div');
    container.id = OVERLAY_ID;

    // Create Shadow DOM to isolate styles
    const shadow = container.attachShadow({ mode: 'open' });

    // Inject styles
    const style = document.createElement('style');
    style.textContent = `
        :host {
            all: initial;
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: linear-gradient(135deg, #7f1d1d 0%, #450a0a 100%);
            z-index: 2147483647; /* Max Z-Index */
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: system-ui, -apple-system, sans-serif;
            color: white;
            backdrop-filter: blur(10px);
        }
        .card {
            background: rgba(0, 0, 0, 0.4);
            backdrop-filter: blur(20px);
            border: 1px solid rgba(255, 255, 255, 0.1);
            padding: 3rem;
            border-radius: 1.5rem;
            max-width: 600px;
            text-align: center;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
            animation: fadeIn 0.3s ease-out;
        }
        h1 {
            font-size: 2.5rem;
            font-weight: 800;
            margin: 0 0 1rem 0;
            color: #fca5a5;
        }
        p {
            font-size: 1.125rem;
            line-height: 1.6;
            color: #e5e7eb;
            margin-bottom: 2rem;
        }
        .recommendation {
            background: rgba(220, 38, 38, 0.2);
            border: 1px solid #dc2626;
            padding: 1rem;
            border-radius: 0.5rem;
            margin-bottom: 1rem;
            font-weight: 500;
            cursor: pointer;
            transition: background 0.2s;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 0.5rem;
        }
        .recommendation:hover {
            background: rgba(220, 38, 38, 0.3);
        }
        .details {
            display: none;
            background: rgba(0, 0, 0, 0.3);
            border-radius: 0.5rem;
            padding: 1rem;
            margin-bottom: 2rem;
            text-align: left;
            font-size: 0.875rem;
            color: #d1d5db;
            max-height: 200px;
            overflow-y: auto;
            border: 1px solid rgba(255, 255, 255, 0.05);
        }
        .details.visible {
            display: block;
            animation: slideDown 0.2s ease-out;
        }
        .details ul {
            margin: 0;
            padding-left: 1.25rem;
        }
        .details li {
            margin-bottom: 0.5rem;
        }
        .actions {
            display: flex;
            gap: 1rem;
            justify-content: center;
            flex-direction: column;
        }
        @keyframes slideDown {
            from { opacity: 0; transform: translateY(-10px); }
            to { opacity: 1; transform: translateY(0); }
        }
        button.primary {
            background: #ef4444;
            color: white;
            border: none;
            padding: 1rem 2rem;
            font-size: 1.125rem;
            font-weight: 600;
            border-radius: 0.75rem;
            cursor: pointer;
            transition: transform 0.1s, background 0.2s;
        }
        button.primary:hover {
            background: #dc2626;
            transform: scale(1.02);
        }
        button.secondary {
            background: transparent;
            border: none;
            color: #9ca3af;
            text-decoration: underline;
            cursor: pointer;
            font-size: 0.875rem;
            margin-top: 1rem;
        }
        button.secondary:hover {
            color: white;
        }
        @keyframes fadeIn {
            from { opacity: 0; transform: scale(0.95); }
            to { opacity: 1; transform: scale(1); }
        }
    `;
    shadow.appendChild(style);

    // Content
    const wrapper = document.createElement('div');
    wrapper.className = 'card';

    // Format technical details from checks
    const findings = Object.values(result?.checks || {})
        .filter(c => c.flagged)
        .map(c => `<li><strong>${c.title || 'Indicator'}:</strong> ${c.details || c.description}</li>`)
        .join('');

    wrapper.innerHTML = `
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#fca5a5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom: 1.5rem;">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
            <line x1="12" y1="9" x2="12" y2="13"></line>
            <line x1="12" y1="17" x2="12.01" y2="17"></line>
        </svg>
        <h1>High Risk Detected</h1>
        <p>We recommend leaving this page. Scam Alert blocked it because it matches known scam techniques.</p>
        
        <div class="recommendation" id="btn-reason" title="Click for technical details">
            Reason: <strong>${result?.recommendations?.[0] || 'Suspicious Activity Detected'}</strong>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
        </div>

        <div class="details" id="pnl-details">
            <div style="font-weight: 600; font-size: 0.75rem; text-transform: uppercase; color: #94a3b8; margin-bottom: 0.75rem; letter-spacing: 0.05em;">Technical Indicators</div>
            <ul>
                ${findings || '<li>Multiple pattern matches found. Technical details restricted in Lite mode.</li>'}
            </ul>
        </div>

        <div class="actions">
            <button class="primary" id="btn-back">Go back to safety</button>
            <button class="secondary" id="btn-proceed">I understand the risks, proceed anyway</button>
        </div>
    `;

    shadow.appendChild(wrapper);

    // Handlers
    const btnBack = shadow.getElementById('btn-back');
    const btnProceed = shadow.getElementById('btn-proceed');
    const btnReason = shadow.getElementById('btn-reason');
    const pnlDetails = shadow.getElementById('pnl-details');

    btnReason.addEventListener('click', () => {
        pnlDetails.classList.toggle('visible');
    });

    btnBack.addEventListener('click', () => {
        if (window.history.length > 1) {
            window.history.back();
        }
        // Fallback: If back() fails (e.g. opened in new tab with no history)
        setTimeout(() => {
            window.location.href = 'about:blank';
        }, 150);
    });

    btnProceed.addEventListener('click', () => {
        container.remove();
        if (result?.url) {
            // It was an intercepted link. Navigate to it directly.
            window.location.href = result.url;
        }
        // Otherwise just let the user see the current page
    });

    // Prevent any clicks within the overlay from bubbling up to the native app (e.g., Gmail)
    // which could trigger a DOM mutation, kicking off an infinite rescan loop (BUG-080).
    container.addEventListener('click', (e) => {
        e.stopPropagation();
    });

    document.documentElement.appendChild(container);
}

function showDetectionToast(result) {
    // Only show for High/Medium if not already handled by overlay
    if (result.overallSeverity === 'SAFE' || result.overallSeverity === 'LOW') return;

    // Remove existing
    const existing = document.getElementById('scam-alert-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'scam-alert-toast';
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 2147483646;
        background: #1e293b;
        color: white;
        padding: 16px;
        border-radius: 12px;
        box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        gap: 12px;
        font-family: system-ui, sans-serif;
        border-left: 4px solid ${result.overallSeverity === 'HIGH' ? '#ef4444' : '#f59e0b'};
        min-width: 300px;
        animation: slideIn 0.3s ease-out;
    `;

    // Add slideIn animation
    const styleElem = document.createElement('style');
    styleElem.textContent = `@keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }`;
    toast.appendChild(styleElem);

    const icon = result.overallSeverity === 'HIGH' ? '⚠️' : '🛡️';
    const title = result.overallSeverity === 'HIGH' ? 'High Risk Detected' : 'Caution Advised';

    toast.innerHTML += `
        <div style="font-size: 20px;">${icon}</div>
        <div style="flex: 1;">
            <div style="font-weight: bold; margin-bottom: 2px;">${title}</div>
            <div style="font-size: 0.85em; opacity: 0.9;">Scam Alert reported ${result.score}% risk.</div>
        </div>
        <button id="sa-toast-close" style="background:none; border:none; color:white; cursor:pointer; padding:4px; opacity:0.6;">✕</button>
    `;

    document.body.appendChild(toast);

    // Close handler
    document.getElementById('sa-toast-close').onclick = () => toast.remove();

    // Auto dismiss
    setTimeout(() => {
        if (toast.isConnected) {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100%)';
            toast.style.transition = 'all 0.3s ease-in';
            setTimeout(() => toast.remove(), 300);
        }
    }, 6000);
}

// Listen for messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === MessageTypes.SHOW_WARNING) {
        console.warn('[Scam Alert] Received warning command', message.data);
        createOverlay(message.data.result);
        sendResponse({ success: true });
    } else if (message.type === MessageTypes.SCAN_RESULT && message.data?.result) {
        // Phase 25.0: Restored toast for High/Medium risks
        showDetectionToast(message.data.result);
        sendResponse({ success: true });
    } else if (message.type === 'OPEN_REPORT_MODAL') {
        const url = window.location.href;
        let domain = '';
        try { domain = new URL(url).hostname; } catch (e) { }

        const confirmReport = confirm(`Report this site as a scam?\n\nURL: ${url}`);
        if (confirmReport) {
            chrome.runtime.sendMessage({
                type: MessageTypes.REPORT_SCAM,
                data: {
                    url: url,
                    type: 'web_scam',
                    description: 'Reported via browser popup',
                    metadata: {
                        timestamp: new Date().toISOString(),
                        pageTitle: document.title,
                        pageContent: document.body.innerText.substring(0, 10000), // Snapshot of content
                        userAgent: navigator.userAgent
                    }
                }
            }, async (response) => {
                if (response && response.success) {
                    alert('Thanks! Report submitted.');
                    // Persist state by domain (hostname) as per BUG-060
                    const { reportedSites = {} } = await chrome.storage.local.get('reportedSites');
                    if (domain) reportedSites[domain] = Date.now();
                    reportedSites[url] = Date.now(); // Keep URL for backward compatibility/granularity
                    await chrome.storage.local.set({ reportedSites });
                } else {
                    alert('Submission failed: ' + (response?.error || 'Unknown error'));
                }
            });
        }
        sendResponse({ success: true });
    } else if (message.type === 'HISTORY_BACK') {
        // Robust navigation fallback for popup
        window.history.back();
        sendResponse({ success: true });
    } else if (message.type === MessageTypes.EXECUTE_SCAN) {
        handleExecuteScan(message.payload || message.data).then(sendResponse);
        return true;
    }
});

async function handleExecuteScan(options = {}) {
    console.log('[Scam Alert] Executing remote scan request', options);

    // Refresh context before scan
    const context = detectContext();
    const emailMetadata = context.type === 'email' ? detectEmailMetadata(context) : null;

    const scanOptions = {
        ...options,
        pageContent: emailMetadata?.bodySnippet || document.body.innerText.substring(0, 10000),
        context: context
    };

    try {
        const result = await scanUrl(window.location.href, scanOptions, (progress) => {
            chrome.runtime.sendMessage({
                type: MessageTypes.SCAN_PROGRESS,
                payload: progress
            });
        });

        return { success: true, result };
    } catch (error) {
        console.error('[Scam Alert] Local scan failed:', error);
        return { success: false, error: error.message };
    }
}

