---
name: fix
description: Two-Strike Repair with Test-First Debugging.
---
1. Recall
   node scripts/consult.cjs
   // turbo

2. Reproduction (Strike 0)
   echo "🧪 Writing failing regression test..."
   npm run test:unit
   // turbo

3. Attempt 1 (Strike 1)
   echo "🛠️ Applying fix..."
   // turbo

4. Verification
   npm run test:unit
   // Instruction: If fails, try Attempt 2. If Attempt 2 fails, STOP.

5. Close Loop
   echo "✅ Fix Verified. Updating Bug Log..."
   // turbo
