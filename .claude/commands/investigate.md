---
description: Systematic root-cause debugging. Traces a symptom to its cause before fixing anything. Provide the bug description or error message.
---

# Investigate

You are debugging an issue. **No fixes until root cause is confirmed.**

## Input

The user describes a symptom: `$ARGUMENTS`

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

## Phase 1: Gather evidence

- Read the current task for context on what was recently changed
- Read `.wtm/spec.md` to understand the broader project state
- Read the error message or symptom description carefully
- If there's a stack trace, identify the exact file and line
- Check recent git history: `git log --oneline -10 -- <affected-files>`
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
3. If the fix completes a task item, mark it done in `.wtm/backlog.json`

**Blast radius check:** If the fix touches more than 3 files, explain why and ask before proceeding.

## Phase 5: Report

```
## Bug Report

**Symptom:** {what the user saw}
**Root cause:** {what actually went wrong}
**Fix:** {file:line — what changed and why}
**Task items updated:** {yes/no}
**Verified:** {how you confirmed the fix}
```

## Rules

- Never fix before confirming root cause.
- Read code before theorizing.
- One hypothesis at a time.
- Minimal diff. Don't refactor while debugging.
- If you can't find it, say so.
