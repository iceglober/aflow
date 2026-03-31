# Aflow v1.0 — Workflow Orchestrator for Agent-First Engineering

**Status:** Draft v2
**Date:** 2026-03-30
**Scope:** Replace aflow's static backlog with a structured state machine that orchestrates the full engineering lifecycle (understand → design → implement → verify → ship), enforced through CLI state commands. Each pipeline skill runs as a separate Claude session with the spec on disk as the handoff artifact.
**Source:** /think session + /spec-refine session, 2026-03-30

## Changelog (v1 → v2)

### Resolved
- **U-06** → `af state` resolves `.aflow/state/` from main worktree via `gitRoot()`. Skills call `af state`, never read files directly.
- **U-08** → Each skill runs as a separate session. Spec on disk is the handoff artifact. Eliminates context window risk.
- **U-03** → Resumability = re-run current skill from scratch against latest state. No session-level resume needed.
- **U-05** → Claude proposes decomposition, user confirms. Low risk.
- **U-01, U-02, U-07** → Linear integration deferred to v2. Only entry path is `af start "description"`.

### Deferred
- **U-04** → Concurrent session limits. Deferred until parallel workstreams are built.

### Decisions
- **OQ-01 → (b)** TUI killed. `af start "desc"` runs pipeline, `af status` for visibility.
- **OQ-02** → Specs live in `.aflow/specs/` in main repo, accessed via `af state spec show`.
- **OQ-03** → No locking for v1. Each task has its own file, sequential execution.
- **OQ-04 → (c)** Fixed pipeline with intelligent skipping. Configurable later.
- **OQ-05 → (a)** One PR per workstream, merged independently.

### Requirements removed
- R-20, R-21, R-29, R-30 (Linear/external tracker — deferred)
- R-25, R-26 (TUI updates — TUI removed)

### Requirements changed
- R-09 rewritten: pipeline orchestrator spawns sequential sessions, not one long session
- R-10 simplified: resumability is re-run current skill, not session resume
- R-19 simplified: single entry path for v1

### Remaining unknowns: 0 (1 deferred)
### Remaining open questions: 0

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
- **Phase:** One of: `understand`, `design`, `implement`, `verify`, `ship`, `done`. Phases are ordered and enforced by the state machine.
- **Spec:** A structured Markdown document produced during the design phase. Lives at `.aflow/specs/{task-id}.md` in the main repo. Accessed exclusively via `af state spec` commands.
- **State:** The structured, machine-readable record of a task's current phase, metadata, and history. Owned exclusively by `af state` — no other process writes to it.
- **Pipeline:** The full sequence of phases a task moves through. Each phase maps to one or more skills, each running as a separate Claude session.
- **Session:** A Claude Code instance executing a single skill against a task. Sessions are ephemeral — state survives on disk, not in the session.
- **Orchestrator:** The `af start` process that manages the pipeline — checks state, determines the next skill, spawns a session, waits for completion, advances state, repeats.
- **Skill session:** One invocation of one skill (e.g., `/spec-make`) in one Claude session. The spec on disk is the input and output.

---

## Requirements

### State Management (`af state`)

**R-01:** `af state` MUST be the sole interface for reading and writing task state. No skill or external process writes state files directly. [MUST]

**R-02:** `af state` MUST validate all inputs against the task schema before writing. Invalid transitions (e.g., `implement` before `design` is complete) MUST be rejected with an actionable error message. [MUST]

**R-03:** Task state MUST be stored in `.aflow/state/` in the main repository root. `af state` resolves this path via `gitRoot()`, making it accessible from any worktree. Each task gets its own file: `.aflow/state/{task-id}.json`. [MUST]

**R-04:** `af state` MUST support the following subcommands: [MUST]

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
| decompose | User confirms workstream breakdown (if epic) | YES | Single-workstream task |
| implement | `/work` per workstream; `/research-auto` if spec prescribes it | No | — |
| verify | `/qa` per workstream; `/browser` if UI testing | No | — |
| ship | `/ship` per workstream | No | — |

**R-10:** The pipeline MUST be resumable. `af start` checks the current phase and the last completed skill within that phase. If a session died mid-skill, the orchestrator re-runs that skill from scratch — the latest state on disk (spec, task metadata) reflects all previously completed work. [MUST]

**R-11:** `af start` with no arguments in a worktree that has an active task MUST resume that task's pipeline. `af start` with no arguments and no active task MUST prompt for a description. [MUST]

**R-12:** After the design phase, if the spec contains multiple workstreams, the orchestrator MUST decompose the spec into child tasks via `af state spec <id> add-workstream`. The user MUST be prompted to confirm the decomposition before proceeding. [MUST]

**R-13:** During the design phase, each skill session MUST write its output to disk via `af state spec <id> set` before exiting. Partial progress survives session loss. [MUST]

**R-14:** The orchestrator MUST create a worktree for the task (or for each workstream in an epic) before entering the `implement` phase. [MUST]

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

### Orchestrator State

The orchestrator tracks pipeline progress within a phase by recording the last completed skill:

```json
{
  "taskId": "t1",
  "currentPhase": "design",
  "completedSkills": ["think", "spec-make", "spec-enrich"],
  "nextSkill": "spec-refine",
  "startedAt": "2026-03-30T10:00:00Z"
}
```

Stored at `.aflow/state/{task-id}.pipeline.json`. Read by `af start` on resume.

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

**BR-01:** A task's phase can only advance forward: understand → design → implement → verify → ship → done. Backward transitions require `--force`. IF forced backward, THEN all forward phases' artifacts are preserved (not deleted). [depends: R-06]

**BR-02:** IF a task has `dependencies`, THEN it MUST NOT enter `implement` until all dependencies are in `done`. It MAY enter `understand` and `design` phases regardless of dependencies. [depends: R-07]

**BR-03:** IF a task has children (is an epic), THEN its phase is the minimum phase across all non-done children. IF all children are `done`, THEN the epic is `done`. An epic cannot be transitioned directly — only its children can. [depends: R-08]

**BR-04:** IF `af start` is run in a worktree with an active task, THEN resume that task's pipeline. IF no active task exists and no description is provided, THEN prompt for a description. [depends: R-11]

**BR-05:** IF a spec contains numbered workstreams with a dependency graph, THEN decomposition MUST preserve the dependency ordering as `dependencies` fields on child tasks. [depends: R-12]

**BR-06:** IF a session dies mid-skill, THEN the task remains in its current phase. The pipeline state file records the last *completed* skill. The next `af start` invocation re-runs the incomplete skill from scratch against the latest spec on disk. [depends: R-10]

**BR-07:** IF `af start --quick` is used, THEN the task is created directly in `implement` phase with a worktree. No spec is produced. Skills that require a spec (`/qa` acceptance criteria) operate against the task description instead. [depends: R-16]

**BR-08:** IF a design-phase skill's preconditions are not met, THEN the orchestrator skips it and advances to the next skill. The skip is logged in the pipeline state. [depends: R-17]

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
