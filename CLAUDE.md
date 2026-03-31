# aflow

AI-native development workflow CLI. Manages worktrees, tasks, and Claude Code skills.

## Commands

```bash
bun run build        # Build to dist/index.js
bun run dev          # Watch mode build
bun run typecheck    # bun x tsc --noEmit
bun test             # Run tests
```

Run the CLI locally: `node dist/index.js <command>`

## Architecture

```
src/
├── index.ts              # CLI entry point (cmd-ts router)
├── help.ts               # Manual text
├── commands/
│   ├── start.ts          # af start — pipeline orchestrator
│   ├── status.ts         # af status — task tree view
│   ├── state/            # af state — task state management (internal)
│   │   ├── index.ts      # Subcommand group
│   │   ├── task.ts       # create, show, transition, update, cancel, list
│   │   ├── spec.ts       # show, set, add-workstream
│   │   ├── qa.ts         # QA report
│   │   └── log.ts        # Transition history
│   ├── create.ts         # af wt create
│   ├── checkout.ts       # af wt checkout
│   ├── list.ts           # af wt list
│   ├── delete.ts         # af wt delete
│   ├── cleanup.ts        # af wt cleanup
│   ├── install-skills.ts # af skills
│   ├── init-hooks.ts     # af hooks
│   └── upgrade.ts        # af upgrade
├── lib/
│   ├── state.ts          # Task model, CRUD, phase validation, auto-setup
│   ├── pipeline.ts       # Orchestrator logic (skill sequencing, resume)
│   ├── session-runner.ts # Spawn Claude sessions as subprocesses
│   ├── git.ts            # Git wrappers (git, gitRoot, listWorktrees)
│   ├── worktree.ts       # createWorktree, ensureWorktree
│   ├── config.ts         # worktreePath, repoName, isProtected
│   ├── hooks.ts          # runHook
│   ├── slug.ts           # slugify
│   ├── fmt.ts            # Terminal formatting (bold, dim, colors)
│   ├── version.ts        # VERSION constant
│   └── update-check.ts   # Update checker
└── skills/
    ├── index.ts          # COMMANDS & SKILLS registry
    ├── preamble.ts       # Shared task context for skills (uses af state)
    ├── think.ts          # /think
    ├── work.ts           # /work
    ├── fix.ts            # /fix
    ├── qa.ts             # /qa
    ├── ship.ts           # /ship
    ├── research-auto.ts  # /research-auto
    ├── research-web.ts   # /research-web
    ├── spec-make.ts      # /spec-make
    ├── spec-refine.ts    # /spec-refine
    ├── spec-enrich.ts    # /spec-enrich
    ├── spec-review.ts    # /spec-review
    ├── spec-lab.ts       # /spec-lab
    └── browser.ts        # /browser (skill, not command)
```

## Key concepts

- **Task state** lives in `.aflow/state/` (gitignored, per-engineer)
- **Specs** live in `.aflow/specs/` (committed, shared)
- **`af state`** is the sole interface for reading/writing state — skills call it via Bash, never edit files directly
- **Pipeline phases**: understand → design → implement → verify → ship → done
- **Each skill runs as a separate Claude session** to avoid context window bloat
- Skills use `TASK_PREAMBLE` from `preamble.ts` to find the current task via `af state`

## Stack

- **Runtime**: Bun
- **CLI framework**: cmd-ts
- **Language**: TypeScript (ESM)
- **Build**: Bun bundler (build.ts)
- **Claude integration**: @anthropic-ai/claude-agent-sdk

## Conventions

- All CLI commands use `cmd-ts` with the `command()` / `subcommands()` pattern
- Use `--id` options (not positional args) for task IDs in state commands
- Use `src/lib/fmt.ts` for terminal output (bold, dim, colors, ok, info, warn)
- `gitRoot()` resolves to the main repo root from any worktree
- State auto-creates directories and `.gitignore` entries on first write
