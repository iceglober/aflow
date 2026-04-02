---
description: Implement a given task using existing codebase patterns. Use when user says 'implement', 'build this', 'make this change', 'add this feature', 'code this up', or provides ad-hoc task instructions. Reads CLAUDE.md, follows dependency order, typechecks after changes.
---

# Work

You are implementing a task described by the user. Work through it methodically using the existing codebase patterns.

## Critical Rules

- **Read source files before editing them** — never edit blind.
- **Match existing patterns** — use the style of adjacent code.
- **Work in dependency order** — if B depends on A, complete A first.
- **If the task is ambiguous**, state your interpretation and proceed.

## Input

The user describes what to implement: `$ARGUMENTS`

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

## Setup

Before making any changes:

1. **Check for an active aflow task** by running the task lookup from the context section above. If a task is found, use its spec and description to guide implementation. If not, work from `$ARGUMENTS` directly.

2. **If no working branch exists yet**, pull the latest default branch and create one:
   ```bash
   git fetch origin
   MAIN=$(git symbolic-ref refs/remotes/origin/HEAD | sed 's@^refs/remotes/origin/@@')
   git checkout "$MAIN" && git pull origin "$MAIN"
   git checkout -b <slug>
   ```
   Use a short, kebab-case slug (e.g., `add-researcher-skill`, `fix-release-workflow`).

3. Read `CLAUDE.md` for project-specific commands (typecheck, build, lint, etc.).

## Process

### Step 1: Understand the task

1. Parse `$ARGUMENTS` and/or the aflow task spec to understand what needs to be done
2. Read `CLAUDE.md` to understand the project's architecture and conventions
3. Read relevant source files to understand the current state
4. Plan the implementation order: schema → API → client types → UI components

### Step 2: Implement

Work through the task methodically:
1. Read relevant existing source files before writing code
2. Implement each piece of the change
3. Verify each change compiles before moving on

Work in dependency order. If change B depends on change A, complete A first.

### Step 3: Verify

After implementing:
1. Run the project's typecheck command (from CLAUDE.md)
2. Review the task description — verify the ask is fully met
3. Run any relevant tests

