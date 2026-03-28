/**
 * Embedded skill files for the wtm workflow.
 * These get written to .claude/commands/s/ by `wtm install-skills`.
 *
 * Each skill operates within the context of a wtm task:
 * - .wtm/backlog.json is the source of truth (tasks, items, acceptance criteria)
 * - The current task is identified by matching `git branch --show-current` to a task's `branch` field
 * - .wtm/spec.md is auto-generated from the backlog — read-only context
 * - CLAUDE.md has project-specific commands (typecheck, build, etc.)
 */

const TASK_PREAMBLE = `## Context: Current task

Run \\\`git branch --show-current\\\` to get the current branch name.

Read \\\`.wtm/backlog.json\\\` and find the task whose \\\`branch\\\` field matches the current branch. This is your **current task**.

If no task matches, tell the user: "This branch isn't linked to a wtm task. Run \\\`wtm start-work\\\` to create one."

The task object has:
- \\\`id\\\` — task identifier (e.g. "t3")
- \\\`title\\\` — short description
- \\\`description\\\` — full context
- \\\`items\\\` — checklist of implementation tasks (\\\`{ text, done }\\\`)
- \\\`acceptance\\\` — acceptance criteria (strings)
- \\\`status\\\` — pending | active | shipped | merged
- \\\`branch\\\` — the git branch for this task
- \\\`pr\\\` — PR URL if shipped

Also read \\\`.wtm/spec.md\\\` for a formatted overview of the full backlog, and \\\`CLAUDE.md\\\` for project-specific commands (typecheck, build, lint, etc.).`;

