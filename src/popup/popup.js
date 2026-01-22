/**
 * Popup Logic
 */

import { sendMessage, createMessage, MessageTypes } from '../lib/messaging.js';
import { getSettings, updateSettings } from '../lib/storage.js';

// Load current page status
document.addEventListener('DOMContentLoaded', () => {
    console.log('[Scam Alert] Popup initializing...');

    // 1. Attach event listeners immediately so buttons are responsive
    const scanBtn = document.getElementById('scanBtn');
    const toggleBtn = document.getElementById('toggleBtn');
    const settingsLink = document.getElementById('settingsLink');
    const whitelistBtn = document.getElementById('whitelistBtn');

    if (scanBtn) scanBtn.addEventListener('click', scanCurrentPage);
    if (toggleBtn) toggleBtn.addEventListener('click', toggleProtection);
    if (settingsLink) settingsLink.addEventListener('click', () => chrome.runtime.openOptionsPage());
    if (whitelistBtn) whitelistBtn.addEventListener('click', whitelistCurrentSite);

    // Collapsible toggles
    setupCollapsibleToggle('checksToggle', 'checksContent');
    setupCollapsibleToggle('advancedToggle', 'advancedContent');

    setupFloatingCategoryTooltips();

    const setupLink = document.getElementById('setupLink');
    if (setupLink) setupLink.addEventListener('click', (e) => {
        e.preventDefault();
        chrome.runtime.openOptionsPage();
    });

    // Listen for progress updates
    chrome.runtime.onMessage.addListener((message) => {
        if (message.type === 'scan_progress') {
            updateProgressUI(message.data);
        }
    });

    // 2. Perform async initialization without blocking
    initializePopup().catch(err => console.error('[Scam Alert] Init error:', err));
});

function setupFloatingCategoryTooltips() {
    const tooltip = document.getElementById('floatingTooltip');
    if (!tooltip) return;

    const anchors = document.querySelectorAll('.category-tooltip > span[tabindex="0"]');
    if (!anchors || anchors.length === 0) return;

    const hide = () => {
        tooltip.style.display = 'none';
        tooltip.textContent = '';
    };

    const showFor = (el) => {
        const wrapper = el.closest('.category-tooltip');
        if (!wrapper) return;
        const contentEl = wrapper.querySelector('.tooltip');
        const text = contentEl ? contentEl.textContent.trim() : '';
        if (!text) return;

        tooltip.textContent = text;
        tooltip.style.display = 'block';

        // Position tooltip inside popup bounds
        const popupRect = document.body.getBoundingClientRect();
        const anchorRect = el.getBoundingClientRect();
        const tipRect = tooltip.getBoundingClientRect();

        // Prefer right side; if not enough space, use left side.
        const gap = 10;
        const spaceRight = popupRect.right - anchorRect.right;
        const spaceLeft = anchorRect.left - popupRect.left;

        const placeRight = spaceRight >= tipRect.width + gap;
        const left = placeRight
            ? (anchorRect.right + gap)
            : Math.max(popupRect.left + gap, anchorRect.left - gap - tipRect.width);

        // Clamp vertical position so it stays within popup.
        const centerY = anchorRect.top + anchorRect.height / 2;
        const top = clamp(
            centerY - tipRect.height / 2,
            popupRect.top + gap,
            popupRect.bottom - gap - tipRect.height
        );

        tooltip.style.left = `${Math.round(left)}px`;
        tooltip.style.top = `${Math.round(top)}px`;

        // Flip arrow direction depending on placement
        tooltip.classList.toggle('left', placeRight);
    };

    anchors.forEach((el) => {
        el.addEventListener('mouseenter', () => showFor(el));
        el.addEventListener('focus', () => showFor(el));
        el.addEventListener('mouseleave', hide);
        el.addEventListener('blur', hide);
    });

    // Hide tooltip if mouse leaves the popup entirely
    document.addEventListener('mouseleave', hide);
}

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

async function initializePopup() {
    await updateStatus();
    await updateToggleButton();
    await checkApiKeys();

    // BUG-003: Auto-scan if no status found and scanning is enabled
    const statusDiv = document.getElementById('status');
    const settings = await getSettings();
    if (statusDiv && statusDiv.textContent.includes('Not yet scanned') && settings.scanningEnabled) {
        console.log('[Scam Alert] Auto-triggering scan for BUG-003');
        scanCurrentPage();
    }
}

async function updateStatus() {
    try {
        const response = await sendMessage(createMessage(MessageTypes.GET_TAB_STATUS));
        const statusDiv = document.getElementById('status');
        const reportSection = document.getElementById('reportSection');

        const payload = response?.data;
        const result = payload?.result;

        if (result) {
            statusDiv.className = 'status ' + getClassNameForSeverity(result.overallSeverity);
            statusDiv.textContent = getStatusTextForSeverity(result.overallSeverity);

            if (result.report) {
                renderReport(result.report, result.timestamp);
                reportSection.style.display = 'block';
            } else {
                reportSection.style.display = 'none';
            }

            // Render detection sources and pattern checks
            if (result.detections) {
                renderSources(result.detections);
                renderPatternChecks(result.detections.pattern);
                renderKeywordHighlights(result.detections.pattern);
            }
        } else {
            statusDiv.className = 'status warning';
            statusDiv.textContent = 'Not yet scanned';
            reportSection.style.display = 'none';
        }
    } catch (error) {
        console.error('Failed to get status:', error);
    }
}

