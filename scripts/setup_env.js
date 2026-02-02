const fs = require('fs');
const { execSync } = require('child_process');

console.log("🔧 CONFIGURING ENVIRONMENT...");

// 1. Initialize package.json if missing
if (!fs.existsSync('package.json')) {
    console.log("📦 Creating package.json...");
    execSync('npm init -y', { stdio: 'ignore' });
}

// 2. Inject Dependencies (CRITICAL FOR TURNKEY OPERATION)
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
pkg.scripts = {
    ...pkg.scripts,
    "build": "node scripts/build.js",
    "release": "node scripts/release.js",
    "test:unit": "jest tests/unit --passWithNoTests",
    "scan": "node scripts/security_scan.js",
    "drift": "node scripts/drift_check.js"
};

// Ensure devDependencies exist
pkg.devDependencies = pkg.devDependencies || {};
const requiredDeps = {
    "jest": "^29.0.0",
    "jest-chrome": "^0.8.0",
    "eslint": "^8.0.0"
};

Object.entries(requiredDeps).forEach(([dep, ver]) => {
    if (!pkg.devDependencies[dep]) {
        pkg.devDependencies[dep] = ver;
        console.log(` + Added ${dep}`);
    }
});

fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));
console.log("✅ package.json ready.");
