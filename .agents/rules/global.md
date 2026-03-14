# Core Standards
1. **Critical Thinking Gate:** Before execution, validate assumptions. Pause and ask if uncertainty > 70%.
2. **Two-Strike Rule:** If a bug fix fails twice, STOP. Spawn a Research Agent.
3. **500-Line Limit:** Refactor any file >500 lines before editing.
4. **Anti-Hallucination:** Never guess an API. Use the Browser Agent to read official docs first.
5. **The Push Catch:** You cannot mark a feature as COMPLETE until `git status` is clean and `git push origin main` has been successfully executed to trigger Lovable sync.
6. **YAML Parser Safety:** You are FORBIDDEN from using single quotes (`'`) inside the `description:` field of any `.agents/workflows/*.md` file. It breaks the IDE parser. Use double quotes (`"`) only.
