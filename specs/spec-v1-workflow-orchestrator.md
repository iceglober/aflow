# Aflow v1.0 — Workflow Orchestrator for Agent-First Engineering

**Status:** Draft v1
**Date:** 2026-03-30
**Scope:** Replace aflow's static backlog with a structured state machine that orchestrates the full engineering lifecycle (understand → design → implement → verify → ship), integrated with external issue trackers and enforced through CLI state commands.
**Source:** /think session, 2026-03-30

## Out of Scope

- Multi-repo / monorepo workspace federation
- Automatic Claude session spawning from CI/CD
- Cost tracking / billing per session (deferred — was t8)
- Real-time collaboration (multiple users editing the same spec simultaneously)
- Web dashboard / GUI (CLI + TUI only)
- Migration tooling for existing `backlog.json` users (no users to migrate)
- Custom skill authoring framework (existing skill installation is sufficient)

---

## Unknowns Register

```
UNKNOWN [U-01]: Linear API authentication model for CLI tools
  Assumed: Linear provides personal API tokens or OAuth device flow
  Risk if wrong: Linear integration requires a web-based OAuth flow, complicating CLI-only usage
  Needed from: Linear API docs review
  Blocks: R-20 (af pull)

UNKNOWN [U-02]: Linear data model mapping to aflow task hierarchy
  Assumed: Linear Issues map to tasks; Linear Projects or Cycles map to epics
  Risk if wrong: Schema mismatch forces lossy translation or complex mapping layer
  Needed from: Linear API docs review + team's actual Linear usage patterns
  Blocks: R-20, R-21

UNKNOWN [U-03]: Claude Agent SDK session resumability
  Assumed: Sessions can be restarted with prior context by re-reading state from disk
  Risk if wrong: Pipeline resumability requires custom context reconstruction, not SDK-level resume
  Needed from: Agent SDK docs / experimentation
  Blocks: R-10 (pipeline resumability)

UNKNOWN [U-04]: Concurrent session limits with Claude Agent SDK
  Assumed: Current MAX_CONCURRENT=3 is an aflow limit, not an SDK/API limit
  Risk if wrong: API rate limits or SDK constraints may cap concurrent sessions lower
  Needed from: SDK docs, empirical testing
  Blocks: R-17 (parallel workstreams)

UNKNOWN [U-05]: Spec decomposition automation feasibility
  Assumed: Claude can reliably parse a spec's workstreams into structured task data via af state CLI
  Risk if wrong: Decomposition requires manual user confirmation for every workstream, adding friction
  Needed from: Prototyping with real specs
  Blocks: R-12 (af decompose)

UNKNOWN [U-06]: Optimal state storage format for concurrent worktree access
  Assumed: A single state directory in the main repo (.aflow/) is readable from all worktrees
  Risk if wrong: Worktrees may need local state copies, introducing sync complexity
  Needed from: Git worktree behavior testing (can worktrees read files from main worktree's .aflow/?)
  Blocks: R-03 (state storage)

UNKNOWN [U-07]: Team's actual Linear workflow
  Assumed: Linear usage is light/inconsistent — some tickets exist, many features start ad-hoc
  Risk if wrong: If Linear is more structured than assumed, the "start from scratch" path may conflict with team process
  Needed from: CTO clarification (partially answered — "not super consistent yet")
  Blocks: R-19 (entry path design)

UNKNOWN [U-08]: Skill prompt size limits for full pipeline orchestration
  Assumed: af start can invoke skills sequentially by outputting skill slash-commands for Claude to execute
  Risk if wrong: Context window fills up during long design sessions, losing earlier pipeline context
  Needed from: Empirical testing of full pipeline in a single session
  Blocks: R-09 (pipeline orchestration)
```

---

## Definitions

- **Task:** A unit of work with a defined lifecycle (understand → design → implement → verify → ship). Has a title, description, phase, and optional parent.
- **Epic:** A parent task whose spec decomposes into multiple child tasks (workstreams). An epic does not have its own branch — its children do.
- **Workstream:** A child task within an epic. Has its own branch, worktree, and PR. May depend on other workstreams.
- **Phase:** One of: `understand`, `design`, `implement`, `verify`, `ship`, `done`. Phases are ordered and enforced by the state machine.
- **Spec:** A structured Markdown document produced during the design phase. Lives at `.aflow/specs/{task-id}.md` within the task's worktree (for simple tasks) or the main repo (for epics).
- **State:** The structured, machine-readable record of a task's current phase, metadata, and history. Owned exclusively by `af state` — no other process writes to it.
- **Pipeline:** The full sequence of phases a task moves through. Each phase maps to one or more skills.
- **Session:** A Claude Agent SDK instance operating in a worktree, executing skills against a task.
- **Task source:** The system of record for task definitions. Can be local (aflow-native) or external (Linear, GitHub Issues).
- **Entry path:** How a task enters aflow — either `af start` (from scratch) or `af pull` (from external tracker).

