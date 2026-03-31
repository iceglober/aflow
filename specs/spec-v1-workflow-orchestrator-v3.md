# Aflow v1.0 — Workflow Orchestrator for Agent-First Engineering

**Status:** Draft v3
**Date:** 2026-03-30
**Scope:** Replace aflow's static backlog with a structured state machine that orchestrates the full engineering lifecycle (understand → design → implement → verify → ship), enforced through CLI state commands. Each pipeline skill runs as a separate Claude session with the spec on disk as the handoff artifact.
**Source:** /think + /spec-refine + /spec-enrich sessions, 2026-03-30

## Changelog

### v3 — enriched from codebase (2026-03-30)

- **Confirmed from code:** `gitRoot()` (`src/lib/git.ts:37-45`) already resolves through linked worktrees via `git rev-parse --git-common-dir`. R-03 path resolution needs zero new code.
- **Confirmed from code:** `cmd-ts` nesting (`src/index.ts:28-38`) already supports `subcommands()` for `af wt`. `af state` follows the identical pattern.
- **Confirmed from code:** Task ID generation (`src/tui/backlog.ts:63-69`) scans and increments `t{N}`. New state layer replicates this against `.aflow/state/t*.json` files.
- **Discovery: Session class needs CLI-mode adapter.** Current `Session` (`src/tui/session.ts:67-319`) is TUI-oriented (EventEmitter, React bindings, async generator input queue). Orchestrator needs a simpler subprocess model — spawn `claude` with a prompt, wait for exit. Added R-23.
- **Discovery: 5 skills reference backlog via `TASK_PREAMBLE`.** `think`, `work-backlog`, `fix`, `qa`, `ship` (`src/skills/preamble.ts`) all instruct Claude to read `backlog.json` and find task by branch. Must rewrite to use `af state`. The other 8 skills (`work`, `spec-*`, `research-*`, `browser`) have no backlog dependency. Added R-24.
- **Discovery: `decompose` is not a phase in the state machine.** R-06 defines 6 phases. Decomposition is an orchestrator-level step during the `design → implement` transition, not a formal phase. Clarified in R-09 and BR-05.
- **Discovery: `PIPELINE_PROMPT` validates the approach.** `session.ts:46-51` already sequences `/think → /work → /review → /ship` in one session. The new design fixes the known context window problem by splitting into skill-per-session.
- **Discovery: Existing worktree infrastructure is complete.** `createWorktree` (`src/lib/worktree.ts:14-45`) and `ensureWorktree` (`src/lib/worktree.ts:48-55`) handle creation, branch setup, upstream tracking, and hooks. `worktreePath` (`src/lib/config.ts:26-33`) resolves paths with `AFLOW_DIR` override support. No changes needed for R-14.
- Remaining unknowns: 1 (deferred U-04)

### v2 — refined with user (2026-03-30)
- Resolved U-01, U-02, U-03, U-05, U-06, U-07, U-08. Deferred U-04.
- Decided OQ-01 through OQ-05.
- Removed R-20, R-21, R-25, R-26, R-29, R-30.
- Simplified R-09, R-10, R-19.

---

## Out of Scope

- Multi-repo / monorepo workspace federation
- Automatic Claude session spawning from CI/CD
- Cost tracking / billing per session
- Real-time collaboration (multiple users editing the same spec simultaneously)
- Web dashboard / GUI / TUI (CLI only — `af status` for visibility)
- Migration tooling for existing `backlog.json` users (no users to migrate)
- Custom skill authoring framework (existing skill installation is sufficient)
- External tracker integration (Linear, GitHub Issues) — deferred to v2
- `af pull <ticket-id>` — deferred to v2
- Parallel workstream execution — deferred, v1 runs sequentially

---

## Unknowns Register

```
UNKNOWN [U-04]: Concurrent session limits with Claude Agent SDK  [DEFERRED]
  Assumed: Current MAX_CONCURRENT=3 is an aflow limit, not an SDK/API limit
  Risk if wrong: API rate limits or SDK constraints may cap concurrent sessions lower
  Needed from: SDK docs, empirical testing
  Blocks: Parallel workstream execution (deferred feature)
  Status: Deferred until parallel workstreams are built
```

---

## Definitions

