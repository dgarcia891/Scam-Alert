import { jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const scriptPath = path.resolve(__dirname, '../../extension/src/content/content.js');
const scriptSource = fs.readFileSync(scriptPath, 'utf-8')
    .replace(/^import\s+.*from\s+['"].*['"];?\s*/gm, '') // Strip imports
    .replace(/^export\s+\{[^}]*\}\s*;?\s*/gm, '') // Strip re-exports like export { OVERLAY_ID };
    .replace(/^export\s+/gm, ''); // Strip exports

function loadContentScript() {
    document.body.innerHTML = '';
    document.head.innerHTML = '';

    const messageListeners = [];
    chrome.runtime.onMessage.addListener.mockImplementation((fn) => {
        messageListeners.push(fn);
    });

    const wrappedSource = `(function() {
    try {
      const MessageTypes = {
        SHOW_WARNING: 'show_warning',
        CONTEXT_DETECTED: 'context_detected',
        SCAN_RESULT: 'scan_result',
        SCAN_RESULT_UPDATED: 'scan_result_updated',
        HIDE_WARNING: 'hide_warning',
        SHOW_BANNER: 'show_banner',
        OPEN_REPORT_MODAL: 'open_report_modal',
        EXECUTE_SCAN: 'execute_scan',
        SCAN_PROGRESS: 'scan_progress',
        REPORT_SCAM: 'report_scam',
        ANALYZE_PAGE: 'analyze_page',
        NAVIGATE_BACK: 'navigate_back'
      };
      const OVERLAY_ID = 'hydra-guard-overlay-root';
      
      const detectContext = () => ({ type: 'web' });
      const detectEmailMetadata = () => null;
      const scanUrl = () => Promise.resolve({ overallSeverity: 'SAFE' });
      const highlightDetections = () => {};
      const removeHighlights = () => {};

      ${scriptSource}
      
      window.createOverlay = createOverlay;
      window.resetWarningAcknowledgement = resetWarningAcknowledgement || function(){};
    } catch (e) {
      console.error(e.message);
    }
  })();`;

    const fn = new Function('chrome', 'document', 'window', wrappedSource);
    fn(chrome, document, window);

    return messageListeners;
}

describe('BUG-089: "Proceed anyway" double popup issue', () => {
    let messageListeners = [];

    beforeEach(() => {
        jest.restoreAllMocks();
        document.body.innerHTML = '';

        chrome.runtime.onMessage.addListener.mockReset();
        chrome.runtime.sendMessage.mockReset();

        global.chrome.storage = {
            local: {
                get: jest.fn().mockResolvedValue({ settings: { highlightingEnabled: false } }),
                set: jest.fn().mockResolvedValue(undefined)
            }
        };

        // Mock sessionStorage
        let store = {};
        const mockSessionStorage = {
            getItem: jest.fn((key) => store[key] || null),
            setItem: jest.fn((key, value) => { store[key] = value.toString(); }),
            clear: jest.fn(() => { store = {}; })
        };
        Object.defineProperty(window, 'sessionStorage', { value: mockSessionStorage });

        messageListeners = loadContentScript();

        // reset global state in content.js for test isolation
        if (window.resetWarningAcknowledgement) window.resetWarningAcknowledgement();
    });

    function sendMessage(type, data = {}) {
        const sendResponse = jest.fn();
        if (messageListeners.length > 0) {
            messageListeners[messageListeners.length - 1](
                { type, data },
                {},
                sendResponse
            );
        }
        return sendResponse;
    }

    test('clicking proceed anyway prevents future SHOW_WARNING messages from creating an overlay', () => {
        const testResult = { severity: 'CRITICAL', reasons: [{ message: 'Phishing' }] };

        // 1st warning message comes in
        sendMessage('show_warning', { result: testResult });

        // Ensure overlay exists
        let overlay = document.getElementById('hydra-guard-overlay-root');
        expect(overlay).not.toBeNull();

        // User clicks proceed
        const proceedBtn = overlay.shadowRoot.getElementById('btn-proceed');
        proceedBtn.click();

        // Overlay should be gone
        overlay = document.getElementById('hydra-guard-overlay-root');
        expect(overlay).toBeNull();

        // 2nd warning message comes in (e.g. from a delayed background scan or navigation fallback)
        sendMessage('show_warning', { result: testResult });

        // Overlay should NOT be created again
        overlay = document.getElementById('hydra-guard-overlay-root');
        expect(overlay).toBeNull();
    });

    test('BUG-093: clicking proceed anyway prevents future SHOW_WARNING messages across simulated page reloads', () => {
        const testResult = { severity: 'CRITICAL', reasons: [{ message: 'Phishing' }] };

        // 1st warning message comes in
        sendMessage('show_warning', { result: testResult });

        // Ensure overlay exists
        let overlay = document.getElementById('hydra-guard-overlay-root');
        expect(overlay).not.toBeNull();

        // User clicks proceed
        const proceedBtn = overlay.shadowRoot.getElementById('btn-proceed');
        proceedBtn.click();

        // Overlay should be gone
        overlay = document.getElementById('hydra-guard-overlay-root');
        expect(overlay).toBeNull();

        // Simulate page reload (re-evaluate content script while keeping sessionStorage)
        messageListeners = loadContentScript();

        // 2nd warning message comes in after 'reload'
        sendMessage('show_warning', { result: testResult });

        // Overlay should NOT be created again
        overlay = document.getElementById('hydra-guard-overlay-root');
        expect(overlay).toBeNull();
    });
});
