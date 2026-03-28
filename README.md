# aflow

AI-native development workflow for the command line. Manage git worktrees, track tasks with a backlog, and ship features with Claude Code skills — all from one tool.

## Install

Requires Node.js 20+ and the [GitHub CLI](https://cli.github.com) (authenticated).

```bash
bash <(gh api repos/iceglober/aflow/contents/install.sh --jq .content | base64 -d)
```

To update:

```bash
af upgrade
```

## Quick start

```bash
# Create a worktree for a new feature
af wt create feature-auth

# Launch the task management TUI
af start

# Install Claude Code workflow skills
af skills
```

## Worktrees

aflow makes git worktrees practical. Each feature gets its own directory with a shared `.git` — no more stashing, no more branch juggling.

```bash
af wt create feature-auth          # new branch + worktree, opens a shell
af wt create hotfix --from release  # fork from a specific branch
af wt checkout feature-payments     # worktree from an existing remote branch
af wt list                          # show all worktrees
af wt delete feature-auth           # clean up
af wt cleanup                       # batch-delete merged/stale worktrees
```

Worktrees are created as siblings of the repo by default:

```
~/repos/myapp/                ← main repo
~/repos/myapp-wt-feature-auth/   ← worktree
```

Set `AFLOW_DIR` to store them elsewhere.

## Task management

`af start` launches an interactive TUI for managing a task backlog. Tasks live in `.aflow/backlog.json` and drive the Claude Code skills.

- Add, edit, reorder, and delete tasks
- Start tasks — creates a worktree and a Claude Code session
- Run multiple sessions in parallel (up to 3 concurrent)
- Monitor session progress, costs, and token usage

## Skills

aflow ships with Claude Code slash commands that plug into the task workflow:

```bash
af skills
```

This installs 7 skills to `.claude/commands/`. Each skill reads the current task from `.aflow/backlog.json` (matched by branch name) and uses its items and acceptance criteria to guide the work.

- `/think` — product strategy session before building
- `/work` — implement the task's unchecked items
- `/fix` — fix bugs, update task items if needed
- `/investigate` — root-cause debugging
- `/qa` — QA the diff against acceptance criteria
- `/review` — pre-landing code review
- `/ship` — typecheck, review, commit, push, PR

## Hooks

Run setup scripts automatically after creating a worktree:

```bash
af hooks   # creates .aflow/hooks/post_create template
```

The hook receives `WORKTREE_DIR`, `WORKTREE_NAME`, `BASE_BRANCH`, and `REPO_ROOT` as environment variables.

## License

MIT