function renderReport(report, timestamp) {
    const categories = ['fraud', 'identity', 'malware', 'deceptive'];
    categories.forEach(cat => {
        const el = document.getElementById(`${cat}Status`);
        if (el) {
            const status = report[cat].status;
            // Use premium symbols: ✓ (safe), ⚠️ (caution), ✘ (critical)
            el.textContent = status === 'SAFE' ? '✓' : (status === 'CAUTION' ? '⚠️' : '✘');
            el.className = `status-icon status-${status.toLowerCase()}`;
        }
    });

    const explanation = document.getElementById('reportExplanation');
    if (explanation) explanation.textContent = report.summary;

    // Render indicators
    const indList = document.getElementById('indicatorsList');
    const wlBtn = document.getElementById('whitelistBtn');

    if (indList) {
        if (report.indicators && report.indicators.length > 0) {
            indList.innerHTML = report.indicators.map(ind => `
                <div class="indicator-item">
                    <span class="indicator-bullet">•</span>
                    <span>${ind}</span>
                </div>
            `).join('');
            indList.style.display = 'block';
            if (wlBtn) wlBtn.style.display = 'block';
        } else {
            indList.style.display = 'none';
            if (wlBtn) wlBtn.style.display = 'none';
        }
    }

    const tsEl = document.getElementById('reportTimestamp');
    if (tsEl) {
        const date = new Date(timestamp);
        tsEl.textContent = `Checked: ${date.toLocaleTimeString()}`;
    }
}

function renderSources(detections) {
    const sourcesSection = document.getElementById('sourcesSection');
    const sourcesList = document.getElementById('sourcesList');
    if (!sourcesSection || !sourcesList) return;

    // Map detection keys to friendly names
    const sourceNames = {
        pattern: 'Pattern Analysis',
        googleSafeBrowsing: 'Google Safe Browsing'
    };

    const sourceItems = [];

    for (const [key, name] of Object.entries(sourceNames)) {
        const detection = detections[key];
        if (detection === undefined) {
            // Source was not used
            sourceItems.push({ name, status: 'skipped', detail: 'Not enabled' });
        } else if (detection.error) {
            // Source had an error
            sourceItems.push({ name, status: 'error', detail: detection.error });
        } else {
            // Source was used successfully
            let detail = 'Checked';
            if (key === 'pattern' && detection.riskScore !== undefined) {
                detail = `Risk score: ${detection.riskScore}`;
            } else if (key === 'googleSafeBrowsing') {
                if (detection.testMode) {
                    detail = 'Simulated threat (Test mode)';
                } else {
                    detail = detection.safe ? 'No threats found' : `Threat: ${detection.threatType}`;
                }
            }
            sourceItems.push({ name, status: 'used', detail });
        }
    }

    // Only show sources that were actually checked or errored
    const relevantSources = sourceItems.filter(s => s.status !== 'skipped');

    if (relevantSources.length === 0) {
        sourcesSection.style.display = 'none';
        return;
    }

    sourcesList.innerHTML = relevantSources.map(source => {
        const icon = source.status === 'used' ? '✓' : (source.status === 'error' ? '✗' : '○');
        const className = `source-${source.status}`;
        return `
            <div class="source-item">
                <span class="source-icon ${className}">${icon}</span>
                <span><strong>${source.name}:</strong> ${source.detail}</span>
            </div>
        `;
    }).join('');

    sourcesSection.style.display = 'block';
}

function getClassNameForSeverity(severity) {
    switch (severity) {
        case 'CRITICAL': return 'danger';
        case 'HIGH':
        case 'MEDIUM':
        case 'LOW': return 'warning';
        default: return 'safe';
    }
}

function getStatusTextForSeverity(severity) {
    switch (severity) {
        case 'CRITICAL': return '⚠️ We recommend leaving this site';
        case 'HIGH':
        case 'MEDIUM':
        case 'LOW': return '⚠️ Please be careful with this site';
        default: return '✓ This site looks safe';
    }
}

function setupCollapsibleToggle(toggleId, contentId) {
    const toggle = document.getElementById(toggleId);
    const content = document.getElementById(contentId);
    if (!toggle || !content) return;

    toggle.addEventListener('click', () => {
        const isExpanded = content.classList.contains('show');
        if (isExpanded) {
            content.classList.remove('show');
            toggle.classList.remove('expanded');
        } else {
            content.classList.add('show');
            toggle.classList.add('expanded');
        }
    });
}

