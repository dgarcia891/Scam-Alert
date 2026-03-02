import { jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const scriptPath = path.resolve(__dirname, '../../extension/src/content/content.js');
const scriptSource = fs.readFileSync(scriptPath, 'utf-8')
    .replace(/^import\s+.*from\s+['"].*['"];?\s*/gm, '') // Strip imports
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
      };
      
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
});
