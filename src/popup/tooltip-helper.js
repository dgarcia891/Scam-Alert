/**
 * Popup Tooltip Helper
 */

export function setupFloatingCategoryTooltips() {
    const tooltip = document.createElement('div');
    tooltip.className = 'sa-floating-tooltip';
    Object.assign(tooltip.style, {
        position: 'fixed', zIndex: '10000', padding: '12px',
        background: '#1e293b', color: '#f1f5f9', borderRadius: '10px',
        fontSize: '12px', width: '240px', boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
        border: '1px solid #334155', pointerEvents: 'none', display: 'none', opacity: '0'
    });
    document.body.appendChild(tooltip);

    const hide = () => {
        tooltip.style.opacity = '0';
        setTimeout(() => tooltip.style.display = 'none', 200);
    };

    const showFor = (el) => {
        const title = el.getAttribute('data-title');
        const desc = el.getAttribute('data-desc');
        if (!title || !desc) return;

        tooltip.innerHTML = `<div style="font-weight: 800; color: #fb7185; margin-bottom: 4px;">${title}</div><div style="line-height: 1.4;">${desc}</div>`;
        tooltip.style.display = 'block';
        tooltip.style.opacity = '1';

        const rect = el.getBoundingClientRect();
        let top = rect.top - tooltip.offsetHeight - 10;
        let left = rect.left + (rect.width / 2) - (tooltip.offsetWidth / 2);

        if (top < 10) top = rect.bottom + 10;
        left = Math.max(10, Math.min(left, window.innerWidth - tooltip.offsetWidth - 10));

        tooltip.style.top = `${top}px`;
        tooltip.style.left = `${left}px`;
    };

    document.querySelectorAll('.check-item').forEach(el => {
        el.addEventListener('mouseenter', () => showFor(el));
        el.addEventListener('mouseleave', hide);
    });
}

export function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}
