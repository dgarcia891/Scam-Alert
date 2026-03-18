---
name: deploy
description: "Secure Release, Version Bump, Sync Guard, and Post-Deploy Learning"
---
1. Sync Guard (Ghost Repo Protection):
   - Run `git remote -v`.
   - Verify the remote URL matches the expected Lovable/GitHub repository.
   - If the remote is unknown or incorrect, STOP and ask the user before proceeding.
2. Quality Gates:
   - Run `npm test` (or project’s main test command).
   - Run `npm run scan`.
   - Run `npm run drift`.
   - NEVER proceed with a deploy if any of these fail.
3. Lovable Architect Pre-Deploy Check:
   - If this repo is connected to Lovable or depends on Supabase via Lovable:
     - Activate `lovable_architect`.
     - Confirm:
       - Git remote is the correct Lovable-connected GitHub repo.
       - Any DB changes are represented as SQL files in `supabase/migrations/` and documented with Business Impact tags.
       - No forbidden Lovable zones were modified in this changeset.
   - If violations are detected, STOP and report instead of proceeding with deploy.
4. Auto-Version:
   - Run `npm run release -- patch` or `node scripts/release.cjs patch` as configured.
   - Ensure a new version is written to package.json and a git tag is created if possible.
5. Deploy:
   - Commit changes with a clear message.
   - Run `git push origin main` to trigger Lovable bidirectional sync.
   - Confirm `git status` is clean after push.
6. Post-Deploy Learning:
   - Append a short entry to docs/logs/LESSONS_LEARNED.md describing:
     - What was deployed.
     - Any notable risks or surprises.
     - Any quick follow-up ideas.
   - If follow-ups or tech debt are identified, add or update entries in docs/ENHANCEMENTS.md with appropriate IDs, Status, and Priority.
7. Output:
   - Summarize:
     - Version bumped to.
     - Commands run.
     - Any new LESSONS_LEARNED or ENHANCEMENTS entries.
