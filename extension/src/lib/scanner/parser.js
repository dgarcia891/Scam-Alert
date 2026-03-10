/**
 * Email Scanner Parser (v19.4 — Comprehensive Gmail Selectors)
 * Added exhaustive fallback selectors covering all Gmail view states.
 */

export function extractEmailText() {
    const selectors = [
        '.a3s.aiL',              // Gmail: Primary email body (most reliable)
        '.a3s',                  // Gmail: Email body fallback
        '.ii.gt .a3s',           // Gmail: body within thread item
        '[data-message-id] .a3s', // Gmail: scoped to message container
        'div[dir="ltr"]',        // Gmail: LTR content block (generic fallback)
        '[data-test-id="message-view-body"]', // Outlook body
        '.Email-Message-Body',   // Generic
        '.gs .ii.gt'             // Gmail: last resort thread body
    ];

    for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el) {
            const text = (el.innerText || el.textContent || '').trim();
            if (text.length > 20) { // Min 20 chars to avoid empty containers
                console.log(`[Hydra Guard] extractEmailText: found via "${sel}" (${text.length} chars)`);
                return text;
            }
        }
    }

    console.warn('[Hydra Guard] extractEmailText: NO body text found — all selectors missed');
    return '';
}

export function parseSenderInfo() {
    // Strategy 1: Gmail .gD element (confirmed working in standard view)
    const gDel = document.querySelector('.gD');
    if (gDel) {
        const email = gDel.getAttribute('email') || '';
        const name = gDel.getAttribute('name') || gDel.innerText || '';
        if (email || name) {
            console.log(`[Hydra Guard] parseSenderInfo: found via .gD — name="${name}" email="${email}"`);
            return { name: name || email, email };
        }
    }

    // Strategy 2: Gmail sender span inside message header
    const senderEl = document.querySelector('.go') || document.querySelector('.gE.iv.gt');
    if (senderEl) {
        const emailAttr = senderEl.getAttribute('email') || '';
        const nameAttr = senderEl.getAttribute('name') || senderEl.innerText || '';
        if (emailAttr || nameAttr) {
            console.log(`[Hydra Guard] parseSenderInfo: found via .go/.gE — name="${nameAttr}" email="${emailAttr}"`);
            return { name: nameAttr || emailAttr, email: emailAttr };
        }
    }

    // Strategy 3: Aria-label on sender element
    const ariaEl = document.querySelector('[data-hovercard-id]');
    if (ariaEl) {
        const emailFromHover = ariaEl.getAttribute('data-hovercard-id') || ariaEl.getAttribute('email') || '';
        const nameFromHover = ariaEl.getAttribute('name') || ariaEl.innerText || '';
        if (emailFromHover.includes('@')) {
            console.log(`[Hydra Guard] parseSenderInfo: found via data-hovercard-id — email="${emailFromHover}"`);
            return { name: nameFromHover || emailFromHover, email: emailFromHover };
        }
    }

    // Strategy 4: Outlook
    const outlookSender = document.querySelector('[data-testid="SenderPersona"]');
    if (outlookSender) {
        const name = outlookSender.getAttribute('aria-label') || 'Unknown';
        const email = outlookSender.getAttribute('title') || '';
        console.log(`[Hydra Guard] parseSenderInfo: found via Outlook — name="${name}" email="${email}"`);
        return { name, email };
    }

    // Strategy 5: Generic "From:" text extraction from email body
    const bodyEl = document.querySelector('.a3s') || document.querySelector('.ii.gt');
    if (bodyEl) {
        const text = bodyEl.innerText || '';
        const fromMatch = text.match(/^From:\s*(.+?)$/im);
        if (fromMatch) {
            const raw = fromMatch[1].trim();
            const emailMatch = raw.match(/<([^>]+@[^>]+)>/);
            const email = emailMatch ? emailMatch[1] : (raw.includes('@') ? raw : '');
            const name = emailMatch ? raw.replace(/<[^>]+>/, '').trim() : '';
            console.log(`[Hydra Guard] parseSenderInfo: parsed from body text — name="${name}" email="${email}"`);
            return { name: name || email, email };
        }
    }

    console.warn('[Hydra Guard] parseSenderInfo: NO sender info found — all strategies missed');
    return { name: 'Unknown', email: '' };
}

export function extractSubject() {
    const selectors = [
        '.hP',                              // Gmail: subject line
        'h2.hP',                            // Gmail: subject as h2
        '[data-thread-id] .hP',            // Gmail: scoped subject
        '[data-testid="message-subject"]', // Outlook
        '.ha h2',                           // Gmail: header subject fallback
        'title'                             // Last resort: page title
    ];

    for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el) {
            const text = (el.innerText || el.textContent || '').trim();
            if (text.length > 0 && text !== 'Gmail') {
                console.log(`[Hydra Guard] extractSubject: found via "${sel}" — "${text}"`);
                return text;
            }
        }
    }

    console.warn('[Hydra Guard] extractSubject: NO subject found');
    return '';
}

export function extractEmailLinks() {
    const selectors = [
        '.a3s.aiL a',
        '.a3s a',
        '[data-test-id="message-view-body"] a',
        '.Email-Message-Body a'
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
            break;
        }
    }

    return { links, rawUrls };
}
