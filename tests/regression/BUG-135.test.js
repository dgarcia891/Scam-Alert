/**
 * BUG-135 Regression Test:
 * ReferenceError: document is not defined in serviceWorker.js
 * 
 * Root cause: Vite's modulepreload polyfill injects `document.getElementsByTagName`,
 * `document.querySelector`, and `document.createElement` calls into the service worker
 * bundle when dynamic `import()` is used (for threat-telemetry.js and icon-manager.js).
 * 
 * This test verifies that the built service worker bundle does NOT contain
 * the Vite modulepreload polyfill that references `document`.
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import assert from 'assert';

const __dirname = dirname(fileURLToPath(import.meta.url));
const bundlePath = resolve(__dirname, '../../extension/dist/assets/serviceWorker.js');

console.log('Running BUG-135 regression test...');

let bundleContent;
try {
    bundleContent = readFileSync(bundlePath, 'utf-8');
} catch (e) {
    console.error('Could not read built bundle. Run `npm run build` first.');
    process.exit(1);
}

// Check for Vite's modulepreload polyfill signature
const hasModulePreloadPolyfill = bundleContent.includes('document.getElementsByTagName("link")');
const hasDocumentCreateElement = bundleContent.includes('document.createElement("link")');
const hasMetaQuery = bundleContent.includes('document.querySelector("meta[property=csp-nonce]")');

// These document references should NOT exist in a service worker bundle
// (document references inside `func:` arguments to executeScript are acceptable
//  because they run in the tab context, not the SW context)

// Find document references that are NOT inside executeScript func blocks
const modulePreloadPattern = /const\s+\w+\s*=\s*"modulepreload"/;
const hasModulePreloadConst = modulePreloadPattern.test(bundleContent);

if (hasModulePreloadPolyfill || hasDocumentCreateElement || hasMetaQuery || hasModulePreloadConst) {
    console.error('❌ BUG-135 REGRESSION: Vite modulepreload polyfill found in service worker bundle!');
    console.error('  document.getElementsByTagName("link"):', hasModulePreloadPolyfill);
    console.error('  document.createElement("link"):', hasDocumentCreateElement);
    console.error('  document.querySelector("meta[property=csp-nonce]"):', hasMetaQuery);
    console.error('  const = "modulepreload":', hasModulePreloadConst);
    process.exit(1);
} else {
    console.log('✅ BUG-135 regression test passed! No modulepreload polyfill in SW bundle.');
}
