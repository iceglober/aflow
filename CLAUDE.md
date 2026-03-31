# aflow

AI-native development workflow CLI — worktrees, task management, and Claude Code skills.
Design specs. Write code. Ship it.

## Quick Reference

```bash
# Build & verify
bun run build          # Bundle to dist/index.js (single file, Bun bundler)
bun run typecheck      # bun x tsc --noEmit (strict mode)
bun run dev            # Watch mode build

# Run locally
./dist/index.js        # Or: node dist/index.js
af --help              # After install

# Install & update
curl -fsSL https://raw.githubusercontent.com/iceglober/aflow/main/install.sh | bash
af upgrade             # Self-update from GitHub releases
af skills              # Install Claude Code skills to current repo
```

## Architecture

### Stack

- **Runtime:** Node.js 20+ (built with Bun, runs on Node)
- **Language:** TypeScript (strict, ES2022 target, ESNext modules, bundler moduleResolution)
- **Build:** Bun bundler → single `dist/index.js` with shebang, all deps bundled
- **CLI framework:** `cmd-ts` for argument parsing and nested subcommands
- **TUI:** React 19 + Ink 6 (fullscreen terminal UI for `af start`)
- **Claude integration:** `@anthropic-ai/claude-agent-sdk` for spawning Claude Code sessions
- **External deps:** GitHub CLI (`gh`) required for install, upgrade, and PR operations
- **Version:** 0.7.0 (injected at build time via `__AFLOW_VERSION__`)

### Directory Structure

```
src/
├── index.ts              # CLI entrypoint — subcommand registration, help/version intercept
├── help.ts               # HELP_TEXT constant — manual-style, ANSI formatted
├── commands/             # CLI subcommands (one file per command)
│   ├── create.ts         # af wt create <name> [--from <branch>]
│   ├── checkout.ts       # af wt checkout <branch>
│   ├── list.ts           # af wt list
│   ├── delete.ts         # af wt delete <name> [--force]
│   ├── cleanup.ts        # af wt cleanup [--base] [--dry-run] [--yes]
│   ├── install-skills.ts # af skills [--force] [--user]
│   ├── init-hooks.ts     # af hooks
│   ├── start-work.ts     # af start (launches TUI)
│   └── upgrade.ts        # af upgrade (self-update from GitHub releases)
├── lib/                  # Shared utilities
│   ├── git.ts            # Git operations (git, gitSafe, gitIn, gitInSafe, gitRoot, etc.)
│   ├── config.ts         # Protected branches, repo name, worktree path resolution
│   ├── worktree.ts       # createWorktree, ensureWorktree (with hook execution)
│   ├── hooks.ts          # Hook runner (.aflow/hooks/post_create)
│   ├── fmt.ts            # ANSI formatting (bold, dim, colors, ok/info/warn helpers)
│   ├── version.ts        # Version from build-time define (__AFLOW_VERSION__)
│   └── update-check.ts   # 24h-cached version check via gh CLI
├── skills/               # Embedded skill content (written to .claude/ by af skills)
│   ├── index.ts          # COMMANDS and SKILLS registries (Record<filename, content>)
│   ├── preamble.ts       # TASK_PREAMBLE — shared context for backlog-aware skills
│   ├── work.ts           # /work — implement from description
│   ├── work-backlog.ts   # /work-backlog — implement from .aflow/backlog.json
│   ├── think.ts          # /think — strategy session before building
│   ├── fix.ts            # /fix — bug fixes within task scope
│   ├── qa.ts             # /qa — diff against acceptance criteria
│   ├── ship.ts           # /ship — typecheck → review → commit → push → PR
│   ├── research-web.ts   # /research-web — parallel multi-agent web research
│   ├── research-auto.ts  # /research-auto — autonomous think→test→reflect experimentation
│   ├── spec-make.ts      # /spec-make — create spec from research or description
│   ├── spec-enrich.ts    # /spec-enrich — autonomous codebase-driven spec enrichment
│   ├── spec-refine.ts    # /spec-refine — interactive unknown resolution
│   ├── spec-review.ts    # /spec-review — gap analysis after refinement
│   ├── spec-lab.ts       # /spec-lab — binary validation experiments
│   └── browser.ts        # /browser skill — Playwright CLI automation (auto-activates)
├── tui/                  # Interactive TUI (af start)
│   ├── app.tsx           # Root component — split-pane backlog + sessions, state management
│   ├── backlog.ts        # Backlog CRUD (loadBacklog, saveBacklog, addTask, etc.)
│   ├── backlog-view.tsx  # Backlog list component with keyboard nav
│   ├── task-form.tsx     # Add/edit task modal
│   ├── session.ts        # Session class — Claude Agent SDK wrapper, event emitter
│   ├── spec-gen.ts       # Generate .aflow/spec.md from backlog.json
│   └── git-sync.ts       # Pull main, check PR status, merge watcher
build.ts                  # Bun build script (bundle, shim react-devtools, add shebang)
install.sh                # curl-pipe installer (downloads from GitHub releases via gh)
```

