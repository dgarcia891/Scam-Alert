/**
 * Email Scanner Parser (v19.3 — Fixed Gmail Selectors)
 */
export function extractEmailText() {
    // Gmail/Outlook Selectors
    const selectors = [
        '.a3s.aiL', // Gmail body
        '.a3s',     // Gmail body (fallback)
        '[data-test-id="message-view-body"]', // Outlook body
        '.Email-Message-Body' // Generic
    ];

    for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el) {
            const text = el.innerText || el.textContent || '';
            if (text.trim().length > 0) return text;
        }
    }
    return '';
}

export function parseSenderInfo() {
    // Gmail: .gD holds display name as text, and the actual email in the "email" attribute
    const gDel = document.querySelector('.gD');
    const name = gDel?.getAttribute('name') || gDel?.innerText || '';
    const email = gDel?.getAttribute('email') || '';

    // Outlook fallback
    if (!name && !email) {
        const outlookSender = document.querySelector('[data-testid="SenderPersona"]');
        return {
            name: outlookSender?.getAttribute('aria-label') || 'Unknown',
            email: outlookSender?.getAttribute('title') || ''
        };
    }

    return { name: name || 'Unknown', email };
}

export function extractSubject() {
    // Gmail: .hP holds the subject line
    const subjectEl = document.querySelector('.hP') || document.querySelector('h2.hP');
    if (subjectEl) return subjectEl.innerText || subjectEl.textContent || '';

    // Outlook fallback
    const outlookSubject = document.querySelector('[data-testid="message-subject"]');
    if (outlookSubject) return outlookSubject.innerText || outlookSubject.textContent || '';

    return '';
}

export function extractEmailLinks() {
    const selectors = [
        '.a3s.aiL a', // Gmail body links
        '.a3s a',     // Gmail body links (fallback)
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
