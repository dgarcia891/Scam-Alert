/**
 * Central Email Client Registry (HG-FEAT-01)
 * 
 * Single source of truth for all supported email client detection.
 * Add new clients here — no other files need hardcoded URL checks.
 */

/**
 * @typedef {Object} EmailClient
 * @property {string} id
 * @property {string} label
 * @property {string[]} urlPatterns
 * @property {RegExp} urlRegex
 * @property {RegExp} [readingViewHash]
 * @property {string[]} readingViewSelectors
 * @property {string[]} [titlePatterns]
 * @property {Object} selectors
 * @property {string} [selectors.container]
 * @property {string|null} [selectors.messageBody]
 * @property {string} [selectors.sender]
 * @property {string} [selectors.subject]
 * @property {string} [selectors.composeButton]
 * @property {string[]} dom
 * @property {string} senderExtractor
 * @property {boolean} iframeExtraction
 * @property {string|null} iframeSelector
 */

export const EMAIL_CLIENTS = [
    {
        id: 'gmail',
        label: 'Gmail',
        urlPatterns: ['mail.google.com'],
        urlRegex: /mail\.google\.com/,
        readingViewHash: /^#(?:inbox|spam|all|sent|trash|category\/\w+|label\/[^\/]+)\/[-_=+%a-zA-Z0-9]+/,
        readingViewSelectors: ['h2.hP', '.ade', '.bzB'], // Structural headers: subject line, reply toolbar, header row
        titlePatterns: [],
        selectors: {
            container: 'div[role="main"], .nH',
            messageBody: '.a3s.aiL, .adn.ads .a3s, .adn .a3s, .a3s, .ii.gt .a3s, [data-message-id] .a3s, .ii.gt, div[dir="auto"]',  // BUG-125 & BUG-130: added spam/search pane and fallback selectors
            sender: '.gD, .go',
            subject: 'h2.hP, .hP',
            composeButton: "[aria-label*='Compose' i]"
        },
        dom: ["div[role='main']", ".aDP", ".ii.gt"],
        senderExtractor: 'attribute', // uses getAttribute('email') / getAttribute('name')
        iframeExtraction: false,
        iframeSelector: null
    },
    {
        id: 'outlook',
        label: 'Outlook',
        urlPatterns: ['outlook.live.com', 'outlook.office.com', 'outlook.office365.com'],
        urlRegex: /outlook\.(live|office)\S*\.com/,
        readingViewSelectors: ['[role="heading"][aria-level="2"]', '[data-testid="reply-button"]', '[data-testid="message-subject"]'],
        titlePatterns: [],
        selectors: {
            container: '[role="main"]',
            messageBody: '.rps_2003, .rps_2016, [aria-label="Message body"], .BodyFragment, [data-test-id="message-view-body"]',
            sender: '[data-contact-info], [data-testid="SenderPersona"], [aria-label*="From"]',
            subject: '[role="heading"][aria-level="2"], [data-testid="message-subject"], [aria-label="Subject"]',
            composeButton: "[aria-label*='New message' i]"
        },
        dom: ["[data-app='mail']", ".customScrollBar"],
        senderExtractor: 'aria', // uses getAttribute('aria-label') / getAttribute('title')
        iframeExtraction: false,
        iframeSelector: null
    },
    {
        id: 'yahoo',
        label: 'Yahoo Mail',
        urlPatterns: ['mail.yahoo.com'],
        urlRegex: /mail\.yahoo\.com/,
        readingViewSelectors: ['[data-test-id="subject"]', '[data-test-id="reply-btn"]'],
        titlePatterns: [],
        selectors: {
            container: '[data-test-id="message-view"]',
            messageBody: '.msg-body, [data-test-id="message-view-body"]',
            sender: '[data-test-id="from"]',
            subject: '[data-test-id="subject"]',
            composeButton: "[data-test-id='compose-button']"
        },
        dom: [".msg-body", "[data-test-id='message-view']"],
        senderExtractor: 'text',
        iframeExtraction: false,
        iframeSelector: null
    },
    {
        id: 'roundcube',
        label: 'Roundcube',
        urlPatterns: ['roundcube'],
        urlRegex: /(^|\.)(roundcube|webmail)\.[^\/]+|^[^\/]+\/(roundcube|webmail|roundcubemail)\/?$/i,
        readingViewSelectors: ['h2.subject', '.subject'],
        titlePatterns: ['Roundcube'],
        selectors: {
            container: '#mainscreen',
            messageBody: null, // extracted from iframe
            sender: '.header-title.sender, .sender, .from',
            subject: 'h2.subject, .subject',
            composeButton: "[data-action='compose']"
        },
        dom: ['#messagecontframe', '#mainscreen'],
        senderExtractor: 'title-attr', // uses getAttribute('title') or href mailto:
        iframeExtraction: true,
        iframeSelector: '#messagecontframe'
    },
    {
        id: 'protonmail',
        label: 'ProtonMail',
        urlPatterns: ['mail.proton.me', 'mail.protonmail.com'],
        urlRegex: /mail\.proton(mail)?\.me|mail\.protonmail\.com/,
        readingViewSelectors: ['[data-testid="message-header:subject"]', '[data-testid="sidebar:reply"]'],
        titlePatterns: ['Proton Mail'],
        selectors: {
            container: '[data-testid="message-view"]',
            messageBody: '[data-testid="message-content"]',
            sender: '[data-testid="message:header:from"]',
            subject: '[data-testid="message-header:subject"]',
            composeButton: "[data-testid='sidebar:compose']"
        },
        dom: ['[data-testid="message-view"]'],
        senderExtractor: 'text',
        iframeExtraction: false,
        iframeSelector: null
    },
    {
        id: 'zoho',
        label: 'Zoho Mail',
        urlPatterns: ['mail.zoho.com', 'mail.zoho.eu', 'mail.zoho.in'],
        urlRegex: /mail\.zoho\.(com|eu|in)/,
        readingViewSelectors: ['.zmSubject', '.zmReply'],
        titlePatterns: ['Zoho Mail'],
        selectors: {
            container: '.zmMailContent',
            messageBody: '.zmMailBody, .zmail-content',
            sender: '.zmFromAddress, .zmFrom',
            subject: '.zmSubject',
            composeButton: "[data-action='compose']"
        },
        dom: ['.zmMailContent', '.zmMailBody'],
        senderExtractor: 'text',
        iframeExtraction: false,
        iframeSelector: null
    }
];