### Build System

`build.ts` uses `Bun.build()` to create a single bundled `dist/index.js`:
- **Target:** Node (not Bun — runs on any Node 20+ install)
- **Format:** ESM, no code splitting, not minified
- **Bundling:** All packages bundled (no node_modules needed at runtime)
- **Shims:** `react-devtools-core` (Ink imports it but CLI doesn't need it)
- **Version:** Injects `__AFLOW_VERSION__` from `package.json` at build time via `define`
- **Shebang:** Prepends `#!/usr/bin/env node` after build completes

### Release & Distribution

- Binary is the bundled `dist/index.js` — published as `af` asset on GitHub releases
- `install.sh` downloads via `gh release download` (handles private repo auth)
- `af upgrade` self-updates by replacing its own binary from latest release
- Version check runs on every CLI invocation, cached for 24h at `~/.cache/aflow/`
- Repository: `github.com/iceglober/aflow`

## CLI Entrypoint (`src/index.ts`)

Two-tier command hierarchy using `cmd-ts`:

```
af
├── wt (subcommand group)
│   ├── create    # src/commands/create.ts
│   ├── checkout  # src/commands/checkout.ts
│   ├── list      # src/commands/list.ts
│   ├── delete    # src/commands/delete.ts
│   └── cleanup   # src/commands/cleanup.ts
├── start         # src/commands/start-work.ts
├── skills        # src/commands/install-skills.ts
├── hooks         # src/commands/init-hooks.ts
└── upgrade       # src/commands/upgrade.ts
```

- Intercepts `--help`, `-h`, `help`, `--version`, `-V` before cmd-ts to show custom `HELP_TEXT`
- Runs `checkForUpdate()` on every invocation (24h cache)

## Library Modules (`src/lib/`)

### `git.ts` — Git Operations

| Export | Behavior |
|:--|:--|
| `git(...args)` | Executes git command, throws on failure |
| `gitSafe(...args)` | Executes git command, returns `null` on failure |
| `gitIn(cwd, ...args)` | Execute git in specific directory, throws on failure |
| `gitInSafe(cwd, ...args)` | Execute git in specific directory, returns `null` on failure |
| `spawnShell(cwd)` | Spawns interactive shell (uses `$SHELL` env var, defaults to bash) |
| `gitRoot()` | Resolves git root through linked worktrees via `git rev-parse --git-common-dir` |
| `defaultBranch()` | Detects main branch: symbolic ref → remote fallback → local fallback |
| `listWorktrees()` | Parses `git worktree list --porcelain` → `WorktreeEntry[]` with `{path, commit, branch}` |

### `config.ts` — Configuration

| Export | Behavior |
|:--|:--|
| `PROTECTED_BRANCHES` | `Set`: `main`, `master`, `next`, `prerelease` — never cleaned up |
| `isProtected(branch)` | Returns boolean check against protected set |
| `repoName()` | Returns basename of git root directory |
| `worktreePath(name)` | Uses `$AFLOW_DIR/{name}` if env set, else `../{repo}-wt-{name}` (sibling of main repo) |

### `worktree.ts` — Worktree Management

| Export | Behavior |
|:--|:--|
| `createWorktree(name, from?)` | Creates worktree with `git worktree add -b`, fetches origin/{base}, sets upstream (best-effort), runs `post_create` hook, returns `{wtPath, name, base}` |
| `ensureWorktree(name, from?)` | Returns existing worktree path if found, otherwise creates it |

### `hooks.ts` — Hook Runner

| Export | Behavior |
|:--|:--|
| `runHook(name, env)` | Looks for `.aflow/hooks/{name}`, checks executable bit (0o111), runs with `execSync("bash")` |
| `HookEnv` | Interface: `{WORKTREE_DIR, WORKTREE_NAME, BASE_BRANCH, REPO_ROOT}` |

### `fmt.ts` — ANSI Formatting

- TTY-aware: strips color codes when `process.stdout.isTTY` is false
- **Colors:** `bold()`, `dim()`, `red()`, `green()`, `yellow()`, `cyan()`
- **Messages:** `ok()` (green checkmark), `info()` (cyan triangle), `warn()` (yellow warning)

### `version.ts` / `update-check.ts`

- `version` reads from `__AFLOW_VERSION__` (build-time define)
- `checkForUpdate()` queries `gh release list`, caches result at `~/.cache/aflow/` for 24h

## CLI Commands

### Worktree Management (`af wt`)

Worktrees share the same `.git` object store. Each has its own working tree and index.

| Command | Description |
|:--|:--|
| `af wt create <name> [--from <branch>]` | New worktree + branch, fetches base, runs `post_create` hook, spawns shell |
| `af wt checkout <branch>` | Worktree from existing remote branch |
| `af wt list` | All worktrees with branch and commit |
| `af wt delete <name> [--force]` | Remove worktree + branch (refuses if dirty unless `--force`) |
| `af wt cleanup [--base] [--dry-run] [--yes]` | Delete worktrees with merged/deleted remote branches, skips dirty/unpushed |

**Worktree layout:**
- Default: `~/repos/myapp-wt-<name>/` (sibling of repo)
- With `AFLOW_DIR`: `$AFLOW_DIR/<name>/`

**Protected branches:** `main`, `master`, `next`, `prerelease` — never cleaned up.

**Hooks:** `af hooks` creates `.aflow/hooks/post_create` template. Hook receives env vars via `HookEnv`: `WORKTREE_DIR`, `WORKTREE_NAME`, `BASE_BRANCH`, `REPO_ROOT`.

### Workflow Commands

| Command | Description |
|:--|:--|
| `af start` | Launch fullscreen TUI — manage backlog, start parallel Claude Code sessions |
| `af skills [--force] [--user]` | Install skills to `.claude/commands/` and `.claude/skills/` |
| `af hooks` | Create `.aflow/hooks/post_create` template |
| `af upgrade` | Self-update from GitHub releases |

## Skills System

Skills are markdown files written to `.claude/commands/` (slash commands) and `.claude/skills/` (auto-activating). `af skills` writes them from embedded TypeScript sources in `src/skills/`.

### Registry (`src/skills/index.ts`)

Two registries, both `Record<filename, content>`:
- **`COMMANDS`** — 13 user-invoked commands, written to `.claude/commands/`
- **`SKILLS`** — auto-activating skills, written to `.claude/skills/`

### Installation (`src/commands/install-skills.ts`)

- `installFiles(files, baseDir, force)` writes registry entries to disk
- Default: `.claude/commands/` and `.claude/skills/` in current repo
- `--user`: installs to `~/.claude/commands/` and `~/.claude/skills/` (global)
- `--force`: overwrite even if content unchanged
- Idempotent — prints created/updated/up-to-date counts per file
- Prints slugified command names (`/think`, `/work`, `/work-backlog`, etc.)

### Skill Categories

**Design pipeline** — idea to spec:
```
/research-web → /spec-make → /spec-enrich → /spec-refine × N → /spec-review
                                                                     ↕
                                                                 /spec-lab
```

| Skill | Purpose |
|:--|:--|
| `/research-web` | Spawns parallel research agents, decomposes question, monitors progress, synthesizes findings |
| `/spec-make` | Creates spec from research dir or plain description. Surfaces unknowns (U-01...), requirements (R-01...), business rules (BR-01...) |
| `/spec-enrich` | Autonomous — reads codebase to resolve spec unknowns. No user input needed |
| `/spec-refine` | Interactive — walks through unknowns one at a time with the user |
| `/spec-review` | Audits spec for gaps, conflicts, opportunities after refinement rounds |
| `/spec-lab` | Runs binary yes/no validation experiments against spec unknowns via subagents |

**Build pipeline** — spec to production:

| Skill | Purpose |
|:--|:--|
| `/think` | Strategy session — forcing questions, validates ideas, outputs plan or kill decision. No code |
| `/work` | Implement from description. Pulls latest, creates branch, reads CLAUDE.md, codes, typechecks |
| `/work-backlog` | Implement from `.aflow/backlog.json`. Marks checklist items done one at a time |
| `/fix` | Bug fixes within task scope. Classifies as bug/scope-change/new-work |
| `/qa` | QA diff against acceptance criteria. Builds test matrix, traces code paths, PASS/FAIL per scenario |
| `/ship` | Pipeline: typecheck → review → commit → push → PR. Updates task status to "shipped" |
| `/research-auto` | Autonomous experimentation (think→test→reflect loop). Manages `.lab/` directory, branches, metrics |

**Auto-activating skills:**

| Skill | Purpose |
|:--|:--|
| `/browser` | Browser automation via Playwright CLI. Used by `/qa` for UI testing, `/ship` for screenshots |

### The Full Loop (from README)

```bash
# ── design ──────────────────────────────────────────
/research-web  Build a multi-tenant billing system with usage-based pricing
/spec-make     research/billing focused on metering and invoicing
/spec-enrich
/spec-refine

# ── build ───────────────────────────────────────────
/work  billing system spec
/qa
/ship
```

### Shared Preamble (`src/skills/preamble.ts`)

`TASK_PREAMBLE` is injected into backlog-aware skills (`/work-backlog`, `/fix`, `/qa`, `/ship`, `/think`). It instructs Claude to:
1. Read `.aflow/backlog.json`
2. Match the current branch to a task's `branch` field
3. Read `.aflow/spec.md` and `CLAUDE.md` for project context

### Skill Authoring

Each skill in `src/skills/` exports a function returning a markdown string:
- Uses `$ARGUMENTS` placeholder for user input
- Includes YAML frontmatter with `description` (used for auto-activation matching)
- If backlog-aware, imports and prepends `TASK_PREAMBLE` from `preamble.ts`

## TUI (`af start`)

Fullscreen React/Ink app (`src/tui/app.tsx`) with split-pane layout:
- **Left panel:** Backlog list with keyboard navigation (`backlog-view.tsx`)
- **Right panel:** Active Claude Code sessions with live status

### State Management

`app.tsx` manages top-level state:
- `sessions[]` — active Session instances
- `backlog` — current task list from `.aflow/backlog.json`
- `selectedTaskIndex` — keyboard navigation cursor

Helper components:
- `SessionMonitor` — displays active sessions with status, cost, token counts, last output
- `ToolApproval` — yellow bordered prompt for tool approval (y/n)

Utility functions: `slugify()`, `truncate()`, `statusIcon()`, `statusColor()`, `formatCost()`, `formatTokens()`, `buildPrompt()`

### Backlog Data Model (`src/tui/backlog.ts`)

Stored at `.aflow/backlog.json`:

```typescript
interface Task {
  id: string;           // "t1", "t2", etc.
  title: string;
  description: string;
  status: "pending" | "active" | "shipped" | "merged";
  items: { text: string; done: boolean }[];
  acceptance: string[];
  dependencies: string[];  // task IDs that must be shipped/merged first
  design: string | null;
  branch: string | null;
  pr: string | null;
  createdAt: string;
  startedAt: string | null;
  shippedAt: string | null;
}
```

CRUD operations:
- `loadBacklog()` — reads `.aflow/backlog.json`
- `saveBacklog(backlog)` — writes JSON and regenerates `.aflow/spec.md` via `generateSpec()`
- `addTask()`, `updateTask()`, `deleteTask()` — standard CRUD
- `moveTaskUp()`, `moveTaskDown()` — reorder in list
- `nextId()` — generates next "tN" identifier
- `dependenciesMet(task, backlog)` — checks if all dependency tasks are shipped/merged
- `nextPendingTask(backlog)` — finds first pending task with met dependencies

### Session Management (`src/tui/session.ts`)

`Session` class extends `EventEmitter`:

- **Constructor:** `{name, section: TaskInfo | null, worktreePath, prompt}`
- **`start()`:** Launches Claude Agent SDK `query()` with cwd isolation, auto-tool-approval, system prompt + pipeline prompt
- **`findClaudeCli()`:** Resolves system `claude` binary via `which`
- **Status:** `"starting"` | `"working"` | `"waiting"` | `"done"` | `"failed"`
- **Tracking:** messages, streaming text, cost, turns, input/output tokens, pending questions/tools
- **Max concurrency:** `MAX_CONCURRENT` (3 sessions)
- **Auto-start:** fills available concurrency slots from pending tasks (respects dependencies)
- **Pipeline prompt (`PIPELINE_PROMPT`):** sequential instructions: `/think` → `/work` → `/review` → `/ship`
- Sessions auto-allow all tool calls (worktree provides isolation)

### Git Sync (`src/tui/git-sync.ts`)

| Function | Behavior |
|:--|:--|
| `pullMain()` | Fast-forward pull of main branch |
| `checkPrStatus()` | Checks PR state via `gh pr view` |
| `startMergeWatcher()` | Polls PR every 30s, fires callback on merge |

### TUI Keyboard Shortcuts

| Key | Action |
|:--|:--|
| `enter` | Start task / view session |
| `a` | Add task |
| `e` | Edit task |
| `d` | Delete task |
| `x` | Kill session |
| `J/K` | Reorder tasks |
| `v` | View session detail |
| `S` | Toggle auto-start |
| `r` | Refresh backlog |
| `q` | Quit |

In session detail: `Esc` → back, `Ctrl+X` → kill, type + `Enter` → reply.

## Conventions

### Code Style

- TypeScript strict mode, no `any` unless interfacing with SDK types
- ESM modules (`.js` extensions in imports — required for bundler resolution)
- Functional style for utilities, classes for stateful objects (`Session`, `App`)
- React JSX via `react-jsx` transform (no manual imports needed)
- ANSI colors via `fmt.ts` helpers (TTY-aware — no colors when piped)
- Error handling: `gitSafe()` / `gitInSafe()` return `null` on failure; `git()` / `gitIn()` throw

### Adding a New Skill

1. Create `src/skills/<name>.ts` exporting a function that returns the markdown string
2. Add to `COMMANDS` or `SKILLS` registry in `src/skills/index.ts`
3. If it needs backlog context, import and use `TASK_PREAMBLE` from `preamble.ts`
4. Skill markdown uses `$ARGUMENTS` placeholder for user input
5. Add YAML frontmatter with `description` (used for auto-activation matching)

### Adding a New CLI Command

1. Create `src/commands/<name>.ts` using `cmd-ts` `command()` pattern
2. Register in `src/index.ts` under the appropriate subcommand group
3. Update `HELP_TEXT` in `src/help.ts`

### Git Patterns

- `gitRoot()` resolves through linked worktrees to find the main repo root
- `defaultBranch()` tries symbolic ref → remote check → local check
- Protected branches are hardcoded in `config.ts` as a Set
- Worktree paths resolved via `config.ts` `worktreePath()` — respects `$AFLOW_DIR` env var

### Key File Paths

| Path | Purpose |
|:--|:--|
| `.aflow/backlog.json` | Task backlog (CRUD via `src/tui/backlog.ts`) |
| `.aflow/spec.md` | Auto-generated spec overview (regenerated on every `saveBacklog()`) |
| `.aflow/hooks/post_create` | Worktree creation hook (bash script) |
| `.claude/commands/*.md` | Installed slash commands |
| `.claude/skills/*.md` | Installed auto-activating skills |
| `~/.cache/aflow/` | Update check cache (24h TTL) |
| `dist/index.js` | Built CLI binary |
