---
description: Pre-landing code review for the current task. Analyzes diff for correctness, security, and architecture. Auto-fixes critical issues. Provide optional context.
---

# Review

You are performing a pre-landing code review. This is the gate before shipping.

## Input

Optional context: `$ARGUMENTS`

## Context: Current task

Run \`git branch --show-current\` to get the current branch name.

Read \`.wtm/backlog.json\` and find the task whose \`branch\` field matches the current branch. This is your **current task**.

If no task matches, tell the user: "This branch isn't linked to a wtm task. Run \`wtm start-work\` to create one."

The task object has:
- \`id\` — task identifier (e.g. "t3")
- \`title\` — short description
- \`description\` — full context
- \`items\` — checklist of implementation tasks (\`{ text, done }\`)
- \`acceptance\` — acceptance criteria (strings)
- \`status\` — pending | active | shipped | merged
- \`branch\` — the git branch for this task
- \`pr\` — PR URL if shipped

Also read \`.wtm/spec.md\` for a formatted overview of the full backlog, and \`CLAUDE.md\` for project-specific commands (typecheck, build, lint, etc.).

## Process

### Step 1: Scope the diff

```bash
git diff main...HEAD --stat
git log main..HEAD --oneline
```

Read every changed file in full. Understand the diff as a whole.

### Step 2: Typecheck

Run the project's typecheck command (see CLAUDE.md). If it fails, fix before continuing.

### Step 3: Architecture review

Check against the project's patterns (from CLAUDE.md):
- Are imports following established dependency rules?
- Do new API routes have proper auth?
- Is data access properly scoped?
- Are new env vars added to `.env.example`?

### Step 4: Security review

For each changed file:
- **Injection:** Raw SQL with user input? `dangerouslySetInnerHTML`? Shell exec with user strings?
- **Auth:** Missing auth checks? Cross-user data access? Secrets in client bundle?
- **Input:** Unvalidated request bodies? Unbounded queries?
- **Secrets:** Hardcoded keys? `.env` not gitignored?

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

```
## Review Summary

**Task:** {id}: {title}
**Changes:** {one sentence}
**Files:** {count} changed
**Findings:** {N} critical, {N} issues, {N} suggestions
**Fixed:** {what was auto-fixed}
**Verdict:** CLEAN / ISSUES FIXED / NEEDS ATTENTION
```

## Rules

- Read every changed file. Do not skim.
- Fix CRITICAL and ISSUE findings immediately.
- Never refactor code outside the diff.
- If the diff is clean, say "Clean" — don't manufacture findings.
