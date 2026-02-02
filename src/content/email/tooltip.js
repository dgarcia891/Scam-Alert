/**
 * Tooltip and Highlighting Logic
 */

let tooltipEl = null;

export function getTooltip() {
    if (tooltipEl) return tooltipEl;
    tooltipEl = document.createElement('div');
    Object.assign(tooltipEl.style, {
        position: 'fixed', zIndex: '2147483647', padding: '12px 16px',
        backgroundColor: '#1e293b', color: '#f8fafc', borderRadius: '12px',
        fontSize: '13px', maxWidth: '300px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.5)',
        border: '1px solid #334155', pointerEvents: 'none', display: 'none',
        lineHeight: '1.5', fontFamily: 'system-ui, sans-serif'
    });
    document.body.appendChild(tooltipEl);
    return tooltipEl;
}

export function showTooltip(target, text) {
    const tooltip = getTooltip();
    tooltip.innerHTML = text;
    tooltip.style.display = 'block';
    const rect = target.getBoundingClientRect();
    tooltip.style.left = `${rect.left}px`;
    tooltip.style.top = `${rect.bottom + 8}px`;
}

export function hideTooltip() {
    const tooltip = getTooltip();
    tooltip.style.display = 'none';
}

export function applyInPageHighlighting(result) {
    if (!result || !result.checks) return;
    const findings = Object.values(result.checks).filter(c => c.flagged && c.matches?.length);
    findings.forEach(f => {
        f.matches.forEach(match => {
            // Very basic highlighting logic - in production use a more robust DOM walker
            const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
            let node;
            while (node = walker.nextNode()) {
                if (node.textContent.includes(match) && !node.parentElement.closest('.scam-alert-highlight')) {
                    const span = document.createElement('span');
                    span.className = 'scam-alert-highlight';
                    Object.assign(span.style, { backgroundColor: 'rgba(225, 29, 72, 0.2)', borderBottom: '2px solid #e11d48', cursor: 'help' });
                    span.textContent = match;
                    const range = document.createRange();
                    const start = node.textContent.indexOf(match);
                    range.setStart(node, start);
                    range.setEnd(node, start + match.length);
                    range.deleteContents();
                    range.insertNode(span);
                    span.onmouseenter = () => showTooltip(span, f.details || f.description);
                    span.onmouseleave = hideTooltip;
                }
            }
        });
    });
}
