/**
 * Email Scanner Parser (v19.4 — Comprehensive Gmail Selectors)
 * Added exhaustive fallback selectors covering all Gmail view states.
 */

export function extractEmailText() {
    const selectors = [
        '.a3s.aiL',              // Gmail: Primary email body (most reliable, standard inbox)
        '.adn.ads .a3s',         // Gmail: Spam/search preview pane body (BUG-125)
        '.aqs.aqq .a3s',         // Gmail: another search/filter pane variant
        '.adn .a3s',             // Gmail: Generic reading pane body (BUG-125)
        '.a3s',                  // Gmail: Email body fallback
        '.ii.gt .a3s',           // Gmail: body within thread item
        '.gs .ii.gt .a3s',       // Gmail: expanded thread body
        '[data-message-id] .a3s', // Gmail: scoped to message container
        '.ii.gt',                // Gmail: plain text/altered layout fallback (BUG-130)
        '[data-message-id] div[dir="auto"]', // Gmail: alternate wrapper (BUG-130)
        '[data-message-id] div[dir="ltr"]', // Gmail: alternate wrapper (BUG-130)
        '.nH.hx .a3s',           // Gmail: wide generic fallback (BUG-130)
        'div[dir="ltr"]',        // Gmail: LTR content block (generic fallback)
        'div[role="main"] .a3s', // Gmail: scoped to main reading area
        '.nH[role="main"] .a3s', // Gmail: alternate main container
        '.aDP .a3s',             // Gmail: alternate reading pane
        '[data-test-id="message-view-body"]', // Outlook body
        '.Email-Message-Body',   // Generic
        '.gs .ii.gt',            // Gmail: last resort thread body
        '[data-testid="message-content"]',    // ProtonMail body
        '.msg-body',             // Yahoo body
        '.zmMailBody, .zmail-content'          // Zoho body
    ];

    for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el) {
            const text = (el.innerText || el.textContent || '').trim();
            if (text.length > 5) { // Min 5 chars to catch short emails
                console.log(`[Hydra Guard] extractEmailText: found via "${sel}" (${text.length} chars)`);
                return text;
            }
        }
    }

    // BUG-125: Last resort — try any iframe body (e.g. Roundcube or sandboxed Gmail previews)
    try {
        for (const iframe of document.querySelectorAll('iframe')) {
            try {
                const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
                if (iframeDoc?.body) {
                    const text = (iframeDoc.body.innerText || '').trim();
                    if (text.length > 5) {
                        console.log(`[Hydra Guard] extractEmailText: found in iframe body (${text.length} chars)`);
                        return text;
                    }
                }
            } catch { /* cross-origin iframe, skip */ }
        }
    } catch { /* ignore */ }

    // BUG-137: Gmail programmatic fallback — if all CSS selectors miss,
    // walk the reading pane looking for the largest text block.
    // This defends against Gmail changing internal class names.
    if (location.hostname === 'mail.google.com') {
        try {
            const readingPane = document.querySelector('.nH.hx') || document.querySelector('.aeF') || document.querySelector('[role="main"]');
            if (readingPane) {
                // Try thread message items (.gs), then any nested div with substantial text
                const candidates = readingPane.querySelectorAll('.gs, [data-message-id], .ii, .adn');
                let bestText = '';
                for (const el of candidates) {
                    if (el.closest('[id^="hydra-guard"]')) continue;
                    const text = (el.innerText || '').trim();
                    if (text.length > bestText.length && text.length > 5) {
                        bestText = text;
                    }
                }
                if (bestText.length > 5) {
                    console.log(`[Hydra Guard] extractEmailText: Gmail fallback scan (${bestText.length} chars)`);
                    return bestText;
                }
            }
        } catch { /* ignore */ }
    }

    // BUG-145: Defend against image-only (textless) scams
    // Extract alt text from images / SVGs as a last resort
    const imgText = Array.from(document.querySelectorAll('img[alt], [aria-label]'))
        .map(el => el.getAttribute('alt') || el.getAttribute('aria-label') || '')
        .filter(t => t.length > 5 && !['Profile', 'Avatar', 'Toolbar', 'Search', 'Menu'].some(skip => t.includes(skip)))
        .join(' ');
        
    if (imgText.length > 5) {
        console.log(`[Hydra Guard] extractEmailText: Extracted from img/aria tags (${imgText.length} chars)`);
        return imgText;
    }

    // Tier 2: Universal Main Text Fallback (e.g. Reading Panes or <main>)
    const mainEls = document.querySelectorAll('[role="main"], main, #main');
    for (const main of mainEls) {
        let text = (main.innerText || '').trim();
        text = text.replace(/^(Loading\.\.\.|Loading|Working\.\.\.)/ig, '').trim();
        if (text.length > 20) {
            console.log(`[Hydra Guard] extractEmailText: Universal Tier 2 Fallback ([role=main]) (${text.length} chars)`);
            return text;
        }
    }

    // Tier 3: Absolute Universal Document Body Fallback
    if (document.body) {
        let text = (document.body.innerText || '').trim();
        text = text.replace(/^(Loading\.\.\.|Loading|Working\.\.\.)/ig, '').trim();
        
        if (text.length > 20) {
           console.log(`[Hydra Guard] extractEmailText: Universal Tier 3 Fallback (document.body) (${text.length} chars)`);
           return text;
        }
    }

    console.warn('[Hydra Guard] extractEmailText: NO body text found — document is completely empty or just noise.');
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
        if (emailFromHover.includes('@') || nameFromHover) {
            console.log(`[Hydra Guard] parseSenderInfo: found via data-hovercard-id — email="${emailFromHover}", name="${nameFromHover}"`);
            return { name: nameFromHover || emailFromHover, email: emailFromHover };
        }
    }

    // Strategy 4: Generic Span fallback
    const spanEmail = document.querySelector('span[email]');
    if (spanEmail) {
        const spanEmailAttr = spanEmail.getAttribute('email') || '';
        const spanNameAttr = spanEmail.getAttribute('name') || spanEmail.innerText || '';
        if (spanEmailAttr || spanNameAttr) {
            console.log(`[Hydra Guard] parseSenderInfo: found via span[email] — name="${spanNameAttr}", email="${spanEmailAttr}"`);
            return { name: spanNameAttr || spanEmailAttr, email: spanEmailAttr };
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

    // Strategy 6: Aggressive Regex over the entire document for an email address (Last ditch effort, but effective if DOM obfuscated)
    const allText = document.body ? document.body.innerText : '';
    // Look for `<email@domain.com>` format usually used in headers, e.g. "John Doe <john@doe.com>"
    const aggressiveMatch = allText.match(/([A-Z0-9\.\_\%\+\-]+@[A-Z0-9\.\-]+\.[A-Z]{2,})/i);
    if (aggressiveMatch) {
         console.log(`[Hydra Guard] parseSenderInfo: aggressive regex fallback caught: ${aggressiveMatch[1]}`);
         return { name: aggressiveMatch[1], email: aggressiveMatch[1] };
    }

    console.warn('[Hydra Guard] parseSenderInfo: NO sender info found — all strategies missed, returning location.host');
    return { name: `Fallback (${location.hostname})`, email: `${location.hostname}` };
}

export function extractSubject() {
    const selectors = [
        '.hP',                              // Gmail: subject line
        'h2.hP',                            // Gmail: subject as h2
        '[data-thread-id] .hP',            // Gmail: scoped subject
        'h2[data-legacy-thread-id]',       // Gmail: alternate subject
        '[data-message-id] div[role="heading"]', // Gmail: deeply obscured SPA heading
        '[data-testid="message-subject"]', // Outlook
        '.ha h2',                           // Gmail: header subject fallback
        'h2.subject, .subject',             // Roundcube subject
        '[data-testid="message-header:subject"]', // ProtonMail
        '[data-test-id="subject"]',         // Yahoo
        '.zmSubject',                        // Zoho
        'div[role="heading"][aria-level="2"]', // Universal accessible heading
        'title'                             // Last resort: page title
    ];

    for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el) {
            // BUG-145: Title tag requires .textContent because it's invisible to layout engine
            const text = (el.innerText || el.textContent || '').trim();
            
            // Ignore default client titles (e.g. Inbox (31) - someone@gmail.com - Gmail)
            if (text.length > 0 && text !== 'Gmail') {
                let cleanText = text;
                if (sel === 'title') {
                    // Strip prefix like "(3) Inbox - " or "Inbox (3) - "
                    cleanText = cleanText.replace(/^(\(\d+\)\s*)?[a-zA-Z]+\s*(\(\d+\)\s*)?-\s*/, '');
                    // Strip suffix "- myemail@gmail.com - Gmail"
                    cleanText = cleanText.replace(/\s+-\s+.*?- Gmail$/, '');
                    
                    // If the title was literally just "Inbox", skip it
                    if (cleanText.toLowerCase() === 'inbox') continue;
                } else {
                    // For non-title elements, avoid grabbing "Inbox (31) -"
                    if (/^[A-Za-z0-9]+\s+\(\d+\)\s+-/.test(text)) continue;
                }
                
                if (!cleanText.trim()) continue;

                console.log(`[Hydra Guard] extractSubject: found via "${sel}" — "${cleanText}"`);
                return cleanText;
            }
        }
    }

    console.warn('[Hydra Guard] extractSubject: NO subject found — falling back to document.title');
    return document.title || 'Unknown Subject';
}