---

## Requirements

### State Management (`af state`)

**R-01:** `af state` MUST be the sole interface for reading and writing task state. No skill, TUI component, or external process writes state files directly. [MUST]

**R-02:** `af state` MUST validate all inputs against the task schema before writing. Invalid transitions (e.g., `implement` before `design` is complete) MUST be rejected with an actionable error message. [MUST]

**R-03:** Task state MUST be stored in `.aflow/state/` in the main repository root, accessible from all worktrees. Each task gets its own file: `.aflow/state/{task-id}.json`. [MUST] [depends: U-06]

**R-04:** `af state` MUST support the following subcommands: [MUST]

| Command | Purpose |
|---|---|
| `af state task create --title "..." [--parent <id>] [--external <url>]` | Create a task |
| `af state task <id> show` | Display task state (JSON or formatted) |
| `af state task <id> transition <phase>` | Move task to next phase |
| `af state task <id> update --field value` | Update task metadata |
| `af state task list [--phase <phase>] [--parent <id>]` | List tasks with filters |
| `af state spec <id> set --content "..."` | Write/replace spec content |
| `af state spec <id> add-workstream --title "..." [--depends-on <ids>]` | Add a workstream to an epic |
| `af state spec <id> show` | Display spec content |
| `af state qa <id> report --status pass\|fail --summary "..."` | Record QA result |
| `af state log <id>` | Show phase transition history |

**R-05:** Every state mutation MUST be logged with a timestamp and the actor (CLI, TUI, or skill name) in a `transitions` array on the task. [MUST]

**R-06:** `af state task <id> transition` MUST enforce the phase order: `understand → design → implement → verify → ship → done`. Backward transitions SHOULD be allowed with a `--force` flag for rework scenarios. [MUST]

### Task Model

**R-07:** A task MUST have the following fields: [MUST]

```
id:           string       — auto-generated (t1, t2, ...)
title:        string       — short description
description:  string       — full context
phase:        Phase        — current lifecycle phase
parent:       string|null  — parent task ID (null for top-level tasks)
children:     string[]     — child task IDs (empty for leaf tasks)
dependencies: string[]     — sibling task IDs that must reach `done` before this task can start `implement`
branch:       string|null  — git branch name
worktree:     string|null  — worktree path
pr:           string|null  — PR URL
externalId:   string|null  — Linear/GH Issue URL or ID
spec:         string|null  — path to spec file
transitions:  Transition[] — phase change history [{phase, timestamp, actor}]
createdAt:    string       — ISO timestamp
```

**R-08:** An epic (task with children) MUST NOT have its own branch or worktree. Its phase is derived from the aggregate state of its children: all children in `done` → epic is `done`; any child in `implement` → epic is `implement`; etc. [MUST]

### Pipeline Orchestration (`af start`)

**R-09:** `af start "<description>"` MUST initiate the full pipeline by guiding Claude through each phase in order. The pipeline phases and their corresponding skills are: [MUST] [depends: U-08]

| Phase | Skills invoked | User gate? |
|---|---|---|
| understand | `/think` (interactive) | YES — user approves direction |
| design | `/spec-make` → `/spec-enrich` → `/spec-refine` → `/spec-lab` → `/spec-review`; `/research-web` as needed | YES — user approves final spec |
| implement | `/work` per workstream; `/research-auto` if spec prescribes experimentation | No (autonomous) |
| verify | `/qa` per workstream; `/browser` if UI testing needed | No (autonomous) |
| ship | `/ship` per workstream | No (autonomous) |

**R-10:** The pipeline MUST be resumable. If a session dies, running `af start` on a task that already exists MUST detect the current phase via `af state task <id> show` and resume from that phase — not restart. [MUST] [depends: U-03]

**R-11:** `af start` with no arguments in a worktree that has an active task MUST resume that task's pipeline. [SHOULD]

**R-12:** After the design phase, if the spec contains multiple workstreams, `af start` MUST decompose the spec into child tasks via `af state spec <id> add-workstream` and create branches/worktrees for each. The user SHOULD be prompted to confirm the decomposition before proceeding. [MUST] [depends: U-05]

