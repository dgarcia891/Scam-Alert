---
description: Two-Strike Repair with Test-First Debugging.
---
// turbo

1. Context Scan
   node scripts/consult.cjs

// turbo

2. Reproduction (Strike 0)
   echo "🧪 Writing failing regression test if needed..."
   npm run test:unit

// turbo

3. Attempt 1 (Strike 1)
   echo "🛠️ Applying fix..."

// turbo

4. Verification
   npm run test:unit
   // Instruction: If fails, try Attempt 2. If Attempt 2 fails, STOP.

// turbo

5. Close Loop
   echo "✅ Fix Verified. Updating Bug Log..."
