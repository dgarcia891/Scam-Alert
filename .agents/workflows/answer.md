---
name: answer
description: "Safe Q&A mode with no file or repo changes"
---
1. Scope:
   - Treat this workflow as a pure question-and-answer mode.
   - You MUST NOT:
     - Edit, create, or delete any files.
     - Run any terminal or git commands.
     - Trigger other workflows that modify the repo.
2. Behavior:
   - Read the user’s question.
   - Use your existing context (code, docs, skills, MCP) to reason about the answer.
   - You MAY read files and use MCP analysis tools in read-only ways.
3. Response:
   - Provide a clear, concise answer in the chat.
   - If you are uncertain, say so explicitly and, if helpful, suggest what additional information would be needed.
4. Termination:
   - Do not propose implementation steps, code changes, or deployment commands in this mode.
   - End the workflow after answering the question.
