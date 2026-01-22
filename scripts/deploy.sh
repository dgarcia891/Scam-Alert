#!/bin/bash
# Usage: ./deploy.sh [NAS_PATH]
NAS_PATH="${1:-/Volumes/Projects/Extensions/Latest/}"
if [ -f "manifest.json" ]; then
    echo "🚀 Chrome Extension detected. Syncing to Gold Master at $NAS_PATH..."
    rsync -avz --delete --exclude='.git' --exclude='node_modules' dist/ "$NAS_PATH"
else
    echo "ℹ️ Web App detected. Skipping NAS sync (Vercel/Netlify handles deployment)."
fi
