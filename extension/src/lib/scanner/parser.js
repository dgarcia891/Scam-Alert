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

export function extractEmailLinks() {
    const selectors = [
        '.a3s.aiL a', // Gmail body links
        '[data-test-id="message-view-body"] a', // Outlook body links
        '.Email-Message-Body a' // Generic
    ];

    const links = [];
    const rawUrls = [];

    for (const sel of selectors) {
        const els = document.querySelectorAll(sel);
        if (els.length > 0) {
            els.forEach(el => {
                if (el.href) {
                    links.push({ href: el.href, text: el.innerText || '' });
                    rawUrls.push(el.href);
                }
            });
            break; // Found links in one of the main body selectors
        }
    }

    return { links, rawUrls };
}
