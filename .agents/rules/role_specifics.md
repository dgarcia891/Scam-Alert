# Context-Specific Rules

## IF CHROME EXTENSION

1. **Manifest V3 Only:** Use `background.service_worker`. Background pages are BANNED.
2. **State:** Use `chrome.storage.local`. No global vars in background scripts.
3. **NAS Sync:** Deployment must sync to NAS via `/deploy`.

## IF LOVABLE/SUPABASE

1. **Proxy Mode:** You are **READ-ONLY** on UI (`src/components`). Generate prompts for Lovable instead.
2. **Supabase Kill-Switch:** You are **FORBIDDEN** from running `db reset` or `db push`. Write migration files only.
3. **Impact Report:** Before any SQL generation, output a Business Impact Report (Safe/Destructive).
