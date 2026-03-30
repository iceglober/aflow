<p align="center">
  <h1 align="center">aflow</h1>
  <p align="center">
    AI workflows for product and engineering.<br/>
    Design specs. Write code. Ship it. All from Claude Code slash commands.
  </p>
</p>

---

## Quick Start

```bash
curl -fsSL https://raw.githubusercontent.com/iceglober/aflow/main/install.sh | bash
af skills
```

> Requires Node.js 20+ and [GitHub CLI](https://cli.github.com). That's it.

### Idea to production in 7 commands

```bash
/research-web Build a multi-tenant billing system with usage-based pricing

/spec-make research/billing focused on metering and invoicing

/spec-enrich research/billing/spec-metering.md        # autonomous — reads your codebase

/spec-refine research/billing/spec-metering-v2.md     # interactive — you answer unknowns

/work Add usage metering API per spec R-01 through R-05

/qa                                                    # verify against acceptance criteria

/ship                                                  # typecheck → review → commit → push → PR
```

---

## Design Pipeline

Turn an idea into an airtight spec with tracked unknowns.

| | Skill | |
|---|---|---|
| **Research** | `/research-web` | Parallel web research agents produce a synthesis |
| **Structure** | `/spec-make` | Research _or description_ becomes a spec with unknowns |
| **Enrich** | `/spec-enrich` | Resolves unknowns from your codebase autonomously |
| **Refine** | `/spec-refine` | Walks through unknowns 1-by-1 with you |
| **Audit** | `/spec-review` | Finds gaps, conflicts, and opportunities |
| **Validate** | `/spec-lab` | Runs binary yes/no experiments against unknowns |

```
/research-web  →  /spec-make  →  /spec-enrich  →  /spec-refine × N  →  /spec-review
    (web)        (structure)      (codebase)        (human)              (audit)
                                                                           ↕
                                                                       /spec-lab
                                                                      (validate)
```

`/spec-make` works from research output or a plain description:
```
/spec-make research/billing focused on metering
/spec-make A CSV export feature with configurable column selection
```

---

## Engineering Pipeline

Ship features with structure.

| | Skill | |
|---|---|---|
| **Plan** | `/think` | Forces "why" before "how" |
| **Build** | `/work` | Implement from a description — pulls latest, branches, codes |
| **Build** | `/work-backlog` | Work through a `.aflow/backlog.json` checklist |
| **Fix** | `/fix` | Targeted bug fixes within task scope |
| **Test** | `/qa` | Diff vs. acceptance criteria — PASS/FAIL per scenario |
| **Ship** | `/ship` | Typecheck → review → commit → push → PR |

---

## Research & Browser

| | Skill | |
|---|---|---|
| **Experiment** | `/research-auto` | Autonomous think-test-reflect loop until a metric target is hit |
| **Browse** | `/browser` | Navigate, interact, scrape, and screenshot with a real browser |

```
/research-auto Optimize p99 latency of /api/billing/usage endpoint
```

`/browser` is auto-activated by `/qa` for UI testing and `/ship` for PR screenshots. Powered by [Playwright MCP](https://github.com/microsoft/playwright-mcp).

---

## Worktrees

```bash
af wt create feature-auth          # new branch + worktree
af wt checkout feature-payments     # from existing remote branch
af wt list                          # show all
af wt cleanup                       # delete merged/stale
```

---

## Auto-Claude `alpha`

`af start` launches a TUI running engineering skills across a task backlog with parallel Claude sessions. Tasks support `dependencies` — blocked tasks won't start until their deps ship.

![aflow TUI](assets/tui.png)

---

<p align="center">MIT License</p>