- **Task:** A unit of work with a defined lifecycle (understand → design → implement → verify → ship → done). Has a title, description, phase, and optional parent.
- **Epic:** A parent task whose spec decomposes into multiple child tasks (workstreams). An epic does not have its own branch — its children do.
- **Workstream:** A child task within an epic. Has its own branch, worktree, and PR. May depend on other workstreams within the same epic.
- **Phase:** One of: `understand`, `design`, `implement`, `verify`, `ship`, `done`. Phases are ordered and enforced by the state machine. Six phases total — decomposition is not a phase, it's an orchestrator step.
- **Spec:** A structured Markdown document produced during the design phase. Lives at `.aflow/specs/{task-id}.md` in the main repo. Accessed exclusively via `af state spec` commands.
- **State:** The structured, machine-readable record of a task's current phase, metadata, and history. Owned exclusively by `af state` — no other process writes to it. Stored as individual JSON files in `.aflow/state/`.
- **Pipeline:** The full sequence of phases a task moves through. Each phase maps to one or more skills, each running as a separate Claude session.
- **Session:** A Claude Code subprocess executing a single skill against a task. Sessions are ephemeral — state survives on disk, not in the session. Spawned by the orchestrator via the `claude` CLI binary.
- **Orchestrator:** The `af start` process that manages the pipeline — checks state, determines the next skill, spawns a session, waits for completion, advances state, repeats.
- **Skill session:** One invocation of one skill (e.g., `/spec-make`) in one Claude session. The spec on disk is the input and output.

---

## Requirements

### State Management (`af state`)

**R-01:** `af state` MUST be the sole interface for reading and writing task state. No skill or external process writes state files directly. [MUST]

**R-02:** `af state` MUST validate all inputs against the task schema before writing. Invalid transitions (e.g., `implement` before `design` is complete) MUST be rejected with an actionable error message. [MUST]

**R-03:** Task state MUST be stored in `.aflow/state/` in the main repository root. `af state` resolves this path via the existing `gitRoot()` function (`src/lib/git.ts:37-45`), which already handles linked worktrees via `git rev-parse --git-common-dir`. Each task gets its own file: `.aflow/state/{task-id}.json`. [MUST]

**R-04:** `af state` MUST be implemented as a nested `cmd-ts` subcommand group, following the same pattern as `af wt` (`src/index.ts:28-38`). The command tree: [MUST]

| Command | Purpose |
|---|---|
| `af state task create --title "..."` | Create a task, returns task ID |
| `af state task <id> show [--json]` | Display task state |
| `af state task <id> transition <phase> [--force]` | Move task to next phase (--force for backward) |
| `af state task <id> update --<field> <value>` | Update task metadata (title, description, branch, worktree, pr) |
| `af state task list [--phase <phase>] [--parent <id>] [--json]` | List tasks with filters |
| `af state spec <id> set --file <path>` | Write spec content from a file |
| `af state spec <id> set --content "..."` | Write spec content from string |
| `af state spec <id> add-workstream --title "..." [--depends-on <ids>]` | Add a child workstream task to an epic |
| `af state spec <id> show` | Display spec content |
| `af state qa <id> report --status pass\|fail --summary "..."` | Record QA result |
| `af state log <id>` | Show phase transition history |

**R-05:** Every state mutation MUST be logged with a timestamp and the actor (CLI or skill name) in a `transitions` array on the task. [MUST]

**R-06:** `af state task <id> transition` MUST enforce the phase order: `understand → design → implement → verify → ship → done`. Backward transitions MUST require `--force`. [MUST]

### Task Model

**R-07:** A task MUST have the following fields: [MUST]

```
id:           string       — auto-generated, scanning .aflow/state/t*.json and incrementing (same pattern as src/tui/backlog.ts:63-69)
title:        string       — short description
description:  string       — full context
phase:        Phase        — current lifecycle phase
parent:       string|null  — parent task ID (null for top-level tasks)
children:     string[]     — child task IDs (empty for leaf tasks)
dependencies: string[]     — sibling task IDs that must reach `done` before this task can start `implement`
branch:       string|null  — git branch name
worktree:     string|null  — worktree path
pr:           string|null  — PR URL
externalId:   string|null  — reserved for future external tracker linking
spec:         string|null  — path to spec file relative to repo root
qaResult:     QAResult|null — latest QA report {status, summary, timestamp}
transitions:  Transition[] — phase change history [{phase, timestamp, actor}]
createdAt:    string       — ISO timestamp
```