/**
 * Internal helper to safely evaluate URL matches.
 * @param {string} urlString 
 * @param {Object} client 
 * @returns {boolean}
 */
function evaluateUrlMatch(urlString, client) {
    try {
        const urlObj = new URL(urlString);
        const urlToCheck = urlObj.hostname + urlObj.pathname;
        
        // Use the regex if defined (stricter than patterns)
        if (client.urlRegex) {
            return client.urlRegex.test(urlToCheck);
        }
        
        // Fallback to strict substring included in the hostname + pathname
        return client.urlPatterns.some(p => urlToCheck.includes(p));
    } catch {
        // Fallback for invalid URLs or fragments 
        const lowerUrl = urlString.toLowerCase();
        if (client.urlRegex) return client.urlRegex.test(lowerUrl);
        return client.urlPatterns.some(p => lowerUrl.includes(p));
    }
}

/**
 * Check if a URL belongs to a known email client.
 * @param {string} url - Full URL or hostname
 * @param {string} [title] - Optional page title for title-based detection
 * @returns {boolean}
 */
export function isKnownEmailClient(url, title) {
    if (!url) return false;
    const lowerTitle = title ? title.toLowerCase() : '';

    return EMAIL_CLIENTS.some(client => {
        if (evaluateUrlMatch(url, client)) return true;

        if (lowerTitle && client.titlePatterns.length > 0) {
            return client.titlePatterns.some(t => lowerTitle.includes(t.toLowerCase()));
        }

        return false;
    });
}

/**
 * Get the matching email client config for a URL.
 * @param {string} url - Full URL or hostname
 * @param {string} [title] - Optional page title
 * @returns {Object|null} The client config or null
 */
export function getMatchingClient(url, title) {
    if (!url) return null;
    const lowerTitle = title ? title.toLowerCase() : '';

    for (const client of EMAIL_CLIENTS) {
        if (evaluateUrlMatch(url, client)) return client;

        if (lowerTitle && client.titlePatterns.length > 0) {
            const titleMatch = client.titlePatterns.some(t => lowerTitle.includes(t.toLowerCase()));
            if (titleMatch) return client;
        }
    }

    return null;
}

/**
 * Get the manifest-compatible match patterns for known email domains.
 * Self-hosted clients (like Roundcube) cannot have static patterns.
 * @returns {string[]}
 */
export function getManifestMatchPatterns() {
    const patterns = [];
    for (const client of EMAIL_CLIENTS) {
        for (const p of client.urlPatterns) {
            // Only add full domain patterns, not partial matches like 'roundcube'
            if (p.includes('.')) {
                patterns.push(`https://${p}/*`);
            }
        }
    }
    return patterns;
}
