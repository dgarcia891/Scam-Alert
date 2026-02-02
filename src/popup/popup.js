/**
 * Popup Orchestrator (v19.2 Modularized)
 */

import { sendMessage, createMessage, MessageTypes } from '../lib/messaging.js';
import { getSettings, updateSettings } from '../lib/storage.js';
import { setupFloatingCategoryTooltips, clamp } from './tooltip-helper.js';
import {
    getClassNameForSeverity, getStatusTextForSeverity, renderSources,
    renderReport, renderPatternChecks, renderKeywordHighlights, renderScanSummary
} from './ui-renderers.js';
import { BlocklistComponent } from './components/Blocklist.js';

let cachedSettings = null;

document.addEventListener('DOMContentLoaded', () => {
    console.log('[Scam Alert] Popup initializing...');

    const bind = (id, event, fn) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener(event, fn);
    };

    bind('scanBtn', 'click', scanCurrentPage);
    bind('toggleBtn', 'click', toggleProtection);
    bind('settingsLink', 'click', () => chrome.runtime.openOptionsPage());
    bind('whitelistBtn', 'click', whitelistCurrentSite);
    bind('setupLink', 'click', (e) => { e.preventDefault(); chrome.runtime.openOptionsPage(); });

    setupCollapsibleToggle('checksToggle', 'checksContent');
    setupCollapsibleToggle('advancedToggle', 'advancedContent');
    setupCollapsibleToggle('blocklistToggle', 'blocklistContent');

    new BlocklistComponent('blocklistContainer');

    setupFloatingCategoryTooltips();

    chrome.runtime.onMessage.addListener((msg) => {
        if (msg.type === 'scan_progress') updateProgressUI(msg.data);
    });

    initializePopup().catch(err => console.error('[Scam Alert] Init error:', err));
});

async function initializePopup() {
    cachedSettings = await getSettings();
    await updateStatus();
    await updateToggleButton(cachedSettings);
    await updateScanButtonLabel(cachedSettings);
    await checkApiKeys(cachedSettings);
    updatePrivacyNote();

    const statusDiv = document.getElementById('status');
    if (statusDiv?.textContent.includes('Not yet scanned') && cachedSettings?.scanningEnabled) {
        scanCurrentPage();
    }
}

async function updateStatus() {
    try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        const tab = tabs[0];
        if (!tab) return;

        const response = await sendMessage(createMessage(MessageTypes.GET_SCAN_RESULTS, { tabId: tab.id }));
        const statusDiv = document.getElementById('status');
        const reportSection = document.getElementById('reportSection');
        const results = response?.data?.results;

        if (results) {
            statusDiv.className = 'status ' + getClassNameForSeverity(results.overallSeverity);
            statusDiv.textContent = getStatusTextForSeverity(results.overallSeverity);

            // New Transparency UI
            renderScanSummary(results);

            // Legacy Support (Compatibility with existing report structure)
            if (results.report) {
                renderReport(results.report, results.timestamp);
                reportSection.style.display = 'block';
            } else {
                reportSection.style.display = 'none';
            }

            if (results.detections) {
                renderSources(results.detections);
                renderPatternChecks(results.detections.pattern);
                renderKeywordHighlights(results.detections.pattern);
            }
        } else {
            statusDiv.className = 'status warning';
            statusDiv.textContent = 'Not yet scanned';
            reportSection.style.display = 'none';
            const ss = document.getElementById('scanSummary');
            if (ss) ss.style.display = 'none';
        }
        updatePrivacyNote();
    } catch (e) { console.error('Status sync failed:', e); }
}

async function scanCurrentPage() {
    const btn = document.getElementById('scanBtn');
    const prog = document.getElementById('progressContainer');
    btn.textContent = 'Scanning...'; btn.disabled = true;
    prog.style.display = 'block';

    try {
        await sendMessage(createMessage(MessageTypes.SCAN_CURRENT_TAB, { forceRefresh: true }));
        await updateStatus();
    } finally {
        await updateScanButtonLabel();
        btn.disabled = false;
        setTimeout(() => prog.style.display = 'none', 1000);
    }
}

function setupCollapsibleToggle(toggleId, contentId) {
    const toggle = document.getElementById(toggleId);
    const content = document.getElementById(contentId);
    if (toggle && content) {
        toggle.addEventListener('click', () => {
            content.classList.toggle('show');
            toggle.classList.toggle('expanded');
        });
    }
}

function updateProgressUI(data) {
    const bar = document.getElementById('progressBar');
    const txt = document.getElementById('progressText');
    if (bar) bar.style.width = `${data.percent}%`;
    if (txt) txt.textContent = data.message;
}

async function toggleProtection() {
    const settings = await getSettings();
    const newState = !settings.scanningEnabled;
    await updateSettings({ scanningEnabled: newState });
    cachedSettings = await getSettings();
    updateToggleButton(cachedSettings);
    updateScanButtonLabel(cachedSettings);
    updatePrivacyNote();
}

function updateToggleButton(s) {
    const btn = document.getElementById('toggleBtn');
    if (btn) btn.textContent = s.scanningEnabled ? 'Disable Protection' : 'Enable Protection';
}

async function updateScanButtonLabel(s) {
    const btn = document.getElementById('scanBtn');
    if (!btn) return;
    const settings = s || await getSettings();
    btn.textContent = settings.scanningEnabled ? 'Scan Again' : 'Scan Current Page';
}

async function whitelistCurrentSite() {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tabs?.[0]) return;
    const domain = new URL(tabs[0].url).hostname.replace(/^www\./, '');
    if (confirm(`Whitelist ${domain}?`)) {
        await sendMessage(createMessage(MessageTypes.ADD_TO_WHITELIST, { domain }));
        scanCurrentPage();
    }
}

async function checkApiKeys(s) {
    const warn = document.getElementById('apiKeyWarning');
    if (warn) warn.style.display = ((s.useGoogleSafeBrowsing && !s.gsbApiKey) || (s.usePhishTank && !s.phishTankApiKey)) ? 'block' : 'none';
}

function updatePrivacyNote() {
    const out = document.getElementById('privacyNoteText');
    if (out && cachedSettings) {
        out.textContent = cachedSettings.collectPageSignals
            ? 'Local analysis finished. No page content was shared.'
            : 'Page signals are currently inactive.';
    }
}