**R-08:** An epic (task with children) MUST NOT have its own branch or worktree. Its phase is derived from the aggregate state of its children: the minimum phase across all non-done children. All children `done` → epic is `done`. An epic cannot be transitioned directly — only its children can. [MUST]

### Pipeline Orchestration (`af start`)

**R-09:** `af start "<description>"` MUST orchestrate the full pipeline by spawning sequential Claude sessions, one per skill. The orchestrator: [MUST]

1. Creates a task via `af state task create`
2. Checks the task's current phase via `af state task <id> show`
3. Determines the next skill to run for that phase
4. Spawns a Claude session that executes the skill
5. On session completion, checks if the phase's skills are done
6. Advances the phase via `af state task <id> transition`
7. Repeats from step 2 until `done`

The pipeline phases and their corresponding skills:

| Phase | Skills | User gate? | Skip condition |
|---|---|---|---|
| understand | `/think` (interactive) | YES — user approves direction | `--quick` flag |
| design | `/spec-make` → `/spec-enrich` → `/spec-refine` → `/spec-lab` → `/spec-review` | YES — user approves final spec | `--quick` flag |
| implement | `/work` per workstream; `/research-auto` if spec prescribes it | No | — |
| verify | `/qa` per workstream; `/browser` if UI testing | No | — |
| ship | `/ship` per workstream | No | — |

**Decomposition** occurs between design and implement as an orchestrator step, not a formal phase. After design completes and the user approves the spec, the orchestrator checks for workstreams. If present, it calls `af state spec <id> add-workstream` for each, prompts the user to confirm, and creates worktrees. Then it runs implement/verify/ship sequentially per workstream.

**R-10:** The pipeline MUST be resumable. `af start` checks the current phase and the last completed skill within that phase (stored in `.aflow/state/{task-id}.pipeline.json`). If a session died mid-skill, the orchestrator re-runs that skill from scratch — the latest state on disk (spec, task metadata) reflects all previously completed work. [MUST]

**R-11:** `af start` with no arguments in a worktree that has an active task MUST resume that task's pipeline. `af start` with no arguments and no active task MUST prompt for a description. [MUST]

**R-12:** After the design phase, if the spec contains multiple workstreams, the orchestrator MUST decompose the spec into child tasks via `af state spec <id> add-workstream`. The user MUST be prompted to confirm the decomposition before proceeding. [MUST]

**R-13:** During the design phase, each skill session MUST write its output to disk via `af state spec <id> set` before exiting. Partial progress survives session loss. [MUST]

**R-14:** The orchestrator MUST create a worktree for the task (or for each workstream in an epic) before entering the `implement` phase, using the existing `ensureWorktree()` function (`src/lib/worktree.ts:48-55`). [MUST]

**R-15:** For simple tasks (no workstreams), the full pipeline runs in a single worktree. For epics, understand and design run in the main repo, and implement/verify/ship fan out to per-workstream worktrees sequentially. [MUST]

### Pipeline Flexibility

**R-16:** `af start --quick "<description>"` MUST skip understand and design phases, creating a task directly in `implement` phase with a worktree. For small bugs or features that don't need the full design pipeline. [MUST]

**R-17:** Design-phase skills MUST be skipped when their preconditions aren't met: [MUST]
- `/spec-lab` — skip if spec has no unknowns tagged as experimentally testable
- `/spec-enrich` — skip if spec has no unknowns resolvable from codebase
- `/research-web` — skip if spec has no unknowns requiring external research

**R-18:** The spec template MUST include an optional "Experiments" section. `/research-auto` during implement phase MUST only run when this section defines experiment criteria (hypothesis, measurement method). [SHOULD]

### Visibility (`af status`)

**R-19:** `af status` MUST display a tree view of all tasks: [MUST]

| Field | Display |
|---|---|
| Task title | With ID prefix |
| Phase | Color-coded (understand=blue, design=purple, implement=yellow, verify=cyan, ship=green, done=dim) |
| Branch | If assigned |
| Dependencies | Blocked indicator if unmet |
| Children | Indented under parent |
| PR | Link if shipped |
| Active session | Indicator if Claude is running in the task's worktree |

**R-20:** `af status --json` MUST output machine-readable JSON for scripting. [MUST]

