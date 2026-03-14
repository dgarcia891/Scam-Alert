# Database Safety & Impact Protocol
Before writing any SQL migration file to `supabase/migrations/`, you MUST generate a Business Impact Report in the chat categorizing the change:
- 🛑 **DESTRUCTIVE:** Deletes data, drops tables, or removes columns.
- ⚠️ **RISKY:** Changes data types or modifies constraints.
- ✅ **SAFE:** Additive only (new tables, new columns, new RLS policies).
