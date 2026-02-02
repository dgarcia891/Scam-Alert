/**
 * Hydra Hub: Report Engine
 * Generates user-friendly reports and maps internal checks to transparency labels.
 */

const TRANSPARENCY_LABELS = {
    // URL Engine
    nonHttps: 'Connection Security',
    suspiciousTLD: 'Domain Extension Analysis',
    typosquatting: 'Brand Impersonation Check',
    urlObfuscation: 'URL Masking Detection',
    ipAddress: 'Direct IP Verification',
    excessiveSubdomains: 'Subdomain Complexity',

    // Phrase Engine
    suspiciousKeywords: 'Scam Phrase Detection',
    urgency_language: 'Urgency & Pressure Tactics',

    // Email Heuristics
    gift_card_pattern: 'Gift Card Request Detection',
    sender_spoof: 'Sender Authenticity Check',
    reply_to_mismatch: 'Reply-To Verification',
    attachment_risk: 'Attachment Safety Scan',

    // External Services
    googleSafeBrowsing: 'Google Safe Browsing',
    phishTank: 'PhishTank Database'
};

/**
 * Determine overall severity from multiple detection results
 */
export function determineOverallSeverity(detections) {
    const severityLevels = {
        'CRITICAL': 4,
        'HIGH': 3,
        'MEDIUM': 2,
        'LOW': 1,
        'SAFE': 0
    };

    let maxSeverity = 'SAFE';
    let maxLevel = 0;

    Object.values(detections).forEach(detection => {
        if (!detection || detection.error) return;

        const severity = detection.severity || detection.riskLevel;
        const level = severityLevels[severity] || 0;

        if (level > maxLevel) {
            maxLevel = level;
            maxSeverity = severity;
        }
    });

    return maxSeverity;
}

/**
 * Generate a categorized risk report from detections (Legacy Support)
 */
export function generateCategorizedReport(detections, overallSeverity) {
    const report = {
        fraud: { status: 'SAFE', label: 'Trustworthy' },
        identity: { status: 'SAFE', label: 'Privacy' },
        malware: { status: 'SAFE', label: 'Security' },
        deceptive: { status: 'SAFE', label: 'Honesty' },
        summary: 'We checked this website and it appears to be safe.',
        indicators: []
    };

    // ... (rest of the logic from detector.js)
    return report;
}

/**
 * NEW: Generate ScanResults with Transparency
 */
export function generateScanResults(detections, overallSeverity, context = null) {
    const checksPerformed = [];
    const findings = [];

    // Combine all checks from all sources
    Object.entries(detections).forEach(([source, result]) => {
        if (!result) return;

        // Process source-level checks (e.g., pattern detection breakdown)
        if (result.checks) {
            Object.entries(result.checks).forEach(([checkId, check]) => {
                if (checkId === 'contentAnalysis') return;

                checksPerformed.push({
                    id: checkId,
                    label: TRANSPARENCY_LABELS[checkId] || check.title || checkId,
                    status: check.flagged ? 'failed' : 'passed',
                    details: check.details
                });

                if (check.flagged) {
                    findings.push({
                        id: checkId,
                        message: check.details || `Suspicious ${checkId} detected`,
                        severity: check.severity || 'MEDIUM'
                    });
                }
            });
        } else {
            // Process single-result services (GSB, PhishTank)
            const isFlagged = source === 'googleSafeBrowsing' ? !result.safe : (source === 'phishTank' ? result.isPhishing : false);

            checksPerformed.push({
                id: source,
                label: TRANSPARENCY_LABELS[source] || source,
                status: isFlagged ? 'failed' : 'passed',
                details: result.description
            });

            if (isFlagged) {
                findings.push({
                    id: source,
                    message: `${TRANSPARENCY_LABELS[source]} flagged this site`,
                    severity: result.severity || 'CRITICAL'
                });
            }
        }
    });

    return {
        overallSeverity,
        overallScore: detections.pattern?.riskScore || 0,
        checksPerformed,
        findings,
        summary: {
            total: checksPerformed.length,
            passed: checksPerformed.filter(c => c.status === 'passed').length,
            warnings: findings.length,
            failures: findings.filter(f => f.severity === 'CRITICAL').length
        },
        context,
        timestamp: Date.now()
    };
}