### Backward Compatibility

**R-21:** The old `backlog.json` format MUST NOT be supported. The file SHOULD be ignored if present. No migration path is required. [MUST]

**R-22:** Existing installed skills (`.claude/commands/*.md`) MUST continue to work standalone (invoked directly by the user) even if no `af state` task exists. Skills MUST gracefully degrade: if no active task is found via `af state`, they operate in ad-hoc mode without state tracking. [MUST]

### Session Management

**R-23:** The orchestrator MUST spawn Claude sessions as subprocesses using the system `claude` binary (located via `which claude`, same pattern as `src/tui/session.ts:9-14`). Each session receives: [MUST]
- A working directory (worktree path or main repo)
- A prompt that invokes the target skill (e.g., `/spec-make <args>`)
- The task context (task ID, phase, spec path) passed via the prompt

The orchestrator waits for the subprocess to exit. Interactive phases (understand, design) inherit stdin/stdout for user interaction. Autonomous phases (implement, verify, ship) can run detached with output logged.

The existing `Session` class (`src/tui/session.ts`) is TUI-specific and SHOULD NOT be used by the orchestrator. A simpler subprocess wrapper is required.

### Skill Preamble Migration

**R-24:** The `TASK_PREAMBLE` (`src/skills/preamble.ts`) MUST be rewritten to use `af state` instead of reading `backlog.json`. The 5 affected skills are: `/think`, `/work-backlog`, `/fix`, `/qa`, `/ship`. The new preamble MUST instruct Claude to: [MUST]
1. Run `af state task list` to find the active task for the current branch
2. Run `af state task <id> show` to get task details
3. Run `af state spec <id> show` to get the spec (if exists)
4. Use `af state` commands for all mutations (transition, update, qa report)

The 8 unaffected skills (`work`, `spec-make`, `spec-refine`, `spec-enrich`, `spec-review`, `spec-lab`, `research-web`, `research-auto`, `browser`) need no changes.

### Future: External Tracker Adapter Interface

The following interface is defined for v2 implementation. No adapter ships in v1.

```typescript
interface TaskSource {
  name: string;                                    // "linear", "github"
  pull(ticketId: string): Promise<ExternalTask>;   // Fetch ticket data
  sync(taskId: string, state: TaskState): Promise<void>;  // Push status back
  link(taskId: string, prUrl: string): Promise<void>;     // Attach PR to ticket
}

interface ExternalTask {
  id: string;          // External system's ID
  url: string;         // Canonical URL
  title: string;
  description: string;
  labels: string[];
}
```

The `externalId` field on the task schema reserves space for this integration. `af pull <ticket-id>` will be the entry point in v2.

---

## Data Requirements

### State Directory Structure

```
.aflow/
├── state/
│   ├── t1.json              # Task state file
│   ├── t1.pipeline.json     # Orchestrator progress for t1
│   ├── t2.json
│   └── ...
├── specs/
│   ├── t1.md                # Spec produced during design phase
│   └── ...
├── config.json              # Preferences (future: tracker config)
└── hooks/                   # Existing hook scripts (unchanged)
```

### Task State File Schema (`t1.json`)

```json
{
  "id": "t1",
  "title": "Browser infrastructure improvements",
  "description": "Five infra improvements to the RPA browser stack...",
  "phase": "design",
  "parent": null,
  "children": ["t1-1", "t1-2", "t1-3", "t1-4", "t1-5"],
  "dependencies": [],
  "branch": null,
  "worktree": null,
  "pr": null,
  "externalId": null,
  "spec": ".aflow/specs/t1.md",
  "qaResult": null,
  "transitions": [
    { "phase": "understand", "timestamp": "2026-03-30T10:00:00Z", "actor": "af start" },
    { "phase": "design", "timestamp": "2026-03-30T10:15:00Z", "actor": "/think" }
  ],
  "createdAt": "2026-03-30T10:00:00Z"
}
```

### Orchestrator State (`t1.pipeline.json`)

```json
{
  "taskId": "t1",
  "currentPhase": "design",
  "completedSkills": ["think", "spec-make", "spec-enrich"],
  "skippedSkills": [],
  "nextSkill": "spec-refine",
  "startedAt": "2026-03-30T10:00:00Z"
}
```

### Config File Schema (`config.json`)

