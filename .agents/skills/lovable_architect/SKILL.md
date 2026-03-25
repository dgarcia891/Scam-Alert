---
name: lovable_architect
description: "Lovable-native architecture, Supabase safety, MCP-first analysis, and GitHub sync discipline."
triggers: ["lovable", "supabase", "mcp", "ui", "database", "github", "sync"]
---
# Lovable Architect Skill

## 1. Surfaces & Boundaries

1. **Editable app surface**
   - Primary editable surface is `src/*` (or `web/src/*`) for the Lovable web app.
   - Changes must stay compatible with the existing framework and Lovable tooling.

2. **Forbidden zones**
   - Do NOT edit generated integration code such as `src/integrations/supabase/*` or equivalent Supabase client code.
   - Do NOT edit Lovable-managed config/metadata under `.lovable/*` unless the user explicitly asks.
   - Treat clearly generated folders as read-only unless told otherwise.

3. **Architecture docs**
   - When present, treat `docs/architecture/architecture.md` and `docs/architecture/DECISIONS.md` as canonical for structural decisions.
   - Propose updates for major new flows, big refactors, or schema changes.

## 2. MCP-First Analysis

4. **Project scan**
   - For any non-trivial feature, refactor, or bugfix:
     - Use MCP project/codebase analysis tools (search, code graph, etc.) to understand routes, components, and data flows before editing.

5. **Schema awareness**
   - When DB changes are involved:
     - Use any available schema/DB MCP to understand tables, relations, and constraints.
     - Identify exactly which tables/columns will be impacted.

## 3. Supabase & Database Safety

6. **Dead-drop migrations**
   - Never apply schema changes directly from the agent runtime.
   - Represent all schema changes as timestamped SQL migration files in `supabase/migrations/`.
   - Each migration MUST:
     - Include comments describing purpose.
     - Include a Business Impact label: Destructive / Risky / Safe.
     - Be referenced in summaries so a human or CI can apply it.

7. **RLS & auth**
   - For tables tied to auth, RLS, or tenant separation:
     - Explicitly call out impacted policies.
     - Propose any required RLS updates or review steps in comments and plan.

8. **Secrets**
   - Never hard-code Supabase keys or other secrets in source files.
   - Use environment variables and existing config patterns only.

## 4. GitHub + Lovable Sync Discipline

9. **Repo & branch**
   - Assume this repo is connected to a Lovable project unless the user says otherwise.
   - Assume `main` (or configured default) is the Lovable sync branch.

10. **Before recommending push**
    - Require tests and checks (e.g., `npm test`, `npm run lint`, `npm run build` or equivalent) to be run or explicitly planned.
    - Ensure DB changes are covered by migrations.

11. **Release flow**
    - Prefer existing release/deploy scripts over hand-rolled commands so tags/versions line up with CI and Lovable.

## 5. UI & DX Guidelines

12. **UI consistency**
    - Prefer existing components/design system over custom ones.
    - Respect existing responsive and dark/light mode patterns.

13. **Lovable previews**
    - Ensure new flows are reachable through normal navigation paths so Lovable’s modes can exercise them.
    - Avoid changes that silently break preview or agent behavior.

## 6. Escalation

14. **Config ambiguity**
    - If Lovable, Supabase, or GitHub config looks missing/inconsistent:
      - Pause implementation.
      - Describe the problem and propose a remediation path instead of guessing.

15. **Multiple viable designs**
    - When several architectures are plausible:
      - Present 2–3 concise options with pros/cons.
      - Ask the user to choose instead of silently picking one.
