---
description: Fully Autonomous Development Loop (Plan -> Audit -> Build -> Verify -> Fix)
---

# Auto-Dev Full Lifecycle Orchestrator

This workflow activates AntiGravity's fully autonomous mode, allowing it to bypass human-in-the-loop gates and execute the entire software development lifecycle for a given feature or bugfix.

## 1. Scope & Rules
- Treat this workflow as an override to Global Rule 4 ("Default to read/plan/explain before write/modify/execute").
- You **MUST NOT** pause to ask the user for permission to move between phases (planning -> auditing -> building -> testing -> fixing).
- You **MUST** complete the entire lifecycle before calling `notify_user` to exit the task, unless you hit a hard, unresolvable blocker or the maximum fix iteration limit.

## 2. Autonomous Loop Execution
When this workflow is invoked, automatically execute the following phases in order:

### Phase A: Plan & Audit
1. Gather context using standard tools (`list_dir`, `view_file`, `grep_search`).
2. Draft an implementation plan (update `implementation_plan.md`).
3. **Mandatory Gate:** Act as your own critic. Generate or update a `critic_report.md` artifact to audit your plan against `BUG_LOG.md` and `LESSONS_LEARNED.md`.
4. If the critic report identifies flaws, adjust the implementation plan immediately. Do not ask for user permission.

### Phase B: Build
1. Update `task.md` with the actionable checklist.
2. Implement regression/unit tests for the planned changes (TDD approach).
3. Execute the implementation code changes across the codebase.

### Phase C: Verify & Fix (The Loop)
1. Run the tests.
2. If tests fail, linting errors occur, or the build breaks, you **MUST** automatically enter a fix loop.
3. Use the `/fix` pattern to analyze errors and patch the code.
4. **Iteration Limit:** You may loop through fixing and verifying up to **3 consecutive times**.
5. If issues persist after 3 attempts, halt the loop and `notify_user` with a summary of the failure.

### Phase D: Finalize
1. Update `walkthrough.md` with proof of the completed work.
2. If tests pass and the feature is complete, call `notify_user` to present the final result and ask the user to manually verify or deploy.

## 3. Termination
- End the workflow only when Phase D is complete or the Phase C iteration limit is reached.
