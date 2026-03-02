# Hydra Guard

## 🏗️ Project Structure

```
Hydra Guard/
├── dist/                             # 🚀 LOAD THIS FOLDER IN CHROME
│   ├── manifest.json
│   ├── popup/
│   └── src/
├── src/                              # Source code (React + Logic)
├── vite.config.js                    # Build configuration
└── package.json
```

## 🚀 Quick Start

### 1. Install & Build

```bash
npm install
npm run build
```

### 2. Load in Chrome (IMPORTANT)

1. Open `chrome://extensions/`
2. Enable "Developer mode"
3. Click **Load unpacked**
4. ⚠️ **Select the `dist/` folder** (NOT the root folder!)
   - Selecting the root folder will cause "Could not load options page" errors.

## 📜 Scripts

- `npm run build`: Compiles React UI and copies core scripts to `dist/`
- `npm test`: Runs unit tests
