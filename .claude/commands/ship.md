---
description: Ship the current task's branch. Typechecks, reviews, commits, pushes, and creates a PR. Provide an optional PR description.
---

# Ship

You are shipping the current task's branch. Pipeline: typecheck → review → commit → push → PR.

## Input

Optional PR context: `$ARGUMENTS`

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

## Step 1: Pre-flight

```bash
git status
git log main..HEAD --oneline
git diff main...HEAD --stat
```

- Uncommitted changes? Ask: commit or stash?
- HEAD equals main? Stop: "Nothing to ship."
- On `main`? Stop: "Create a branch first."

## Step 2: Typecheck

Run the project's typecheck command (see CLAUDE.md). Fix errors before proceeding.

## Step 3: Review

Run the `/review` process on the current diff.
- **CRITICAL:** Fix. Non-negotiable.
- **ISSUE:** Fix.
- **SUGGESTION:** List. Ask: "Fix or ship as-is?"

## Step 4: Task verification

- Read the current task from `.wtm/backlog.json`
- Are there unchecked items that this diff completes? Mark them done.
- Do the acceptance criteria pass?

## Step 5: Commit

If there are uncommitted changes:
- Stage specific files — never `git add -A`
- Exclude: `.env`, `.data/`, credentials, large binaries
- Write a commit message:
  - First line: imperative, under 70 chars
  - End with `Co-Authored-By: Claude <noreply@anthropic.com>`

## Step 6: Push

```bash
git push -u origin HEAD
```

Never force-push.

## Step 7: Create PR

```bash
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
```

## Step 8: Update task

- Set the task's `status` to `"shipped"` in `.wtm/backlog.json`
- Set the task's `pr` field to the PR URL
- Set `shippedAt` to the current ISO timestamp

## Step 9: Report

```
## Shipped

**Task:** {id}: {title}
**Branch:** {branch}
**PR:** {url}
**Items completed:** {done}/{total}
```

## Rules

- Never skip typecheck or review.
- Never force-push.
- Never push to main directly.
- Never commit `.env` or secrets.
- Update the task status after creating the PR.
