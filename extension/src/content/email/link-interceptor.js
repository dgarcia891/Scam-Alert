/**
 * Email Link Interceptor
 * 
 * Captures outbound clicks in webmail clients (Gmail/Outlook) to prevent 
 * automatic navigation to risky file downloads or disguised cloud documents.
 */

const RISKY_EXTENSIONS = ['.exe', '.dmg', '.zip', '.pdf', '.scr', '.vbs', '.js', '.tar', '.gz', '.rar', '.bat', '.ps1'];
const CLOUD_OAUTH_DOMAINS = [
    'docs.google.com',
    'sheets.google.com',
    'drive.google.com',
    'script.google.com',
    'onedrive.live.com',
    'sharepoint.com',
    'dropbox.com'
];

export function isRiskyLink(url) {
    if (!url) return false;

    let urlObj;
    try {
        urlObj = new URL(url);
    } catch {
        // Relative links or invalid URLs in email contexts shouldn't be blindly blocked here,
        // let the main scanner handle them if they navigate.
        return false;
    }

    // Check 1: Is it a direct download to a risky file extension?
    const pathname = urlObj.pathname.toLowerCase();
    if (pathname) {
        for (const ext of RISKY_EXTENSIONS) {
            if (pathname.endsWith(ext)) return true;
        }
    }

    // Check 2: Is it a cloud document service often used for phishing/malware delivery?
    const hostname = urlObj.hostname.toLowerCase();
    for (const domain of CLOUD_OAUTH_DOMAINS) {
        if (hostname.endsWith(domain)) return true;
    }

    // Check 3: Suspicious query parameters targeting downloads
    const search = urlObj.search.toLowerCase();
    if (search.includes('export=download') || search.includes('alt=media')) {
        return true;
    }

    return false;
}

export function setupLinkInterceptor(onRiskyClick) {
    if (typeof window === 'undefined') return;

    // Use event delegation on the body to catch all clicks
    document.body.addEventListener('click', (event) => {
        // Traverse up to find the nearest anchor tag
        const anchor = event.target.closest('a');
        if (!anchor) return;

        const href = anchor.href;
        if (!href) return; // Not a hyperlink

        if (isRiskyLink(href)) {
            event.preventDefault(); // Halt navigation
            event.stopPropagation(); // Stop other handlers

            console.warn('[Hydra Guard] Intercepted risky email link:', href);
            onRiskyClick(href);
        }
    }, { capture: true }); // Use capture phase to intercept before React/Angular handlers
}
