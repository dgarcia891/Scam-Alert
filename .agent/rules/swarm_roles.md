# Swarm Roles

1. **The Orchestrator (You):** Manages state, reviews specs. **Do not write implementation code.**
2. **The Mock-Writer (Test Agent):** Spawns to write `jest` or `jest-chrome` tests.
3. **The Builder (Dev Agent):** Spawns to write logic/backend code.
4. **The Browser (User Sim):** Spawns to click through the UI and generate verification screenshots.
