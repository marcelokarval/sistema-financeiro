# Cron QA Review — webDevReview Prompt

Purpose: Agnostic prompt for creating a webDevReview cron job that follows project-specific rules defined in the research documents. Works with any project that has the three mandatory context files.

## Required Files (must exist in the project)

- `/home/z/my-project/worklog.md`
- `/home/z/my-project/docs/research/ARCHITECTURE_CONVENTIONS.md`
- `/home/z/my-project/docs/research/POLISHING_RULES.md`

## Cron Configuration

```json
{
  "action": "create",
  "job": {
    "name": "QA - Polishing & Architecture Review",
    "schedule": {
      "kind": "fixed_rate",
      "expr": "900"
    },
    "payload": {
      "kind": "webDevReview",
      "message": "First, assess the current project status, perform necessary testing and QA using agent-browser, then independently select the most appropriate work focus for this round (fix bugs or propose new requirements) and continue development.\n\nRequirements:\n1. At the start of the task, review /home/z/my-project/worklog.md to understand the actual project progress, and break down detailed current todos.\n2. First assess the current project status and perform necessary testing and QA via agent-browser (use `agent-browser --help` to view all available commands). Prioritize fixes if there are bugs, errors, test failures, build failures, runtime errors, or clear QA issues.\n3. If the current phase is relatively stable, independently propose additional feasible new requirements based on the task description, and continue advancing reasonable next-step development tasks.\n4. [Mandatory] Improve styling with more details!!!\n5. [Mandatory] Add more features and functionality!!!\n6. After completing a phase of work, update or create the handover document /home/z/my-project/worklog.md (updates are also recommended during work to avoid progress loss) for seamless continuation of development in the next phase.\n7. After project completion, be sure to record work details in /home/z/my-project/worklog.md.\n\nIt is recommended that the handover document /home/z/my-project/worklog.md includes three sections:\n- Current project status description/assessment\n- Current goals/completed modifications/verification results\n- Unresolved issues or risks, and priority recommendations for the next phase\n\n=== MANDATORY CONTEXT DOCS (READ BEFORE ANY CODE CHANGE) ===\n\n/home/z/my-project/worklog.md\n/home/z/my-project/docs/research/ARCHITECTURE_CONVENTIONS.md\n/home/z/my-project/docs/research/POLISHING_RULES.md\n\nRead all three documents in full before making any code change. They contain the complete rules, detected violations, shared component names, utility locations, file paths, priorities, and conventions for THIS project. Do NOT assume any rule, path, or component name — always verify against the documents. Every code change you make MUST comply with ALL applicable rules found in them.\n\n=== REVIEW PRIORITY PROTOCOL ===\n\nWhen choosing work items, follow this order:\n1. Fix runtime errors, build failures, or visible bugs first (QA via agent-browser)\n2. Resolve the highest priority violations listed in the POLISHING_RULES.md audit sections\n3. Run the full checklist from POLISHING_RULES.md against any changed or new component\n4. Verify compliance with ARCHITECTURE_CONVENTIONS.md for any new code\n5. Use the decision matrix from POLISHING_RULES.md when deciding whether to extract a pattern\n6. If everything is stable, propose and implement new features or styling improvements\n\n=== WORKLOG UPDATE RULE ===\n\nEvery work session MUST update /home/z/my-project/worklog.md with:\n- What was worked on\n- What was completed\n- What was deferred and why\n- Recommended next priorities based on the violation lists found in the context docs"
    },
    "params": {
      "priority": 10
    }
  }
}
```

## Schedule Reference

| Type | `kind` | `expr` | Meaning |
|---|---|---|---|
| Fixed rate | `fixed_rate` | `900` | Every 15 minutes |
| Fixed rate | `fixed_rate` | `3600` | Every 1 hour |
| Cron | `cron` | `0 0 9 * * ?` | Every day at 9:00 |
| Cron | `cron` | `0 0 */2 * * ?` | Every 2 hours |
| One-time | `one_time` | `1752549600000` | Once at specific epoch millis |

## Priority Reference

| Value | Level |
|---|---|
| 1 | Low |
| 5 | Medium (default) |
| 10 | High |
| 15 | Very High |
