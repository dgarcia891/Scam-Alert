---
name: deploy
description: Cost-efficient deployment (Unit Tests + Human Verify).
---
1. **Cost-Free Verification**
   - Run `npm run test:unit` (Local CPU).
   - If tests fail, STOP. (Saves tokens on broken deploys).

2. **Security & Integrity**
   - node scripts/security_scan.js
   - node scripts/detect_mocks.js

3. **Push to Remote**
   - node scripts/release.js patch
   - git push origin main

4. **Human Handoff**
   - echo "✅ Code Pushed."
   - echo "👁️ Opening browser for HUMAN verification (Free)..."
   - node scripts/visual_audit.js