export const SKILLS: Record<string, string> = {
  "think.md": `---
description: Product strategy session before building. Forces you to think through what you're building and why before writing code. Provide a feature idea or problem to explore.
---

# Think

You are a product strategist helping think through a feature before any code is written. Your job is to prevent building the wrong thing.

## Input

The user describes what they want to build: \`$ARGUMENTS\`

${TASK_PREAMBLE}

## Process

### Step 1: Understand the landscape

- Read \`.wtm/spec.md\` for the full backlog — what's pending, active, shipped
- Read \`CLAUDE.md\` to understand the project's architecture
- Skim the relevant source files to understand the current state

### Step 2: Ask forcing questions

Ask these one at a time. Wait for the answer before asking the next. Push back on vague answers.

1. **Who specifically wants this?** Not "users" — a specific person or persona. If you can't name one, stop here.

2. **What are they doing today without it?** There's always a workaround. How painful is it? If the workaround is fine, this can wait.

3. **What's the smallest version that matters?** Not the full vision — the narrowest slice someone would actually use. One screen. One action. One outcome.

4. **What breaks if we build it wrong?** Every feature has a failure mode. Does it corrupt data? Create tech debt? Name the risk.

5. **Does the backlog already cover this?** Check the existing tasks. Is this a new task, a change to an existing one, or already queued?

### Step 3: Challenge the premise

Based on the answers, do ONE of:
- **Validate** — the idea holds up. Move to Step 4.
- **Redirect** — a different approach would solve the same problem better.
- **Defer** — the idea is good but premature. Say when it should happen.
- **Kill** — the idea doesn't serve the product. Explain honestly.

### Step 4: Plan the implementation

If validated, write a concise plan:

\`\`\`markdown
## Feature: {name}

**Problem:** {one sentence}
**Who:** {specific user}
**Smallest version:** {what to build}
**Depends on:** {prerequisites}
**Risk:** {what could go wrong}

### Implementation sketch
1. {schema changes}
2. {API changes}
3. {client changes}
4. {UI changes}

### What this does NOT include
- {explicit scope cuts}
\`\`\`

### Step 5: Update the task

If the current task exists and this planning session refines it:
- Update the task's \`items\` array in \`.wtm/backlog.json\` with the implementation checklist
- Update \`acceptance\` with clear acceptance criteria
- Set the \`design\` field to a brief summary of the plan

If this is a new feature not yet in the backlog, tell the user to add it via \`wtm start-work\`.

## Rules

- Never produce code in this skill. Plans and task updates only.
- Push back on vague answers. "All users" is not an answer.
- Be direct. "This isn't worth building" is a valid output.
- Read the backlog before evaluating — don't duplicate existing work.
`,

  "work.md": `---
description: Implement the current task's items. Reads the task from the backlog, works through unchecked items, checks them off as completed. Provide optional focus area.
---

# Work

You are implementing the current wtm task, working through its checklist items.

## Input

Optional focus or section to work on: \`$ARGUMENTS\`

${TASK_PREAMBLE}

## Process

### Step 1: Scope the work

1. Read the current task's \`items\` array — identify all unchecked items (\`done: false\`)
2. Read the \`acceptance\` criteria for full context on what "done" means
3. Read relevant source files to understand the current state
4. Plan the implementation order: schema → API → client types → UI components

If \`$ARGUMENTS\` specifies a focus area, only work on items matching that scope.

### Step 2: Implement

For each unchecked item:
1. Read relevant existing source files before writing code
2. Implement the feature/change
3. Mark the item as done in \`.wtm/backlog.json\` immediately:
   - Find the task, find the item by text, set \`done: true\`
   - Write the updated backlog back to \`.wtm/backlog.json\`
4. Move to the next item

Work through items in dependency order. If item B depends on item A, complete A first.

### Step 3: Verify

After completing items:
1. Run the project's typecheck command (from CLAUDE.md)
2. Review the acceptance criteria — verify each is met
3. Ensure every completed item is marked done in the backlog
4. Do NOT mark items done that you didn't implement

## Rules

- The task's items are your checklist — work through them
- Mark items done one at a time as you complete them, not all at the end
- If you discover work that has no corresponding item, add a new item to the task's \`items\` array and implement it
- Read source files before editing them
- Use existing patterns in the codebase — match the style of adjacent code
- Do not modify other tasks in the backlog
`,

  "fix.md": `---
description: Fix bugs or implement changes for the current task. Updates the task's items if behavior changes. Provide the list of issues to address.
---

# Fix

You are fixing issues or making changes within the scope of the current wtm task.

## Input

The user provides issues to address: \`$ARGUMENTS\`

${TASK_PREAMBLE}

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

Only update \`.wtm/backlog.json\` if an issue is a **scope change** or **new work**:
- Add new items for new work
- Mark completed items as \`done: true\`
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
`,

  "investigate.md": `---
description: Systematic root-cause debugging. Traces a symptom to its cause before fixing anything. Provide the bug description or error message.
---

# Investigate

You are debugging an issue. **No fixes until root cause is confirmed.**

## Input

The user describes a symptom: \`$ARGUMENTS\`

${TASK_PREAMBLE}

## Phase 1: Gather evidence

- Read the current task for context on what was recently changed
- Read \`.wtm/spec.md\` to understand the broader project state
- Read the error message or symptom description carefully
- If there's a stack trace, identify the exact file and line
- Check recent git history: \`git log --oneline -10 -- <affected-files>\`
- Read the affected source files in full

**Output:** A clear statement of what's happening, where, and since when.

## Phase 2: Form hypothesis

Based on the evidence, identify the most likely cause. Classify it:

| Pattern | Signs |
|---------|-------|
| Null/undefined propagation | "Cannot read property of undefined" |
| Type mismatch | Works in TS but fails at runtime |
| Race condition | Intermittent, timing-dependent |
| State corruption | Partial updates, stale closures |
| Auth/permissions | 401/403, missing auth checks |
| Configuration | Works locally but not in Docker |
| Import/dependency | Module not found, version mismatch |

**Output:** One specific, testable hypothesis.

## Phase 3: Verify hypothesis

**Do not fix yet.** Verify first:

- Read the code at the suspected location
- Trace the data flow: inputs → transforms → output
- If the code doesn't confirm the hypothesis, **abandon it** and form a new one

**3-strike rule:** If three hypotheses fail, ask the user for more context.

**Output:** "Confirmed: {hypothesis} because {evidence}" or "Rejected: {why}, new hypothesis: {next}"

## Phase 4: Fix

Once root cause is confirmed:

1. Make the minimal fix — fewest files, fewest lines
2. Typecheck (see CLAUDE.md)
3. If the fix completes a task item, mark it done in \`.wtm/backlog.json\`

**Blast radius check:** If the fix touches more than 3 files, explain why and ask before proceeding.

## Phase 5: Report

\`\`\`
## Bug Report

**Symptom:** {what the user saw}
**Root cause:** {what actually went wrong}
**Fix:** {file:line — what changed and why}
**Task items updated:** {yes/no}
**Verified:** {how you confirmed the fix}
\`\`\`

## Rules

- Never fix before confirming root cause.
- Read code before theorizing.
- One hypothesis at a time.
- Minimal diff. Don't refactor while debugging.
- If you can't find it, say so.
`,

  "qa.md": `---
description: QA the current diff against the task's acceptance criteria. Walks through each scenario, traces code paths. Provide optional focus area.
---

# QA

You are performing quality assurance on the current diff for this task.

## Input

Optional focus area: \`$ARGUMENTS\`

${TASK_PREAMBLE}

## Step 1: Understand the task

Read the current task's \`acceptance\` criteria — these are your primary test cases. Also read the \`items\` array to understand what was implemented.

## Step 2: Scope the diff

\`\`\`bash
git diff main...HEAD --stat
\`\`\`

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

Compare checked items in the backlog against the actual implementation:
- Items marked done but code doesn't fully implement them?
- Code that completes items not yet marked done?

Flag mismatches.

## Step 6: Report

\`\`\`
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
\`\`\`

## Step 7: Fix (if asked)

If the user says "fix" or failures are critical:
- Fix each gap, typecheck after
- Mark any newly completed items in the backlog

## Rules

- Acceptance criteria are your primary test cases. Every one must be verified.
- Think like a user. "What if I click this twice fast?"
- Trace the full code path — don't assume layers handle errors.
- Don't test code that didn't change.
`,

  "review.md": `---
description: Pre-landing code review for the current task. Analyzes diff for correctness, security, and architecture. Auto-fixes critical issues. Provide optional context.
---

# Review

You are performing a pre-landing code review. This is the gate before shipping.

## Input

Optional context: \`$ARGUMENTS\`

${TASK_PREAMBLE}

## Process

### Step 1: Scope the diff

\`\`\`bash
git diff main...HEAD --stat
git log main..HEAD --oneline
\`\`\`

Read every changed file in full. Understand the diff as a whole.

### Step 2: Typecheck

Run the project's typecheck command (see CLAUDE.md). If it fails, fix before continuing.

### Step 3: Architecture review

Check against the project's patterns (from CLAUDE.md):
- Are imports following established dependency rules?
- Do new API routes have proper auth?
- Is data access properly scoped?
- Are new env vars added to \`.env.example\`?

### Step 4: Security review

For each changed file:
- **Injection:** Raw SQL with user input? \`dangerouslySetInnerHTML\`? Shell exec with user strings?
- **Auth:** Missing auth checks? Cross-user data access? Secrets in client bundle?
- **Input:** Unvalidated request bodies? Unbounded queries?
- **Secrets:** Hardcoded keys? \`.env\` not gitignored?

### Step 5: Correctness review

For each changed file:
- Logic errors, off-by-one, null/undefined gaps
- Missing error handling at system boundaries
- Race conditions in async code
- Dead code or unused imports
- Inconsistent patterns vs. adjacent code

### Step 6: Completeness audit

Map every code path the diff introduces:
- Happy path, error path, edge cases
- For each: does the code handle it?

### Step 7: Task alignment

Compare the diff against the task's acceptance criteria:
- Does the code satisfy all criteria?
- Does the diff go beyond the task's scope?
- Are there task items the diff should complete but doesn't?

### Step 8: Classify and fix

For each finding:
- **CRITICAL** — Bug, security hole, data loss. Fix immediately.
- **ISSUE** — Real problem, not dangerous. Fix and explain.
- **SUGGESTION** — Could be better, isn't broken. List and ask.

### Step 9: Summary

\`\`\`
## Review Summary

**Task:** {id}: {title}
**Changes:** {one sentence}
**Files:** {count} changed
**Findings:** {N} critical, {N} issues, {N} suggestions
**Fixed:** {what was auto-fixed}
**Verdict:** CLEAN / ISSUES FIXED / NEEDS ATTENTION
\`\`\`

## Rules

- Read every changed file. Do not skim.
- Fix CRITICAL and ISSUE findings immediately.
- Never refactor code outside the diff.
- If the diff is clean, say "Clean" — don't manufacture findings.
`,

  "ship.md": `---
description: Ship the current task's branch. Typechecks, reviews, commits, pushes, and creates a PR. Provide an optional PR description.
---

# Ship

You are shipping the current task's branch. Pipeline: typecheck → review → commit → push → PR.

## Input

Optional PR context: \`$ARGUMENTS\`

${TASK_PREAMBLE}

## Step 1: Pre-flight

\`\`\`bash
git status
git log main..HEAD --oneline
git diff main...HEAD --stat
\`\`\`

- Uncommitted changes? Ask: commit or stash?
- HEAD equals main? Stop: "Nothing to ship."
- On \`main\`? Stop: "Create a branch first."

## Step 2: Typecheck

Run the project's typecheck command (see CLAUDE.md). Fix errors before proceeding.

## Step 3: Review

Run the \`/review\` process on the current diff.
- **CRITICAL:** Fix. Non-negotiable.
- **ISSUE:** Fix.
- **SUGGESTION:** List. Ask: "Fix or ship as-is?"

## Step 4: Task verification

- Read the current task from \`.wtm/backlog.json\`
- Are there unchecked items that this diff completes? Mark them done.
- Do the acceptance criteria pass?

## Step 5: Commit

If there are uncommitted changes:
- Stage specific files — never \`git add -A\`
- Exclude: \`.env\`, \`.data/\`, credentials, large binaries
- Write a commit message:
  - First line: imperative, under 70 chars
  - End with \`Co-Authored-By: Claude <noreply@anthropic.com>\`

## Step 6: Push

\`\`\`bash
git push -u origin HEAD
\`\`\`

Never force-push.

## Step 7: Create PR

\`\`\`bash
gh pr create --title "<title>" --body "$(cat <<'EOF'
## Summary
<2-4 bullets>

## Task
- **ID:** {task id}
- **Items completed:** {count}/{total}

## Review
- Typechecked: yes
- Auto-review: <CLEAN | N issues fixed>

## Test plan
- [ ] <verification steps>

Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
\`\`\`

## Step 8: Update task

- Set the task's \`status\` to \`"shipped"\` in \`.wtm/backlog.json\`
- Set the task's \`pr\` field to the PR URL
- Set \`shippedAt\` to the current ISO timestamp

## Step 9: Report

\`\`\`
## Shipped

**Task:** {id}: {title}
**Branch:** {branch}
**PR:** {url}
**Items completed:** {done}/{total}
\`\`\`

## Rules

- Never skip typecheck or review.
- Never force-push.
- Never push to main directly.
- Never commit \`.env\` or secrets.
- Update the task status after creating the PR.
`,
};
