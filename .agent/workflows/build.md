---
name: build
description: Spawns Swarm (Test + Code) based on Spec.
---
1. Architecture Load
   cat docs/architecture.md
   // turbo

2. Swarm Init
   echo "🚀 Spawning Mock-Writer (tests/unit) and Builder (src/)..."
   // turbo

3. Parallel Execution
   echo "Writing tests to tests/unit/ (using jest-chrome)..." 
   echo "Writing code to src/..."
   // turbo

4. Verification
   npm run test:unit
   // turbo
