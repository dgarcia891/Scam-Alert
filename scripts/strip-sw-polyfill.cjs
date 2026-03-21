#!/usr/bin/env node
/**
 * BUG-135: Post-build script to strip Vite's modulepreload polyfill
 * from the service worker bundle.
 * 
 * The polyfill uses `document` which crashes in service workers.
 * This script surgically removes it after the build completes.
 */
const fs = require('fs');
const path = require('path');

const swPath = path.resolve(__dirname, '../extension/dist/assets/serviceWorker.js');

if (!fs.existsSync(swPath)) {
    console.log('[strip-polyfill] No service worker bundle found, skipping.');
    process.exit(0);
}

let code = fs.readFileSync(swPath, 'utf-8');

const marker = 'document.getElementsByTagName("link")';
if (!code.includes(marker)) {
    console.log('[strip-polyfill] ✅ No modulepreload polyfill found in SW bundle.');
    process.exit(0);
}

const markerIdx = code.indexOf(marker);

// The polyfill in minified Vite output looks like:
// const ua=(function(){...typeof document..."modulepreload":"preload"})(),
//       da=function(e,t){return new URL(e,t).href},
//       Ce={},
//       Le=function(t,a,s){...document.getElementsByTagName("link")...vite:preloadError...};
//
// All four declarations may be in one `const` statement separated by commas.

// Step 1: Find "typeof document" which starts the detection IIFE  
const typeofDocIdx = code.lastIndexOf('typeof document', markerIdx);
if (typeofDocIdx === -1) {
    console.error('[strip-polyfill] ❌ Could not find typeof document');
    process.exit(1);
}

// Step 2: Walk backwards from "typeof document" to find the `const` keyword
let blockStart = -1;
for (let i = typeofDocIdx; i >= Math.max(0, typeofDocIdx - 200); i--) {
    if (code.substring(i, i + 6) === 'const ') {
        blockStart = i;
        break;
    }
}
if (blockStart === -1) {
    console.error('[strip-polyfill] ❌ Could not find const before typeof document');
    process.exit(1);
}

// Step 3: Find the preload function name by looking for the variable assigned to
// the function that contains the marker. Pattern: VARNAME=function(
let preloadVar = '';
const before = code.substring(Math.max(0, markerIdx - 500), markerIdx);
// Match the last occurrence of: word=function( before the marker
const allFuncAssigns = [...before.matchAll(/(\w+)=function\(/g)];
if (allFuncAssigns.length > 0) {
    preloadVar = allFuncAssigns[allFuncAssigns.length - 1][1];
}
if (!preloadVar) {
    console.error('[strip-polyfill] ❌ Could not find preload function variable name');
    process.exit(1);
}

// Step 4: Find the end of the polyfill block
// After vite:preloadError, the function ends with: ...t().catch(r)})};
const errorIdx = code.indexOf('vite:preloadError', markerIdx);
if (errorIdx === -1) {
    console.error('[strip-polyfill] ❌ Could not find vite:preloadError');
    process.exit(1);
}

// Find the pattern ".catch(X)})" followed by "};" which closes the entire const block
// Or the function might end with just "};"
// Search for the next occurrence of "};async" or "};const" or "};" followed by a statement
let blockEnd = -1;
// Simple approach: find "};" after the error handler
const searchAfter = code.substring(errorIdx, errorIdx + 500);
const endMatch = searchAfter.match(/\.catch\(\w+\)\s*\)\s*\}\s*;/);
if (endMatch) {
    blockEnd = errorIdx + endMatch.index + endMatch[0].length;
} else {
    // Fallback: find the end manually by looking for "};" pattern
    let depth = 0;
    for (let i = errorIdx; i < Math.min(code.length, errorIdx + 500); i++) {
        if (code[i] === '{') depth++;
        else if (code[i] === '}') depth--;
        // Look for "};async" or "};console" etc.
        if (depth < 0 && code[i] === ';') {
            blockEnd = i + 1;
            break;
        }
    }
}

if (blockEnd === -1) {
    console.error('[strip-polyfill] ❌ Could not find end of polyfill block');
    process.exit(1);
}

// Step 5: Replace the entire polyfill block with a stub
const replacement = `const ${preloadVar}=function(e){return e()};`;
const stripped = code.substring(0, blockStart) + replacement + code.substring(blockEnd);

// Verify
if (stripped.includes(marker)) {
    console.error('[strip-polyfill] ❌ Polyfill still present after stripping!');
    console.error('Block was: chars ' + blockStart + ' to ' + blockEnd);
    process.exit(1);
}

fs.writeFileSync(swPath, stripped, 'utf-8');
const saved = code.length - stripped.length;
console.log(`[strip-polyfill] ✅ Stripped modulepreload polyfill (var: ${preloadVar}, saved ${saved} bytes)`);
