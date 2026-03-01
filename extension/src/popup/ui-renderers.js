/**
 * Popup UI Renderers
 */

export function getClassNameForSeverity(severity) {
    switch (severity) {
        case 'CRITICAL': return 'danger';
        case 'HIGH':
        case 'MEDIUM':
        case 'LOW': return 'warning';
        default: return 'safe';
    }
}

export function getStatusTextForSeverity(severity) {
    switch (severity) {
        case 'CRITICAL': return '⚠️ We recommend leaving this site';
        case 'HIGH':
        case 'MEDIUM':
        case 'LOW': return '⚠️ Please be careful with this site';
        default: return '✓ This site looks safe';
    }
}

export function escapeHtml(str) {
    return String(str)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

export function renderSources(detections) {
    const section = document.getElementById('sourcesSection');
    const list = document.getElementById('sourcesList');
    if (!section || !list) return;

    const sourceNames = { pattern: 'Pattern Analysis', googleSafeBrowsing: 'Google Safe Browsing' };
    const items = [];

    for (const [key, name] of Object.entries(sourceNames)) {
        const d = detections[key];
        if (d === undefined) continue;
        const icon = d.error ? '✗' : (d.flagged || (d.overallSeverity && d.overallSeverity !== 'SAFE') ? '⚠️' : '✓');
        const detail = d.error ? d.error : (key === 'pattern' ? `Severity: ${d.overallSeverity || 'SAFE'}` : (d.safe ? 'Safe' : 'Threat found'));
        items.push({ name, icon, detail, status: d.error ? 'error' : 'used' });
    }

    if (items.length === 0) { section.style.display = 'none'; return; }

    list.innerHTML = items.map(s => `
        <div class="source-item">
            <span class="source-icon source-${s.status}">${s.icon}</span>
            <span><strong>${s.name}:</strong> ${s.detail}</span>
        </div>
    `).join('');
    section.style.display = 'block';
}

export function renderReport(report, timestamp) {
    const categories = ['fraud', 'identity', 'malware', 'deceptive'];
    categories.forEach(cat => {
        const el = document.getElementById(`${cat}Status`);
        if (el) {
            const status = report[cat].status;
            el.textContent = status === 'SAFE' ? '✓' : (status === 'CAUTION' ? '⚠️' : '✘');
            el.className = `status-icon status-${status.toLowerCase()}`;
        }
    });

    const explanation = document.getElementById('reportExplanation');
    if (explanation) explanation.textContent = report.summary;

    const indList = document.getElementById('indicatorsList');
    if (indList) {
        indList.innerHTML = (report.indicators || []).map(ind => `
            <div class="indicator-item"><span class="indicator-bullet">•</span><span>${ind}</span></div>
        `).join('');
        indList.style.display = report.indicators?.length ? 'block' : 'none';
    }

    const tsEl = document.getElementById('reportTimestamp');
    if (tsEl) tsEl.textContent = `Checked: ${new Date(timestamp).toLocaleTimeString()}`;
}

export function renderPatternChecks(patternDetection) {
    const list = document.getElementById('patternChecksList');
    if (!list) return;
    list.innerHTML = '';

    if (!patternDetection?.checks) return;

    Object.entries(patternDetection.checks).forEach(([key, check]) => {
        if (key === 'contentAnalysis' || !check.title) return;
        const item = document.createElement('div');
        item.className = `pattern-check-item`; // Fix: CSS class name changed for consistency
        item.innerHTML = `
            <span>${check.title.replace('check_', '').replace(/_/g, ' ')}</span>
            <span class="check-result ${check.flagged ? 'check-flagged' : 'check-ok'}">${check.details || (check.flagged ? 'Flagged' : 'OK')}</span>
        `;
        list.appendChild(item);
    });
}

export function renderKeywordHighlights(patternDetection) {
    const section = document.getElementById('keywordHighlightsSection');
    const note = document.getElementById('keywordHighlightsNote');
    const chips = document.getElementById('keywordHighlightsChips');
    if (!section || !note || !chips) return;

    const kw = patternDetection?.checks?.suspiciousKeywords;
    const found = kw?.keywords || [];
    if (!kw || found.length === 0) { section.style.display = 'none'; return; }

    note.textContent = kw.flagged ? 'These words contributed to the warning.' : (kw.reasonSummary || '');
    chips.innerHTML = found.map(word => `
        <span class="keyword-chip" tabindex="0">
            ${escapeHtml(word)}
            <span class="keyword-tooltip">${escapeHtml(kw.keywordReasons?.[word] || 'Suspicious term')}</span>
        </span>
    `).join('');
    section.style.display = 'block';
}