**R-13:** During the design phase, `af start` MUST write the spec to disk via `af state spec <id> set` after each skill completes, so partial progress survives session loss. [MUST]

**R-14:** `af start` MUST create a worktree for the task (or for each workstream in an epic) before entering the `implement` phase. [MUST]

**R-15:** For simple tasks (no workstreams), the full pipeline runs in a single worktree. For epics, the understand and design phases run in the main repo, and implement/verify/ship fan out to per-workstream worktrees. [MUST]

### Pipeline Flexibility

**R-16:** Small bugs or features that don't need the full design pipeline SHOULD be supported via `af start --quick "<description>"` which skips the understand and design phases, creating a task directly in the `implement` phase. [SHOULD]

**R-17:** Parallel workstreams within an epic SHOULD be executable in separate concurrent Claude sessions, respecting the dependency graph (a workstream blocks on its dependencies reaching `done`). [SHOULD] [depends: U-04]

**R-18:** `/research-auto` experimentation SHOULD only run when the spec explicitly defines experiment criteria (hypothesis, measurement method). The spec template MUST include an optional "Experiments" section for this purpose. [SHOULD]

### Entry Paths

**R-19:** Aflow MUST support two entry paths that converge on the same pipeline: [MUST] [depends: U-07]

| Entry | Command | Behavior |
|---|---|---|
| From scratch | `af start "description"` | Creates task, enters `understand` phase |
| From external tracker | `af pull <ticket-id>` | Fetches ticket, creates task with `externalId`, enters `understand` phase |

**R-20:** `af pull` MUST fetch the ticket title, description, and any labels/tags from the external tracker and populate the task's `title`, `description`, and `externalId` fields. [MUST] [depends: U-01, U-02]

**R-21:** `af pull` MUST support Linear as the first external tracker. GitHub Issues SHOULD be supported as the second. The adapter interface MUST be defined now even if only Linear ships in v1. [MUST] [depends: U-01, U-02]

### Visibility (`af status`)

**R-22:** `af status` MUST display a tree view of all tasks, showing: [MUST]

| Field | Display |
|---|---|
| Task title | With ID prefix |
| Phase | Color-coded (understand=blue, design=purple, implement=yellow, verify=cyan, ship=green, done=dim) |
| Branch | If assigned |
| Dependencies | Blocked indicator if unmet |
| Children | Indented under parent |
| PR | Link if shipped |