```json
{
  "defaults": {
    "quickMode": false
  }
}
```

---

## Business Rules

**BR-01:** A task's phase can only advance forward: understand → design → implement → verify → ship → done. Backward transitions require `--force`. IF forced backward, THEN all forward phases' artifacts are preserved (not deleted).

**BR-02:** IF a task has `dependencies`, THEN it MUST NOT enter `implement` until all dependencies are in `done`. It MAY enter `understand` and `design` phases regardless of dependencies.

**BR-03:** IF a task has children (is an epic), THEN its phase is the minimum phase across all non-done children. IF all children are `done`, THEN the epic is `done`. An epic cannot be transitioned directly — only its children can.

**BR-04:** IF `af start` is run in a worktree with an active task, THEN resume that task's pipeline. IF no active task exists and no description is provided, THEN prompt for a description.

**BR-05:** IF the design phase produces a spec with multiple workstreams, THEN during the design-to-implement transition the orchestrator decomposes the spec into child tasks. Decomposition MUST preserve dependency ordering from the spec as `dependencies` fields on child tasks. The user confirms before proceeding.

**BR-06:** IF a session dies mid-skill, THEN the task remains in its current phase. The pipeline state file records the last *completed* skill (not the in-progress one). The next `af start` invocation re-runs the incomplete skill from scratch against the latest spec on disk.

**BR-07:** IF `af start --quick` is used, THEN the task is created directly in `implement` phase with a worktree. No spec is produced. Skills that require a spec (`/qa` acceptance criteria) operate against the task description instead.

**BR-08:** IF a design-phase skill's preconditions are not met, THEN the orchestrator skips it, logs the skip in `pipeline.json`, and advances to the next skill.

---

## KPIs and Targets

| KPI | Definition | Target | Confidence | Measurement |
|---|---|---|---|---|
| Pipeline completion rate | % of tasks started via `af start` that reach `done` | >70% within 30 days of launch | Medium | `af state task list --json` filtered by phase |
| Phase drop-off | Which phase tasks stall in most often | <30% stall in any single phase | Medium | Transition history analysis |
| Time in design | Wall-clock time from `understand` to `implement` | <2 hours for non-epic tasks | Medium | Transition timestamps |
| Skill re-run rate | % of skills that had to be re-run due to session death | <20% | Medium | Pipeline state logs |

---

## Open Questions

None remaining for v1 scope.

---

## Code Migration Map

Summary of existing code that must change, organized by action:

### Delete
- `src/tui/` — entire directory (app.tsx, session.ts, backlog.ts, backlog-view.tsx, task-form.tsx, git-sync.ts, spec-gen.ts). TUI is removed.
- `src/commands/start-work.ts` — current `af start` that launches TUI. Replaced by orchestrator.

### Rewrite
- `src/skills/preamble.ts` — `TASK_PREAMBLE` from backlog.json to `af state` (R-24)
- `src/index.ts` — add `state` and `status` subcommand groups, replace `start` command

### Create
- `src/commands/state/` — new directory for `af state` subcommands (task.ts, spec.ts, qa.ts, log.ts)
- `src/commands/status.ts` — `af status` tree view command
- `src/commands/start.ts` — new `af start` orchestrator (replaces start-work.ts)
- `src/lib/state.ts` — state read/write/validate logic
- `src/lib/pipeline.ts` — orchestrator logic (skill sequencing, resume, decomposition)
- `src/lib/session-runner.ts` — simple subprocess wrapper for spawning Claude sessions

### Keep (no changes needed)
- `src/lib/git.ts` — `gitRoot()`, `git()`, `listWorktrees()` all reusable
- `src/lib/config.ts` — `worktreePath()`, `repoName()`, `isProtected()` all reusable
- `src/lib/worktree.ts` — `createWorktree()`, `ensureWorktree()` all reusable
- `src/lib/hooks.ts` — `runHook()` reusable
- `src/lib/fmt.ts` — formatting utilities reusable
- `src/lib/version.ts`, `src/lib/update-check.ts` — reusable
- `src/commands/create.ts`, `checkout.ts`, `list.ts`, `delete.ts`, `cleanup.ts` — worktree commands unchanged
- `src/commands/install-skills.ts`, `init-hooks.ts`, `upgrade.ts` — unchanged
- `src/skills/` — all skill source files unchanged (only preamble.ts changes)
