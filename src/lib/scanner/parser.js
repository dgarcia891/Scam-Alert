/**
 * Email Scanner Parser (v19.2 Refactored)
 */
export function extractEmailText() {
    // Gmail/Outlook Selectors
    const selectors = [
        '.a3s.aiL', // Gmail body
        '[data-test-id="message-view-body"]', // Outlook body
        '.Email-Message-Body' // Generic
    ];

    for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el) return el.innerText || el.textContent || '';
    }
    return '';
}

export function parseSenderInfo() {
    const nameEl = document.querySelector('.gD'); // Gmail sender
    const emailEl = document.querySelector('.go'); // Gmail email

    return {
        name: nameEl?.innerText || 'Unknown',
        email: emailEl?.getAttribute('email') || ''
    };
}
