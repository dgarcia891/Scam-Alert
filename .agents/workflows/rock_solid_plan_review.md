---
name: rock_solid_plan_review
description: "Iteratively review a plan with multiple independent virtual agents (QA, Implementer, Architect, Domain Expert) until all major risks are addressed."
---

# Workflow: rock_solid_plan_review

TRIGGER:
- When I say: “Run rock_solid_plan_review on X” (where X is a plan, spec, design doc, roadmap, implementation plan, test plan, etc.)
- Treat X as the current PLAN_ARTIFACT.

GOAL:
- Iteratively review PLAN_ARTIFACT with multiple independent agents until:
  - No Critical/High issues remain.
  - All major angles are covered (risk, implementation, architecture, domain).
  - You are ≥99% confident the plan is robust, coherent, and executable with minimal surprises.

AGENTS TO SPAWN (PARALLEL, INDEPENDENT):

1) QA / RISK ANALYST
   - Role: Senior QA + risk engineer.
   - Focus:
     - Failure modes, edge cases, “unknown unknowns”.
     - Unhandled error states (bad inputs, upstream failure, timeouts, partial completion, rollback issues).
     - Blind spots in tests, monitoring, and validation.
   - Output: Prioritized issue list (Critical/High/Medium/Low) + proposed tests/validations.

2) IMPLEMENTER / BUILDER
   - Role: Senior implementer for this type of plan.
   - Focus:
     - Feasibility, hidden complexity, resource constraints, operational bottlenecks.
     - Missing details that will block execution (ownership, pre-reqs, interfaces, success criteria).
   - Output: Execution-focused critique + missing pieces + concrete implementation recommendations.

3) ARCHITECT / SYSTEMS THINKER
   - Role: Senior architect.
   - Focus:
     - Holistic design, coupling, single points of failure, brittle integrations.
     - Scalability, robustness, long-term maintainability and org impact.
   - Output: Architectural risks, structural concerns, and strategic recommendations.

4) DOMAIN SPECIALIST (OPTIONAL)
   - Role: Deep expert in the domain of PLAN_ARTIFACT (legal, security, data, product, UX, ops, etc.).
   - Focus:
     - Domain-specific standards, compliance, risk, user impact.
   - Output: Domain-specific risks, constraints, and required mitigations.

ORCHESTRATOR LOOP:

STEP 1 — COLLECT & SYNTHESIZE
- Collect all agent reports (independent; they do NOT see each other’s outputs).
- Merge into a MASTER_ISSUE_LIST:
  - Severity: Critical, High, Medium, Low.
  - Source: QA/Risk, Implementer, Architect, Domain.

STEP 2 — UPDATE THE PLAN
- For every Critical and High issue:
  - Decide: plan change, execution guideline, test/monitoring item, or explicit assumption.
  - Update PLAN_ARTIFACT or produce an UPDATED_PLAN that concretely addresses the issue.

STEP 3 — HANDLE DISAGREEMENTS
- When agents disagree:
  - Surface the conflict explicitly.
  - Summarize options + trade-offs.
  - If high-impact or unclear, mark as REQUIRES HUMAN APPROVAL and do not “auto-resolve”.

STEP 4 — HOLISTIC CHECK
- Ensure fixes in one area didn’t create new unresolved risks elsewhere.
- Confirm QA, Implementer, Architect, and Domain concerns are all represented.
- Document accepted trade-offs and why.

STEP 5 — RE-RUN AGENTS
- Re-run ALL agents on UPDATED_PLAN with instructions to:
  - Verify previous issues are actually resolved.
  - Look for second-order/new issues caused by the changes.
  - Explore at least one new angle each iteration (different environments/users/timelines/failure chains).

STEP 6 — CONVERGENCE CRITERIA
- Repeat Steps 1–5 until:
  - No unresolved Critical/High issues remain.
  - Medium issues are resolved or explicitly accepted with rationale.
  - All agents independently say:
    - The plan is robust from their perspective.
    - No major blind spots remain.
    - Remaining risks (if any) are explicitly documented and acceptable.
  - You (the orchestrator) judge confidence ≥99% that the plan is solid and coherent.

STEP 7 — PARANOID PASS
- One final pass where each agent explicitly tries to break the plan:
  - QA/Risk: worst-case & adversarial scenarios.
  - Implementer: worst-case execution realities.
  - Architect: long-term/systemic “black swan” risks.
  - Domain: worst-case domain failures (regulatory, safety, reputational, etc.).
- If any new Critical/High issues appear, go back to STEP 1.

STEP 8 — EXPLAINABILITY, HIL, AND RECOVERY
- Produce:
  - DECISION_LOG: why major decisions and trade-offs were made, which risks were accepted and why.
  - GO_NO_GO_SUMMARY: 1-page plain-language summary for human review (especially if high-risk).
  - RECOVERY_PLAN: how to detect trouble (signals, metrics, alerts), how to roll back/contain issues, and minimum monitoring required.

FINAL OUTPUT:
- FINAL_PLAN (updated plan).
- DECISION_LOG.
- KNOWN_RISKS (explicit, accepted risks with rationale).
- TEST_AND_MONITORING_STRATEGY.
- IMPLEMENTATION_GUIDELINES.
- ARCHITECTURAL_GUARDRAILS.
- DOMAIN_CONSTRAINTS.
- GO_NO_GO_SUMMARY for human sign-off when appropriate.
