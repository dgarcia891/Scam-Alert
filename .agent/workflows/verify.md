---
name: verify
description: Options for verification. Default is FREE (Human). Use --ai for EXPENSIVE (Agent).
---
1. **Analyze Request**
   - If argument contains "--ai":
     echo "💸 STARTING AI BROWSER AGENT (High Token Cost)..."
     echo "Instruction: Launch browser, click through happy path, take screenshot."
     // turbo
   - Else:
     echo "🆓 Launching Standard Verification (Human)..."
     node scripts/visual_audit.js