function renderPatternChecks(patternDetection) {
    const section = document.getElementById('patternChecksSection');
    const list = document.getElementById('patternChecksList');
    if (!section || !list) return;

    // If no pattern detection or no checks data, hide the section
    if (!patternDetection || !patternDetection.checks) {
        section.style.display = 'none';
        return;
    }

    const checks = patternDetection.checks;
    const checkLabels = {
        suspiciousTLD: 'Suspicious domain ending',
        typosquatting: 'Brand impersonation',
        urlObfuscation: 'Hidden or disguised links',
        ipAddress: 'Uses IP address instead of name',
        excessiveSubdomains: 'Unusually complex address',
        suspiciousKeywords: 'Concerning keywords'
    };

    const items = [];
    for (const [key, label] of Object.entries(checkLabels)) {
        const result = checks[key];
        if (result !== undefined) {
            // Each check has a 'flagged' boolean property
            const passed = !result.flagged;
            items.push({
                label,
                passed,
                detail: passed ? 'OK' : (result.details || 'Flagged')
            });
        }
    }

    if (items.length === 0) {
        section.style.display = 'none';
        return;
    }

    list.innerHTML = items.map(item => `
        <div class="pattern-check-item">
            <span>${item.label}</span>
            <span class="check-result ${item.passed ? 'check-ok' : 'check-flagged'}">${item.detail}</span>
        </div>
    `).join('');

    section.style.display = 'block';
}

function renderKeywordHighlights(patternDetection) {
    const section = document.getElementById('keywordHighlightsSection');
    const note = document.getElementById('keywordHighlightsNote');
    const chips = document.getElementById('keywordHighlightsChips');
    if (!section || !note || !chips) return;

    const kw = patternDetection?.checks?.suspiciousKeywords;
    const found = Array.isArray(kw?.keywords) ? kw.keywords : [];

    if (!kw || found.length === 0) {
        section.style.display = 'none';
        chips.innerHTML = '';
        note.textContent = '';
        return;
    }

    const reasonSummary = kw.reasonSummary || (kw.flagged ? '' : 'These words can appear on normal sites too. We only flag when multiple signals line up.');
    note.textContent = kw.flagged ? 'These words contributed to the warning.' : reasonSummary;

    const reasons = kw.keywordReasons || {};
    chips.innerHTML = found.map((word) => {
        const text = String(reasons[word] || 'This keyword can appear in scam or phishing URLs.');
        const escapedWord = escapeHtml(word);
        const escapedText = escapeHtml(text);
        return `
            <span class="keyword-chip" tabindex="0">
                ${escapedWord}
                <span class="keyword-tooltip">${escapedText}</span>
            </span>
        `;
    }).join('');

    section.style.display = 'block';
}

function escapeHtml(str) {
    return String(str)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

async function scanCurrentPage() {
    const btn = document.getElementById('scanBtn');
    const progContainer = document.getElementById('progressContainer');
    const progBar = document.getElementById('progressBar');

    btn.textContent = 'Scanning...';
    btn.disabled = true;
    progContainer.style.display = 'block';
    progBar.style.width = '0%';

    try {
        await sendMessage(createMessage(MessageTypes.SCAN_CURRENT_TAB, { forceRefresh: true }));
        await updateStatus();
    } catch (error) {
        console.error('Scan failed:', error);
    } finally {
        btn.textContent = 'Scan Current Page';
        btn.disabled = false;
        setTimeout(() => {
            progContainer.style.display = 'none';
        }, 1000);
    }
}

function updateProgressUI(data) {
    const progBar = document.getElementById('progressBar');
    const progText = document.getElementById('progressText');
    if (progBar) progBar.style.width = `${data.percent}%`;
    if (progText) progText.textContent = data.message;
}

async function toggleProtection() {
    const settings = await getSettings();
    const newState = !settings.scanningEnabled;

    await updateSettings({ scanningEnabled: newState });
    await updateToggleButton();
}

async function updateToggleButton() {
    const settings = await getSettings();
    const btn = document.getElementById('toggleBtn');

    if (btn) {
        if (settings.scanningEnabled) {
            btn.textContent = 'Disable Protection';
        } else {
            btn.textContent = 'Enable Protection';
        }
    }
}

async function whitelistCurrentSite() {
    try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tabs || tabs.length === 0) return;

        const url = new URL(tabs[0].url);
        const domain = url.hostname.replace(/^www\./, '');

        if (confirm(`Are you sure you want to whitelist ${domain}?`)) {
            await sendMessage(createMessage(MessageTypes.ADD_TO_WHITELIST, { domain }));
            // Start a quick refresh scan to clear the status
            scanCurrentPage();
        }
    } catch (error) {
        console.error('Failed to whitelist site:', error);
    }
}

async function checkApiKeys() {
    const settings = await getSettings();
    const warning = document.getElementById('apiKeyWarning');
    if (warning) {
        const isMissingKeys = (settings.useGoogleSafeBrowsing && !settings.gsbApiKey) ||
            (settings.usePhishTank && !settings.phishTankApiKey);

        warning.style.display = isMissingKeys ? 'block' : 'none';
    }
}

function openSettings(e) {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
}
