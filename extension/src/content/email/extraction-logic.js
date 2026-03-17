/**
 * Email Data Extraction Logic
 * Handles selector-based parsing for Gmail and Outlook.
 */

export const SELECTORS = {
    GMAIL: {
        container: '.nH.hx',
        messageBody: '.a3s.aiL, .ii.gt, [role="gridcell"] .a3s',
        sender: '.gD, .ov.adx',
        subject: '.hP'
    },
    OUTLOOK: {
        container: '[role="main"]',
        messageBody: '.rps_2003, .rps_2016, [aria-label="Message body"], .BodyFragment',
        sender: '[data-contact-info]',
        subject: '[role="heading"][aria-level="2"]'
    },
    ROUNDCUBE: {
        iframe: '#messagecontframe',
        subject: 'h2.subject, .subject',
        sender: '.header-title.sender, .sender, .from'
    }
};

export async function getEmailSettings() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['settings'], (result) => {
            const settings = result.settings || {};
            resolve({
                enabled: settings.emailScanningEnabled !== false,
                promptDisabled: settings.emailPromptDisabled === true
            });
        });
    });
}

export async function shouldShowPrompt(settings) {
    if (settings.enabled || settings.promptDisabled) return false;
    return new Promise((resolve) => {
        try {
            chrome.storage.local.get(['emailPromptSessionDismissed'], (result) => {
                resolve(!result.emailPromptSessionDismissed);
            });
        } catch {
            resolve(true);
        }
    });
}

export function extractEmailData() {
    const isGmail = window.location.hostname.includes('mail.google.com');
    const isOutlook = window.location.hostname.includes('outlook') || window.location.hostname.includes('office.com');
    const isRoundcube = window.location.hostname.includes('roundcube') || window.location.pathname.includes('roundcube') || document.title.includes('Roundcube');

    let bodyText = '';
    let senderName = '';
    let senderEmail = '';
    let subject = '';

    const extractEmail = (text) => {
        if (!text) return '';
        const match = text.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/);
        return match ? match[0] : '';
    };

    if (isGmail) {
        const body = document.querySelector(SELECTORS.GMAIL.messageBody);
        const sender = document.querySelector(SELECTORS.GMAIL.sender);
        const subj = document.querySelector(SELECTORS.GMAIL.subject);

        if (body) bodyText = body.innerText;
        if (sender) {
            senderName = sender.getAttribute('name') || sender.innerText;
            senderEmail = sender.getAttribute('email');
            if (!senderEmail) {
                senderEmail = extractEmail(senderName) || extractEmail(sender.innerText);
            }
        }
        if (subj) subject = subj.innerText;
    } else if (isOutlook) {
        const body = document.querySelector(SELECTORS.OUTLOOK.messageBody);
        const sender = document.querySelector(SELECTORS.OUTLOOK.sender);
        const subj = document.querySelector(SELECTORS.OUTLOOK.subject);

        if (body) bodyText = body.innerText;
        if (sender) {
            senderName = sender.innerText;
            senderEmail = sender.getAttribute('data-contact-info') || extractEmail(sender.innerText);
        }
        if (subj) subject = subj.innerText;
    } else if (isRoundcube) {
        try {
            const iframe = document.querySelector(SELECTORS.ROUNDCUBE.iframe);
            const doc = iframe ? iframe.contentDocument || iframe.contentWindow.document : document;
            
            const body = doc.body;
            const sender = doc.querySelector(SELECTORS.ROUNDCUBE.sender);
            const subj = doc.querySelector(SELECTORS.ROUNDCUBE.subject);

            if (body) {
                // Remove style/script tags from extraction
                const clone = body.cloneNode(true);
                clone.querySelectorAll('script, style').forEach(el => el.remove());
                bodyText = clone.innerText;
            }
            if (sender) {
                senderName = sender.innerText;
                senderEmail = sender.getAttribute('title') || sender.getAttribute('href')?.replace('mailto:', '') || extractEmail(sender.innerText);
            } else {
                // Fallback attempt to find email pattern in top of body
                const potentialEmail = extractEmail(bodyText.slice(0, 500));
                if (potentialEmail) senderEmail = potentialEmail;
            }
            if (subj) subject = subj.innerText;
        } catch (e) {
            console.warn('[Hydra Guard] Roundcube iframe access blocked or failed:', e);
        }
    }

    return { bodyText, senderName, senderEmail, subject, isEmailView: true };
}
