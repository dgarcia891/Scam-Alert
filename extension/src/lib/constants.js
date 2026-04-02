/**
 * Shared constants for the extension
 */
export const OVERLAY_ID = 'hydra-guard-overlay-root';

/**
 * Human-friendly labels for scan check keys.
 * Used in both the Popup DevPanel and the Content Script Overlay.
 */
export const CHECK_LABELS = {
    // Email Heuristics
    emailScams: '✉️ Email Scam Indicators',
    urgencySignals: '⏰ Urgency / Pressure Signals',
    emailReputation: '📬 Sender Reputation Check',
    
    // Domain & URL Heuristics
    typosquatting: '🎭 Identity Spoofing (Fake Domain)',
    advancedTyposquatting: '🎭 Advanced Typosquatting',
    suspiciousKeywords: '🔍 Suspicious Keywords in URL',
    nonHttps: '🔓 Unencrypted Connection (HTTP)',
    suspiciousTLD: '🌐 Suspicious Domain Extension',
    ipAddress: '📍 IP Address as URL',
    urlObfuscation: '🕵️ URL Character Obfuscation',
    excessiveSubdomains: '🌿 Excessive Subdomains',
    suspiciousPort: '🔌 Non-standard Port',
    
    // Page Content
    contentAnalysis: '📄 Page Content Analysis',
    
    // Third-party Sources
    googleSafeBrowsing: '🛡️ Google Safe Browsing',
    phish_tank_database: '🛡️ PhishTank Threat DB',
    
    // AI
    ai_second_opinion: '🤖 AI Security Verdict',
    aiVerification: '🤖 AI Security Verdict'
};