export function extractEmailLinks() {
    const selectors = [
        '.a3s.aiL a, .a3s.aiL area',          // BUG-145: Add area tags for image-maps
        '.adn.ads .a3s a, .adn.ads .a3s area',// BUG-125 & BUG-145
        '.adn .a3s a, .adn .a3s area',
        '.a3s a, .a3s area',
        '[data-test-id="message-view-body"] a, [data-test-id="message-view-body"] area',
        '.Email-Message-Body a, .Email-Message-Body area',
        '[data-testid="message-content"] a, [data-testid="message-content"] area', // ProtonMail
        '.msg-body a, .msg-body area',                        // Yahoo
        '.zmMailBody a, .zmMailBody area'                       // Zoho
    ];

    const links = [];
    const rawUrls = [];
    const seen = new Set();

    for (const sel of selectors) {
        const els = document.querySelectorAll(sel);
        if (els.length > 0) {
            els.forEach(el => {
                if (el.href && !seen.has(el.href)) {
                    seen.add(el.href);
                    links.push({ href: el.href, text: el.innerText || '' });
                    rawUrls.push(el.href);
                }
            });
            break;
        }
    }

    return { links, rawUrls };
}

export function extractHiddenHeaders() {
    const headers = {};
    
    try {
        // Gmail: look for the security details table (accessible via the 'Show details' dropdown if opened,
        // or sometimes rendered invisibly in the DOM).
        const detailsTables = document.querySelectorAll('table.cf.ajC td');
        for (let i = 0; i < detailsTables.length; i++) {
            const text = detailsTables[i].innerText || '';
            if (text.includes('Reply-to:')) {
                const nextTd = detailsTables[i].nextElementSibling;
                if (nextTd) headers['Reply-To'] = nextTd.innerText.trim();
            } else if (text.includes('mailed-by:')) {
                const nextTd = detailsTables[i].nextElementSibling;
                if (nextTd) headers['mailed-by'] = nextTd.innerText.trim();
            } else if (text.includes('signed-by:')) {
                const nextTd = detailsTables[i].nextElementSibling;
                if (nextTd) headers['signed-by'] = nextTd.innerText.trim();
            }
        }

        // Generic fallback for raw headers in pre blocks (sometimes seen in "show original" or raw viewers)
        const preBlocks = document.querySelectorAll('pre');
        preBlocks.forEach(pre => {
            const content = pre.innerText || '';
            const rpMatch = content.match(/^Return-Path:\s*(.+)$/im);
            if (rpMatch) headers['Return-Path'] = rpMatch[1].trim();
            
            const rtMatch = content.match(/^Reply-To:\s*(.+)$/im);
            if (rtMatch) headers['Reply-To'] = rtMatch[1].trim();
        });
        
    } catch (e) {
        console.warn('[Hydra Guard] Failed to extract hidden headers:', e);
    }
    
    return headers;
}
