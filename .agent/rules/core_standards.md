# Core Engineering Standards (v6.2)

1. **The 500-Line Limit:** Files > 500 lines are **FORBIDDEN**. Refactor into modules immediately [Source 474].
2. **Test-First Mandate:** You cannot fix a bug without first writing a FAILING test in `tests/regression/`.
3. **Active Recall:** You must run `node scripts/consult.js` to check `BUG_LOG.md` before coding [Source 585].
4. **No Vibe Coding:** Do not code without a spec. Check `docs/architecture.md` first [Source 751].
