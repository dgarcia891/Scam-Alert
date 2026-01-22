# Scam Alert - Developer Guide

## 🏗️ Project Structure

```
Scam Alert/
├── ANTIGRAVITY_v5.2_CHROME_ACTIVE    # Project beacon
├── manifest.json                      # MV3 manifest
├── package.json                       # Dependencies & scripts
│
├── src/
│   ├── background/
│   │   └── service-worker.js         # Main background script (entry point)
│   ├── content/
│   │   └── content-main.js           # Content script (injected into pages)
│   ├── popup/
│   │   ├── popup.html                # TODO: Extension popup UI
│   │   └── popup.js                  # TODO: Popup logic
│   ├── options/
│   │   ├── options.html              # TODO: Settings page
│   │   └── options.js                # TODO: Settings logic
│   └── lib/
│       ├── storage.js                # Chrome storage wrapper
│       ├── messaging.js              # Inter-component communication
│       ├── detector.js               # Unified detection orchestrator
│       ├── google-safe-browsing.js   # Google API integration
│       ├── phishtank.js              # PhishTank integration
│       └── pattern-analyzer.js       # Heuristic detection
│
├── tests/
│   ├── setup.js                      # Jest configuration
│   ├── unit/
│   │   └── storage.test.js           # Example unit tests
│   └── integration/                  # TODO: Integration tests
│
├── build/
│   ├── build.js                      # Build script
│   └── sync-nas.js                   # NAS deployment
│
├── dist/                             # Built extension (generated)
└── docs/
    └── PRD.md                        # Product requirements
```

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure API Keys

Edit the following files and add your API keys:

```javascript
// src/lib/google-safe-browsing.js
const SAFE_BROWSING_API_KEY = 'YOUR_GOOGLE_KEY';

// src/lib/phishtank.js
const PHISHTANK_API_KEY = 'YOUR_PHISHTANK_KEY';
```

### 3. Build Extension

```bash
npm run build
```

This creates a `dist/` directory with the bundled extension.

### 4. Load in Chrome

1. Open `chrome://extensions/`
2. Enable "Developer mode" (top right)
3. Click "Load unpacked"
4. Select the `dist/` folder

### 5. Test

```bash
npm test
```

## 📜 Available Scripts

- `npm test` - Run unit tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Generate coverage report
- `npm run build` - Build extension to dist/
- `npm run deploy` - Build and sync to NAS
- `npm run lint` - Lint code
- `npm run lint:fix` - Auto-fix lint issues

## 🧪 Testing

### Unit Tests

Uses `jest` + `jest-chrome` to mock Chrome APIs.

Example:

```javascript
import { getSettings } from '../../src/lib/storage';

test('getSettings returns defaults', async () => {
  chrome.storage.local.get.mockResolvedValue({});
  const settings = await getSettings();
  expect(settings.scanningEnabled).toBe(true);
});
```

Run tests:

```bash
npm test
```

### Manual Testing

