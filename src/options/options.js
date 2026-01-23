/**
 * Options Page Logic
 */

import { getSettings, updateSettings } from '../lib/storage.js';

// Load settings on page load
document.addEventListener('DOMContentLoaded', () => {
    console.log('[Scam Alert] Options initializing...');

    const helpToggles = document.querySelectorAll('.help-toggle');
    helpToggles.forEach((btn) => {
        btn.addEventListener('click', () => {
            const targetId = btn.getAttribute('data-help-target');
            if (!targetId) return;
            const panel = document.getElementById(targetId);
            if (!panel) return;

            const isOpen = panel.classList.contains('show');
            if (isOpen) {
                panel.classList.remove('show');
                btn.setAttribute('aria-expanded', 'false');
            } else {
                panel.classList.add('show');
                btn.setAttribute('aria-expanded', 'true');
            }
        });
    });

    // 1. Add change listeners immediately
    const checkboxes = document.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
        checkbox.addEventListener('change', saveSettings);
    });

    const textInputs = [
        document.getElementById('gsbApiKey'),
        document.getElementById('phishTankApiKey')
    ].filter(Boolean);

    textInputs.forEach(input => {
        input.addEventListener('change', saveSettings);
        input.addEventListener('blur', saveSettings);
    });

    // 2. Load settings without blocking
    loadSettings().catch(err => console.error('[Scam Alert] Settings load error:', err));
});

async function loadSettings() {
    const settings = await getSettings();

    // Populate checkboxes
    const fields = [
        'scanningEnabled',
        'useGoogleSafeBrowsing',
        'usePhishTank',
        'usePatternDetection',
        'notificationsEnabled',
        'notifyOnHttpWarning',
        'collectPageSignals',
        'gsbApiKey',
        'phishTankApiKey'
    ];

    fields.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            if (el.type === 'checkbox') {
                el.checked = settings[id];
            } else {
                el.value = settings[id] || '';
            }
        }
    });
}

// Save settings
async function saveSettings() {
    const settings = {
        scanningEnabled: document.getElementById('scanningEnabled').checked,
        useGoogleSafeBrowsing: document.getElementById('useGoogleSafeBrowsing').checked,
        usePhishTank: document.getElementById('usePhishTank').checked,
        usePatternDetection: document.getElementById('usePatternDetection').checked,
        notificationsEnabled: document.getElementById('notificationsEnabled').checked,
        notifyOnHttpWarning: document.getElementById('notifyOnHttpWarning').checked,
        collectPageSignals: document.getElementById('collectPageSignals').checked,
        gsbApiKey: document.getElementById('gsbApiKey').value,
        phishTankApiKey: document.getElementById('phishTankApiKey').value
    };

    await updateSettings(settings);

    // Show status message
    const status = document.getElementById('status');
    if (status) {
        status.textContent = '✓ Settings saved';
        status.style.display = 'block';
    }

    setTimeout(() => {
        if (status) status.style.display = 'none';
    }, 2000);
}
