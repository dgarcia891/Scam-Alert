/**
 * Options Page Tests
 * Tests the options.js settings logic by directly testing the behavior:
 *   - loadSettings populates DOM from storage
 *   - saveSettings reads DOM and calls updateSettings
 *   - Help panel toggle
 *   - Change/blur listeners
 *
 * Strategy: We build the DOM, mock storage, then trigger DOMContentLoaded
 * BEFORE importing options.js (since it self-initializes on that event).
 */
import { describe, test, expect, jest, beforeAll, beforeEach } from '@jest/globals';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const lib = (rel) => resolve(__dirname, '../../extension/src/lib', rel);

let mockGetSettings, mockUpdateSettings;

// Build the minimal DOM that options.js expects — must exist BEFORE import
function buildOptionsDOM() {
    document.body.innerHTML = `
        <input type="checkbox" id="scanningEnabled" />
        <input type="checkbox" id="useGoogleSafeBrowsing" />
        <input type="checkbox" id="usePhishTank" />
        <input type="checkbox" id="usePatternDetection" />
        <input type="checkbox" id="notificationsEnabled" />
        <input type="checkbox" id="notifyOnHttpWarning" />
        <input type="checkbox" id="collectPageSignals" />
        <input type="text" id="gsbApiKey" />
        <input type="text" id="phishTankApiKey" />
        <div id="status" style="display:none"></div>
        <button class="help-toggle" data-help-target="helpPanel1" aria-expanded="false">?</button>
        <div id="helpPanel1" class="help-panel"></div>
    `;
}

beforeAll(async () => {
    mockGetSettings = jest.fn().mockResolvedValue({
        scanningEnabled: true,
        useGoogleSafeBrowsing: true,
        usePhishTank: false,
        usePatternDetection: true,
        notificationsEnabled: true,
        notifyOnHttpWarning: false,
        collectPageSignals: true,
        gsbApiKey: 'test-key-123',
        phishTankApiKey: ''
    });
    mockUpdateSettings = jest.fn().mockResolvedValue(undefined);

    jest.unstable_mockModule(lib('storage.js'), () => ({
        getSettings: mockGetSettings,
        updateSettings: mockUpdateSettings
    }));

    // Set up the DOM BEFORE importing options.js
    buildOptionsDOM();

    // Import options.js — this registers the DOMContentLoaded listener
    await import('../../extension/src/options/options.js');

    // Fire DOMContentLoaded to trigger initialization
    document.dispatchEvent(new Event('DOMContentLoaded'));

    // Wait for async loadSettings to resolve
    await new Promise(r => setTimeout(r, 100));
});

// ─── loadSettings ───────────────────────────────────────────────────────────

describe('Options — loadSettings', () => {
    test('populates checkbox states from stored settings', () => {
        expect(document.getElementById('scanningEnabled').checked).toBe(true);
        expect(document.getElementById('useGoogleSafeBrowsing').checked).toBe(true);
        expect(document.getElementById('usePhishTank').checked).toBe(false);
        expect(document.getElementById('usePatternDetection').checked).toBe(true);
        expect(document.getElementById('notificationsEnabled').checked).toBe(true);
        expect(document.getElementById('notifyOnHttpWarning').checked).toBe(false);
        expect(document.getElementById('collectPageSignals').checked).toBe(true);
    });

    test('populates text input values from stored settings', () => {
        expect(document.getElementById('gsbApiKey').value).toBe('test-key-123');
        expect(document.getElementById('phishTankApiKey').value).toBe('');
    });

    test('getSettings was called on init', () => {
        expect(mockGetSettings).toHaveBeenCalled();
    });
});

// ─── saveSettings ───────────────────────────────────────────────────────────

describe('Options — saveSettings', () => {
    beforeEach(() => {
        mockUpdateSettings.mockClear();
    });

    test('checkbox change triggers saveSettings → updateSettings', async () => {
        const checkbox = document.getElementById('scanningEnabled');
        checkbox.checked = false;
        checkbox.dispatchEvent(new Event('change'));

        await new Promise(r => setTimeout(r, 50));

        expect(mockUpdateSettings).toHaveBeenCalledTimes(1);
        const saved = mockUpdateSettings.mock.calls[0][0];
        expect(saved.scanningEnabled).toBe(false);
    });

    test('text input change triggers saveSettings', async () => {
        const input = document.getElementById('gsbApiKey');
        input.value = 'updated-key';
        input.dispatchEvent(new Event('change'));

        await new Promise(r => setTimeout(r, 50));

        expect(mockUpdateSettings).toHaveBeenCalled();
        const saved = mockUpdateSettings.mock.calls[0][0];
        expect(saved.gsbApiKey).toBe('updated-key');
    });

    test('text input blur triggers saveSettings', async () => {
        const input = document.getElementById('phishTankApiKey');
        input.value = 'pt-key-456';
        input.dispatchEvent(new Event('blur'));

        await new Promise(r => setTimeout(r, 50));

        expect(mockUpdateSettings).toHaveBeenCalled();
        const saved = mockUpdateSettings.mock.calls[0][0];
        expect(saved.phishTankApiKey).toBe('pt-key-456');
    });

    test('saves all 9 settings fields', async () => {
        document.getElementById('scanningEnabled').checked = true;
        document.getElementById('usePhishTank').checked = true;
        document.getElementById('phishTankApiKey').value = 'my-pt-key';

        document.getElementById('usePhishTank').dispatchEvent(new Event('change'));
        await new Promise(r => setTimeout(r, 50));

        const saved = mockUpdateSettings.mock.calls[0][0];
        expect(Object.keys(saved)).toEqual(expect.arrayContaining([
            'scanningEnabled', 'useGoogleSafeBrowsing', 'usePhishTank',
            'usePatternDetection', 'notificationsEnabled', 'notifyOnHttpWarning',
            'collectPageSignals', 'gsbApiKey', 'phishTankApiKey'
        ]));
        expect(saved.usePhishTank).toBe(true);
        expect(saved.phishTankApiKey).toBe('my-pt-key');
    });

    test('shows "Settings saved" confirmation', async () => {
        document.getElementById('notificationsEnabled').dispatchEvent(new Event('change'));
        await new Promise(r => setTimeout(r, 50));

        const status = document.getElementById('status');
        expect(status.textContent).toContain('Settings saved');
        expect(status.style.display).toBe('block');
    });
});

// ─── Help Panel Toggle ──────────────────────────────────────────────────────

describe('Options — Help Panel Toggle', () => {
    test('clicking help toggle opens panel and sets aria-expanded', () => {
        const btn = document.querySelector('.help-toggle');
        const panel = document.getElementById('helpPanel1');

        // Ensure starting state
        panel.classList.remove('show');
        btn.setAttribute('aria-expanded', 'false');

        btn.click();

        expect(panel.classList.contains('show')).toBe(true);
        expect(btn.getAttribute('aria-expanded')).toBe('true');
    });

    test('clicking again closes panel', () => {
        const btn = document.querySelector('.help-toggle');
        const panel = document.getElementById('helpPanel1');

        btn.click(); // Close

        expect(panel.classList.contains('show')).toBe(false);
        expect(btn.getAttribute('aria-expanded')).toBe('false');
    });
});
