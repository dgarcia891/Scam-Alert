---
name: lovable_architect
description: "Native Lovable.dev rules, MCP integration, and UI guidelines."
triggers: ["lovable", "supabase", "mcp", "ui", "database"]
---
# Lovable Architect Skill
1. **Frontend Open:** Full write access to `src/*`. Changes sync automatically to Lovable.
2. **Forbidden Zones:** NEVER edit `src/integrations/supabase/*`.
3. **MCP Awareness:** Use `lovable-mcp-server` for `analyze_project` and `analyze_database_schema` before planning.
4. **Dead Drop Database:** You DO NOT run `supabase db push`. You write timestamped SQL files to `supabase/migrations/` and ask the user to apply them via the Lovable UI.