**R-23:** `af status` SHOULD show whether a Claude session is currently active for each task (by checking for running `claude` processes in the task's worktree). [SHOULD]

**R-24:** `af status --json` MUST output machine-readable JSON for scripting and CI integration. [SHOULD]

### TUI Updates

**R-25:** The TUI (`af start` with no args and no active task context) MUST be updated to read from `.aflow/state/` instead of `backlog.json`. The backlog view MUST show the phase for each task instead of the old status field. [MUST]

**R-26:** The TUI MUST allow starting a task's pipeline and viewing active sessions, as it does today. Session management (start, view, kill) MUST continue to work. [MUST]

### Backward Compatibility

**R-27:** The old `backlog.json` format MUST NOT be supported. The file SHOULD be ignored if present. No migration path is required. [MUST]

**R-28:** Existing installed skills (`.claude/commands/*.md`) MUST continue to work standalone (invoked directly by the user) even if no `af state` task exists. Skills SHOULD gracefully degrade: if no active task is found, they operate in ad-hoc mode without state tracking. [MUST]

### External Tracker Adapter Interface

**R-29:** The adapter interface MUST define the following operations: [MUST]

```typescript
interface TaskSource {
  name: string;                                    // "linear", "github", "local"
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

**R-30:** The local task source (no external tracker) MUST be the default. External trackers are opt-in via `af config set tracker linear --token <token>`. [MUST]

---

## Data Requirements

### State Directory Structure

```
.aflow/
├── state/
│   ├── t1.json              # Task state file
│   ├── t2.json
│   └── ...
├── specs/
│   ├── t1.md                # Spec produced during design phase
│   └── ...
├── config.json              # Tracker config, preferences
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
  "externalId": "LIN-142",
  "spec": ".aflow/specs/t1.md",
  "transitions": [
    { "phase": "understand", "timestamp": "2026-03-30T10:00:00Z", "actor": "af start" },
    { "phase": "design", "timestamp": "2026-03-30T10:15:00Z", "actor": "/think" }
  ],
  "createdAt": "2026-03-30T10:00:00Z"
}
```

### Config File Schema (`config.json`)

```json
{
  "tracker": {
    "type": "linear",
    "token": "lin_api_...",
    "teamId": "TEAM-123"
  },
  "defaults": {
    "maxConcurrentSessions": 3,
    "quickMode": false
  }
}
```

---

## Business Rules

**BR-01:** A task's phase can only advance forward in the sequence: understand → design → implement → verify → ship → done. Backward transitions require `--force`. IF a backward transition is forced, THEN all forward phases' artifacts are preserved (not deleted). [depends: R-06]

**BR-02:** IF a task has `dependencies`, THEN it MUST NOT enter `implement` until all dependencies are in `done`. It MAY enter `understand` and `design` phases regardless of dependencies (design can happen in parallel). [depends: R-07]

**BR-03:** IF a task has children (is an epic), THEN its phase is the minimum phase across all non-done children. IF all children are `done`, THEN the epic is `done`. An epic cannot be transitioned directly — only its children can. [depends: R-08]

**BR-04:** IF `af start` is run and the current worktree has an active task, THEN resume that task's pipeline. IF no active task exists, THEN prompt for a description to create a new task. [depends: R-11]

**BR-05:** IF a spec contains numbered workstreams with a dependency graph, THEN decomposition MUST preserve the dependency ordering as `dependencies` fields on child tasks. [depends: R-12]

**BR-06:** IF `af pull` is used and the external tracker has labels, THEN labels containing "bug" or "fix" SHOULD trigger `--quick` mode (skip understand/design) unless the user overrides. [depends: R-16, R-20]

**BR-07:** IF a session dies mid-phase, THEN the task remains in its current phase. The next `af start` invocation detects the phase and resumes. No automatic rollback occurs. [depends: R-10]

**BR-08:** IF `af state task <id> transition ship` is called and the task has an `externalId`, THEN `af state` SHOULD call the tracker adapter's `sync()` to update the external ticket status. IF the sync fails, THEN the local transition succeeds but a warning is printed. [depends: R-29]

---

## KPIs and Targets

| KPI | Definition | Target | Confidence | Measurement |
|---|---|---|---|---|
| Pipeline completion rate | % of tasks started via `af start` that reach `done` | >70% within 30 days of launch | Medium | `af state task list` filtered by phase |
| Phase drop-off | Which phase tasks stall in most often | <30% stall in any single phase | Low | Transition history analysis |
| Time in design | Average wall-clock time from `understand` to `implement` | <2 hours for non-epic tasks | Medium | Transition timestamps |
| Resumability success | % of interrupted sessions that successfully resume | >90% | Low [depends: U-03] | Manual tracking initially |

---

## Open Questions

**OQ-01: Should `af start` always launch the TUI, or should it run inline in the terminal?**
The current `af start` launches a full React/Ink TUI. The new pipeline involves interactive conversation with Claude (via `/think`). These are different interaction models — TUI is a dashboard, pipeline is a conversation. Options: (a) TUI orchestrates by spawning sessions that run the pipeline, (b) `af start "desc"` runs inline and `af start` (no args) launches TUI, (c) TUI is deprecated in favor of `af status` + inline pipeline. **Who decides:** CTO. **Depends on:** R-09, R-25.

**OQ-02: Where do specs live for epics with multiple workstreams?**
Options: (a) Single spec in main repo at `.aflow/specs/{epic-id}.md`, referenced by all children, (b) Spec copied into each workstream's worktree, (c) Spec stays in `.aflow/specs/` and workstreams read it from main. Option (a) is simplest but requires cross-worktree reads. **Who decides:** Engineering. **Depends on:** U-06.

**OQ-03: How does `af state` handle concurrent writes from parallel sessions?**
Two workstreams in an epic running concurrently could both write to `.aflow/state/` at the same time. Options: (a) File-level locking (flock), (b) Each task has its own file so no conflicts, (c) Optimistic concurrency with retry. Option (b) is already specified in R-03 and should avoid most conflicts, but the epic's derived state could still race. **Who decides:** Engineering.

**OQ-04: Should the pipeline skill sequence be configurable per-project?**
The current spec hardcodes understand → design → implement → verify → ship with specific skills. Some projects may not need `/spec-lab` or `/research-web`. Options: (a) Fixed pipeline, skip steps that aren't needed, (b) Configurable pipeline in `config.json`, (c) Fixed pipeline for v1, configurable later. **Who decides:** CTO.

**OQ-05: How should `af ship` handle PRs for workstreams within an epic?**
Options: (a) One PR per workstream, merged independently, (b) One stacked PR chain with dependencies, (c) All workstreams in a single PR. Team currently does one PR per logical change. **Who decides:** CTO.
