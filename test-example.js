/**
 * Test/Example File
 * 
 * Use this to test the scam detection APIs before integrating into extension
 */

// Test URLs
const testUrls = {
    safe: [
        'https://google.com',
        'https://github.com',
        'https://stackoverflow.com'
    ],
    suspicious: [
        'http://paypa1-secure.tk/login',           // Suspicious TLD + typosquatting
        'http://192.168.1.1/banking',              // IP address + banking keyword
        'https://verify-account-amazon-security-update-urgent.com',  // Excessive subdomains + keywords
        'http://microsoft-support@malicious.com'   // @ symbol obfuscation
    ]
};

/**
 * Test Pattern Detection (No API keys needed)
 */
async function testPatternDetection() {
    console.log('\n=== TESTING PATTERN DETECTION ===\n');

    // Test suspicious URLs
    for (const url of testUrls.suspicious) {
        const result = analyzeUrl(url);
        console.log(`URL: ${url}`);
        console.log(`Risk Score: ${result.riskScore}/100`);
        console.log(`Risk Level: ${result.riskLevel}`);
        console.log(`Recommendation: ${result.recommendation}`);
        console.log(`Flagged Checks:`,
            Object.entries(result.checks)
                .filter(([_, check]) => check.flagged)
                .map(([name, check]) => `${name} (${check.severity})`)
        );
        console.log('---\n');
    }

    // Test safe URLs
    for (const url of testUrls.safe) {
        const result = analyzeUrl(url);
        console.log(`URL: ${url}`);
        console.log(`Risk Score: ${result.riskScore}/100 - ${result.riskLevel}`);
        console.log('---\n');
    }
}

/**
 * Test Google Safe Browsing API
 * IMPORTANT: Add your API key to google-safe-browsing.js first!
 */
async function testGoogleSafeBrowsing() {
    console.log('\n=== TESTING GOOGLE SAFE BROWSING ===\n');

    // Test with a known malicious URL (example from Google's docs)
    const testUrl = 'http://malware.testing.google.test/testing/malware/';

    try {
        const result = await checkUrl(testUrl);
        console.log(`URL: ${testUrl}`);
        console.log(`Safe: ${result.safe}`);
        if (!result.safe) {
            console.log(`Threat Type: ${result.threatType}`);
            console.log(`Severity: ${result.severity}`);
        }
    } catch (error) {
        console.error('Error:', error.message);
        console.log('\n⚠️ Make sure to add your Google Safe Browsing API key!');
    }
}

/**
 * Test PhishTank API
 * IMPORTANT: Add your API key to phishtank.js first!
 */
async function testPhishTank() {
    console.log('\n=== TESTING PHISHTANK API ===\n');

    // Test with a suspicious-looking URL
    const testUrl = 'http://paypal-secure-login.tk';

    try {
        const result = await checkUrlWithPhishTank(testUrl);
        console.log(`URL: ${testUrl}`);
        console.log(`Is Phishing: ${result.isPhishing}`);
        console.log(`In Database: ${result.inDatabase}`);
        if (result.isPhishing) {
            console.log(`Verified: ${result.verified}`);
            console.log(`Phish ID: ${result.phishId}`);
        }
    } catch (error) {
        console.error('Error:', error.message);
        console.log('\n⚠️ Make sure to add your PhishTank API key!');
        console.log('Or use the offline database method instead.');
    }
}

/**
 * Test PhishTank Offline Database
 * No API key needed!
 */
async function testPhishTankOffline() {
    console.log('\n=== TESTING PHISHTANK OFFLINE ===\n');

    console.log('Downloading PhishTank database...');
    const database = await downloadPhishTankDatabase();
    console.log(`Downloaded ${database.length} known phishing URLs\n`);

    // Test a URL
    const testUrl = 'http://suspicious-site.com';
    const result = await checkUrlOffline(testUrl);

    console.log(`URL: ${testUrl}`);
    console.log(`Is Phishing: ${result.isPhishing}`);
    console.log(`Source: ${result.source}`);
}

/**
 * Test Unified Detector (All methods combined)
 */
async function testUnifiedDetector() {
    console.log('\n=== TESTING UNIFIED DETECTOR ===\n');

    for (const url of testUrls.suspicious.slice(0, 2)) {
        console.log(`Scanning: ${url}`);

        const result = await scanUrl(url, {
            useGoogleSafeBrowsing: false,  // Set to true if you have API key
            usePhishTank: false,            // Set to true if you have API key
            usePatternDetection: true,
            preferOffline: true
        });

        console.log(`Overall Threat: ${result.overallThreat}`);
        console.log(`Severity: ${result.overallSeverity}`);
        console.log(`Recommendations:`, result.recommendations);
        console.log('\nDetailed Results:');
        Object.entries(result.detections).forEach(([service, detection]) => {
            console.log(`  ${service}:`, detection);
        });
        console.log('---\n');
    }
}

/**
 * Run all tests
 */
async function runAllTests() {
    console.log('🚀 SCAM DETECTOR API TESTS\n');
    console.log('='.repeat(50));

    // Pattern detection (no API keys needed)
    await testPatternDetection();

    // Uncomment these after adding API keys:
    // await testGoogleSafeBrowsing();
    // await testPhishTank();

    // Offline PhishTank (no API key needed)
    // await testPhishTankOffline();

    // Unified detector
    await testUnifiedDetector();

    console.log('\n✅ All tests complete!');
}

// Auto-run if in Node.js environment
if (typeof module !== 'undefined' && require.main === module) {
    runAllTests().catch(console.error);
}

// Export for manual testing
if (typeof window !== 'undefined') {
    window.ScamDetectorTests = {
        testPatternDetection,
        testGoogleSafeBrowsing,
        testPhishTank,
        testPhishTankOffline,
        testUnifiedDetector,
        runAllTests
    };

    console.log('💡 Test functions available in window.ScamDetectorTests');
    console.log('   Run window.ScamDetectorTests.runAllTests() to start');
}
