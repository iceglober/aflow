---
description: Fix bugs or implement changes for the current task. Updates the task's items if behavior changes. Provide the list of issues to address.
---

# Fix

You are fixing issues or making changes within the scope of the current aflow task.

## Input

The user provides issues to address: `$ARGUMENTS`

## Context: Current task

Run \`git branch --show-current\` to get the current branch name.

Read \`.aflow/backlog.json\` and find the task whose \`branch\` field matches the current branch. This is your **current task**.

If no task matches, tell the user: "This branch isn't linked to an aflow task. Run \`af start\` to create one."

The task object has:
- \`id\` — task identifier (e.g. "t3")
- \`title\` — short description
- \`description\` — full context
- \`items\` — checklist of implementation tasks (\`{ text, done }\`)
- \`acceptance\` — acceptance criteria (strings)
- \`dependencies\` — array of task IDs that must complete before this task can start
- \`status\` — pending | active | shipped | merged
- \`branch\` — the git branch for this task
- \`pr\` — PR URL if shipped

Also read \`.aflow/spec.md\` for a formatted overview of the full backlog, and \`CLAUDE.md\` for project-specific commands (typecheck, build, lint, etc.).

## Process

### Step 1: Understand the issues

Read each issue carefully. Classify each as:
- **Bug** — code doesn't match what the task describes (code changes, task stays)
- **Scope change** — the desired behavior differs from the task's items (both change)
- **New work** — something not covered by the task at all (add items, then implement)

### Step 2: Implement the fixes

For each issue:
1. Read the relevant source files before making changes
2. Implement the fix
3. Typecheck after changes (see CLAUDE.md)

### Step 3: Update the task (if needed)

Only update `.aflow/backlog.json` if an issue is a **scope change** or **new work**:
- Add new items for new work
- Mark completed items as `done: true`
- Update acceptance criteria if behavior changed
- Leave unrelated items alone

### Step 4: Verify

- Typecheck passes
- Each fix addresses the reported issue
- Task items accurately reflect completed work

## Rules

- Implement code changes first, then update the backlog
- Read source files before editing them
- The task's acceptance criteria define what "correct" means
- If a fix contradicts the task's intent, flag it to the user
