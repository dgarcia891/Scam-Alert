# Security & Database Clamps
1. **Negative Security:** No `rm -rf`, `eval()`, or absolute paths.
2. **Logic Gap Validator:** When modifying DB schemas, you MUST cross-reference and update corresponding Edge Functions.
3. **Secret Scanner:** Block any commit containing `SUPABASE_SERVICE_ROLE_KEY` in the `src/` directory.