1. Load extension in Chrome (see Quick Start #4)
2. Open DevTools:
   - **Service Worker**: chrome://extensions → "Inspect views: background page"
   - **Popup**: Right-click extension icon → "Inspect popup"
   - **Content Script**: F12 on any webpage
3. Check console for `[Scam Alert]` logs
4. Visit suspicious URLs to trigger warnings

## 🏛️ Architecture Principles

### 1. Service Workers Are Ephemeral

**Problem**: Service workers can be terminated at any time.

**Solution**: ALL state goes in `chrome.storage.local`:

```javascript
// ❌ BAD - Lost when service worker terminates
let userSettings = { scanning: true };

// ✅ GOOD - Persisted in storage
import { getSettings, updateSettings } from './lib/storage.js';
const settings = await getSettings();
```

### 2. Async Message Handling

**Problem**: "Channel closed" errors if `lastError` not handled.

**Solution**: Always use the messaging wrapper:

```javascript
// ❌ BAD - No error handling
chrome.runtime.sendMessage({ type: 'scan' });

// ✅ GOOD - Error handling built-in
import { sendMessage, createMessage } from './lib/messaging.js';
await sendMessage(createMessage('scan', { url }));
```

### 3. 500-Line Limit

**Rule**: No file exceeds 500 lines.

**Enforcement**: Manual code review. If approaching limit, refactor into `src/lib/`.

### 4. ES Modules

MV3 supports ES modules in service workers:

```javascript
// manifest.json
{
  "background": {
    "service_worker": "src/background/service-worker.js",
    "type": "module"  // ← Enables imports
  }
}

// service-worker.js
import { getSettings } from '../lib/storage.js';
```

## 📡 NAS Deployment

### Setup

1. Mount NAS in Finder:
   - Go → Connect to Server
   - `smb://192.168.1.88/Projects`

2. Deploy:

```bash
npm run deploy
```

This runs:

1. `npm run build` - Build extension
2. `rsync` to `/Volumes/Projects/Scam Alert/Latest/`

Team members can load extension from NAS for testing.

## 🐛 Debugging

### Service Worker Console

```bash
# Chrome extensions page
chrome://extensions/

# Click "Inspect views: background page"
# Console opens with service worker logs
```

Look for:

```
[Scam Alert] Service worker initializing...
[Scam Alert] Scanning: https://example.com
[Scam Alert] THREAT DETECTED: ...
```

### Content Script Console

Open DevTools (F12) on any webpage:

```javascript
// You'll see:
[Scam Alert Content] Script loaded
[Scam Alert Content] Monitoring active
```

### Common Issues

**"Service worker not found"**

- Check `manifest.json` path is correct
- Ensure `type: "module"` is set
- Rebuild with `npm run build`

**"Cannot use import statement"**

- Add `"type": "module"` to manifest
- Use `.js` extension in imports

**"Channel closed" errors**

- Use `sendMessage()` from `messaging.js`
- Always handle `chrome.runtime.lastError`

**PhishTank database not loading**

- Check network in DevTools
- Verify `downloadPhishTankDatabase()` is called on install
- Database updates hourly via `chrome.alarms`

## 📝 Code Style

### Module Exports

```javascript
// Use named exports
export async function getSettings() { }
export async function updateSettings(updates) { }

// Not default exports
export default { getSettings, updateSettings }; // ❌
```

### JSDoc Comments

```javascript
/**
 * Get user settings from storage
 * @returns {Promise<Object>} User settings object
 */
export async function getSettings() {
  // ...
}
```

### Error Handling

```javascript
try {
  const result = await scanUrl(url);
  // handle result
} catch (error) {
  console.error('[Component] Operation failed:', error);
  // fallback logic
}
```

## 🔄 Development Workflow

1. **Make changes** to `src/` files
2. **Run tests** (`npm test`)
3. **Build** (`npm run build`)
4. **Reload extension** in Chrome:
   - Go to `chrome://extensions/`
   - Click reload icon on Scam Alert
5. **Test manually** by visiting URLs
6. **Deploy to NAS** (`npm run deploy`) when ready for team testing

## 📚 Resources

- [Chrome Extension MV3 Docs](https://developer.chrome.com/docs/extensions/mv3/)
- [Service Workers Guide](https://developer.chrome.com/docs/extensions/mv3/service_workers/)
- [Google Safe Browsing API](https://developers.google.com/safe-browsing/v4)
- [PhishTank API Docs](https://www.phishtank.com/api_info.php)

## 🎯 Next Steps

1. **Build Popup UI** (`src/popup/popup.html`)
   - Show current page safety status
   - Quick access to settings
   - Recent threats blocked

2. **Build Options Page** (`src/options/options.html`)
   - Detailed settings
   - Whitelist management
   - Statistics dashboard

3. **Add More Tests**
   - Pattern analyzer tests
   - Message handling tests
   - Integration tests

4. **Create Icons**
   - Need 16x16, 32x32, 48x48, 128x128 PNG icons
   - Place in `icons/` directory

5. **Browser Agent Testing**
   - Use browser automation to physically test UI
   - Generate screenshots for documentation

---

**Questions?** Check `docs/PRD.md` for product requirements or the main `README.md` for user-facing docs.
