---
description: QA the current diff against the task's acceptance criteria. Use when user says 'test this', 'QA the changes', 'check the diff', 'does this meet the criteria', 'verify the implementation'. Builds a test matrix, traces code paths per scenario, reports PASS/FAIL with file references.
---

# QA

You are performing quality assurance on the current diff for this task.

## Critical Rules

- **Acceptance criteria are your primary test cases.** Every one must be verified.
- **Trace the full code path** — don't assume layers handle errors.
- **Don't test code that didn't change.**
- Think like a user: "What if I click this twice fast?"

## Input

Optional focus area: `$ARGUMENTS`

## Context: Current task

Run \`af state task list --json\` and find the task whose \`branch\` field matches the current branch (\`git branch --show-current\`). This is your **current task**.

If no task matches, this branch isn't linked to an aflow task — operate in ad-hoc mode without state tracking.

If a task is found, run \`af state task show --id <id> --json\` to get full details. The task has:
- \`id\` — task identifier (e.g. "t3")
- \`title\` — short description
- \`description\` — full context
- \`phase\` — understand | design | implement | verify | ship | done | cancelled
- \`spec\` — path to spec file (if exists)
- \`dependencies\` — array of task IDs that must complete before this task can start
- \`branch\` — the git branch for this task
- \`pr\` — PR URL if shipped
- \`qaResult\` — latest QA result (if any)

If the task has a spec, run \`af state spec show --id <id>\` to read it.

Also read \`CLAUDE.md\` for project-specific commands (typecheck, build, lint, etc.).

**State mutations:** Use \`af state\` commands for all changes:
- \`af state task update --id <id> --field value\` — update metadata
- \`af state task transition --id <id> --phase <phase>\` — advance phase
- \`af state spec set --id <id> --file <path>\` — save spec content
- \`af state qa --id <id> --status pass|fail --summary "..."\` — record QA result

## Step 1: Understand the task

Read the current task's `acceptance` criteria — these are your primary test cases. Also read the `items` array to understand what was implemented.

## Step 2: Scope the diff

```bash
git diff main...HEAD --stat
```

Read every changed file. Classify each:
- **UI change** — renders something the user sees
- **API change** — affects data the UI consumes
- **Schema change** — affects what's stored
- **Config change** — affects system behavior

Ignore: refactors with no user-visible effect.

## Step 3: Build the test matrix

For each acceptance criterion, plus general scenarios:

| Scenario | Source | Risk |
|----------|--------|------|
| {acceptance criterion} | Task | High |
| Happy path | General | Low |
| Empty state — no data, first use | General | Medium |
| Error state — API fails, bad input | General | High |
| Boundary — very long text, many items, zero items | General | Medium |
| Concurrency — rapid clicks, duplicates | General | High |

Only include scenarios relevant to the changes.

## Step 4: Walk through each scenario

For each scenario:
1. **Describe the user action**
2. **Trace the code path** — component → API → database → response → render
3. **Check each layer:** loading states, input validation, error handling, recovery, state consistency
4. **Verdict:** PASS or FAIL with file:line reference

## Step 5: Check task items

Compare task items from `af state` against the actual implementation:
- Items marked done but code doesn't fully implement them?
- Code that completes items not yet marked done?

Flag mismatches.

## Step 6: Report

```
## QA Report

**Task:** {id}: {title}
**Diff:** {N} files changed
**Scenarios tested:** {count}
**Passed:** {count}
**Failed:** {count}

### Acceptance Criteria

| Criterion | Verdict | Notes |
|-----------|---------|-------|
| {criterion} | PASS/FAIL | {detail} |

### Failures

| # | Scenario | Gap | Severity | File |
|---|----------|-----|----------|------|
| 1 | {scenario} | {what's missing} | {severity} | {file:line} |

### Task Item Sync
- {mismatches between items and implementation}
```

## Step 7: Browser testing (if UI changes)

If the diff includes UI changes and the \`/browser\` skill is available, use it to verify visually:
1. Navigate to the affected page
2. Take a snapshot to confirm the UI renders correctly
3. Walk through the key user flows (click, type, submit)
4. Take a screenshot for the QA report

## Step 8: Fix (if asked)

If the user says "fix" or failures are critical:
- Fix each gap, typecheck after
- Mark any newly completed items via `af state task update --id <id> --items '<json>'`

