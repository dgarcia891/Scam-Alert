---
name: lovable_architect
description: "Lovable-native architecture, Supabase safety, MCP-first analysis, and GitHub sync discipline."
triggers: ["lovable", "supabase", "mcp", "ui", "database", "github", "sync"]
---
# Lovable Architect Skill

## 1. Surfaces & Boundaries
1. **Web Frontend Open:** Full write access to `src/*` (or `web/src/*`) for the Lovable web app. Changes must remain compatible with Lovable’s framework and build tooling.
2. **Forbidden Zones (Do Not Touch):**
   - NEVER edit `src/integrations/supabase/*` (or equivalent auto-generated integration code).
   - NEVER edit Lovable-managed config files unless explicitly requested (e.g., `.lovable/*`, Lovable-specific manifests or metadata).
3. **Extension Awareness (If present):**
   - Treat any `extension/` directory as a separate Chrome extension surface. Do not mix extension concerns into Lovable web components.

## 2. MCP-First Analysis
4. **Project Scan Before Big Moves:**
   - For any non-trivial feature, refactor, or bugfix:
     - Call `lovable-mcp-server` `analyze_project` to understand the current component tree, routes, and data flows.
     - When database changes are involved, call `analyze_database_schema` before proposing a migration.
5. **Architecture-First:**
   - Propose updates to `docs/architecture/architecture.md` and `docs/architecture/DECISIONS.md` before large structural changes (new major flows, complex refactors, or schema changes).

## 3. Supabase & Database Safety
6. **Dead Drop Database (Required Pattern):**
   - You DO NOT run `supabase db push` from this environment.
   - You write timestamped SQL migration files to `supabase/migrations/`.
   - Each migration must:
     - Include comments describing purpose and Business Impact classification (Destructive/Risky/Safe).
     - Be referenced in the chat so the user can apply it through Lovable or their own Supabase workflow.
7. **RLS & Security Awareness:**
   - When changing tables involved in authentication, permissions, or multi-tenant data, explicitly:
     - Inspect existing RLS policies via MCP or schema analysis.
     - Call out any required RLS updates in the plan and migration file comments.
8. **No Inline Secrets:**
   - Never introduce Supabase service role keys or other secrets into `src/*`. Enforce environment-variable usage only.

## 4. GitHub + Lovable Sync Discipline
9. **Git Remote & Branch Safety:**
   - Before proposing deploy steps:
     - Confirm `git remote -v` points to the correct GitHub repo connected to Lovable.
     - Assume `main` (or configured default) is the Lovable sync branch unless specified otherwise.
10. **Deploy Preconditions:**
    - Require `npm test` (or project default), `npm run scan`, and `npm run drift` to pass before recommending `git push origin main`.
    - Never mark a feature “DONE” if tests or checks are failing.
11. **Versioning Awareness:**
    - When a release script exists (e.g., `npm run release`), prefer it over manual version bumps so tags and versions stay aligned with Lovable sync events.

## 5. UI & DX Guidelines
12. **UI Consistency:**
    - Prefer the project’s existing design system and component library instead of ad-hoc UI.
    - Respect responsive breakpoints and dark/light theme handling already used in the project.
13. **Usability for Lovable Previews:**
    - Ensure new flows are reachable from the Lovable preview URL without manual URL hacking.
    - Avoid changes that break Lovable’s visual editor or preview navigation (e.g., unnecessary absolute URLs).

## 6. When to Escalate or Ask
14. **Ambiguous Integration Choices:**
    - If there are multiple viable ways to wire Lovable, Supabase, and GitHub together, STOP and ask the user which pattern they prefer instead of guessing.
15. **Missing Context:**
    - If required Lovable, Supabase, or GitHub configuration files are absent or inconsistent, treat it as a configuration bug and propose a remediation plan rather than proceeding blindly.
