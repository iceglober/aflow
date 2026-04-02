---
name: product-pipeline
description: Use when running the full discovery-to-PRD product documentation pipeline, when iterating between discovery and PRD phases, or when the user wants to take a product idea from zero to buildable requirements
---

# Product Pipeline — Discovery to PRD

```
THE IRON LAW: DISCOVERY IS THE SOURCE OF TRUTH. PRD IS A DERIVATIVE.
Never write requirements for things you haven't researched. Never research things you don't need requirements for.
```

## Overview

Orchestrates the iterative discovery → PRD pipeline. Manages phase gates, tracks document state, and enforces the rule that information flows from discovery to PRD — never the reverse.

## Phase Model

```
DISCOVER ──gate──> REQUIRE ──gate──> DELIVER
   ↑                  │
   └──── iterate ─────┘
```

The pipeline has three phases. You can only move forward through gates. You can iterate backward, but only by updating discovery first.

| Phase | Skill | Output | Done When |
|-------|-------|--------|-----------|
| **DISCOVER** | /product-discovery-new, /product-discovery-refine, /product-discovery-user | discovery.md | Gate 1 passes |
| **REQUIRE** | /product-prd-new, /product-prd-refine | prd.md | Gate 2 passes |
| **DELIVER** | Hand off to user | Final PRD | User accepts |

## Phase Gates

### Gate 1: Discovery → PRD

Before starting the PRD, check ALL of these:

```
GATE 1 CHECKLIST:
□ Discovery doc exists at docs/product/{slug}/discovery.md
□ Section 1 (What This Product Does) has clear scope boundaries
□ Section 4 (Rules & Requirements) has decision-rule tables, not just prose
□ Section 7 (Integration Inventory) lists all systems with direction and status
□ Open Questions: count [USER] questions that affect requirements

IF [USER] questions affect requirements → STOP. Present them to the user.
  "These N questions need your input before I can write requirements.
   I can write a partial PRD around them, but these will be blockers."
  User chooses: resolve now, or proceed with blockers.

IF discovery is thin (missing sections, mostly [UNVERIFIED]) → STOP.
  "Discovery needs more research before I can write meaningful requirements.
   Sections X, Y, Z are thin. Should I run /product-discovery-refine first?"

GATE 1 PASSES when: user explicitly says to proceed to PRD.
```

Do NOT silently pass Gate 1. Always present the gate check results to the user.

### Gate 2: PRD → Deliver

Before declaring the PRD final:

```
GATE 2 CHECKLIST:
□ Every requirement has an acceptance criterion
□ Every [DATA NEEDED] is either filled (with source) or acknowledged by user as deferred
□ Every blocker is either resolved (with source) or explicitly deferred by user
□ Out of Scope section matches discovery doc scope boundaries
□ No requirements reference systems/features not in the discovery doc

GATE 2 PASSES when: user accepts the PRD.
```

## Iteration Protocol

The most valuable part of this pipeline is iteration — PRD work reveals discovery gaps, which improve the discovery doc, which improve the PRD.

### When PRD reveals a discovery gap

During PRD creation, you will find things the discovery doc doesn't cover but should. This is normal and good.

```
ITERATION RULE: Discovery first. Always.

1. STOP writing the PRD
2. Name the gap: "I need X to write this requirement, but discovery doesn't cover it"
3. Ask: research it (/product-discovery-refine) or ask the user (/product-discovery-user)?
4. Update the discovery doc
5. THEN resume the PRD

NEVER: Write a PRD requirement for something not in the discovery doc.
NEVER: Add information to the PRD that should be in discovery.
NEVER: "I'll add it to both" — discovery is the source, PRD is the derivative.
```

### When user decisions update discovery

When the user resolves a blocker or makes a product decision:

1. Update the discovery doc FIRST (via /product-discovery-refine)
2. THEN sync the PRD (via /product-prd-refine)
3. Check if the change unblocks any other PRD blockers
4. Check if the change invalidates any existing PRD requirements

```
SYNC DIRECTION: Discovery → PRD. One-way. Always.
```

### When stakeholder feedback arrives

Classify before acting:

| Feedback Type | Route To |
|---------------|----------|
| New domain information | Discovery doc first → then PRD sync |
| Scope expansion | Discovery scope check first → reject or expand with full discovery |
| Requirement change within scope | PRD directly (scope already covered in discovery) |
| Priority ranking | PRD directly (not a discovery concern) |
| Implementation preference | REJECT — neither discovery nor PRD |

## Running the Pipeline

The pipeline runs AUTONOMOUSLY through each phase, only stopping at designated user checkpoints. Do not pause between autonomous steps to ask permission — chain them and keep going.

### Starting from zero (user has a product idea)

```
PHASE 1: DISCOVERY RESEARCH [AUTONOMOUS]
──────────────────────────────────────────
1. Assess blurb completeness (per /product-discovery-new Step 0)
   - Thin blurb? Ask for context. Do NOT start researching.
   - Rich blurb? Proceed.

2. Run /product-discovery-new
   - Parse blurb, dispatch 3 research subagents
   - Assemble discovery.md
   - Do NOT stop here — proceed directly to checkpoint.

───── USER CHECKPOINT 1: FOCUS CHECK ─────
Present a brief summary:
  - "Here's what I researched and the scope I landed on."
  - "Does this have the right focus? Anything major missing or off-target?"
Wait for user confirmation or correction.
If user corrects focus → adjust and re-run relevant research.
If user confirms → proceed.
───────────────────────────────────────────

PHASE 2: DISCOVERY ENRICHMENT [AUTONOMOUS]
──────────────────────────────────────────
3. Run /product-discovery-user
   - Interview the user to fill gaps research couldn't answer
   - Focus on [USER]-tagged open questions and system-specific unknowns
   - Update discovery via /product-discovery-refine with interview findings

4. Run /product-discovery-refine (research mode)
   - Identify thin sections, [UNVERIFIED] content, sparse tables
   - Dispatch research subagents to fill gaps
   - Update discovery doc

   Do NOT stop between steps 3 and 4 — chain them.

PHASE 3: PRD CREATION [AUTONOMOUS]
──────────────────────────────────────────
5. Check Gate 1
   - If [USER] questions remain that block requirements, ask them NOW
     (quick focused questions, not a full interview)
   - Proceed once answered or deferred

6. Run /product-prd-new
   - Produce prd.md with blockers carried forward

7. Run /product-prd-refine (research mode) — FIRST PASS
   - Identify researchable gaps in the PRD
   - Update discovery doc with research findings
   - Sync enriched discovery to PRD

8. Run /product-prd-refine (research mode) — SECOND PASS
   - Catch anything the first pass missed or that the first pass revealed
   - Focus on: ACs that reference thin discovery sections, payer quirks
     that affect routing requirements, rule tables that could be expanded
   - Update discovery, sync to PRD

   Do NOT stop between steps 5–8 — chain them.

───── USER CHECKPOINT 2: REVIEW & FINALIZE ─────
Present a brief summary of what was researched and strengthened.
Then DIRECTLY ask any [USER]-tagged blocking questions that remain —
do NOT present a menu of options. Ask the questions, get answers,
update discovery → sync PRD, and present the final PRD for acceptance.

If the user provides feedback or corrections, iterate:
  - User resolves blockers → update discovery → sync PRD
  - User provides [DATA NEEDED] values → update PRD
  - User requests changes → classify and route per Iteration Protocol

DO NOT: List unchanged items (blockers, [DATA NEEDED]) as a status report.
DO NOT: Present numbered options ("1. Resolve blockers, 2. Fill DATA NEEDED...").
DO NOT: Ask "what would you like to do?" — just do the next thing.

Check Gate 2 after each round of feedback.
Gate 2 passes when user accepts the PRD.
─────────────────────────────────────────────────
```

### Starting mid-pipeline (discovery exists, need PRD)

```
1. Read the discovery doc
2. Check Gate 1 — ask any blocking [USER] questions
3. Run Phases 3 autonomously (steps 6–8 above)
4. Present at User Checkpoint 2
```

### Starting mid-pipeline (both exist, need iteration)

```
1. Read both docs
2. Run /product-prd-refine (research mode) — two passes
3. Present at User Checkpoint 2
```

### Autonomous execution rules

```
DO: Chain research steps without pausing for confirmation.
DO: Run discovery-refine and prd-refine back-to-back.
DO: Ask quick focused questions inline when they unblock the next step.

DO NOT: Stop after every skill to ask "ready to continue?"
DO NOT: Present intermediate artifacts for review between autonomous steps.
DO NOT: Present numbered option menus — just do the next step.
DO NOT: List unchanged items as status reports (the user knows what hasn't changed).
DO NOT: Skip the user interview — it fills gaps research cannot.
DO NOT: Skip the second PRD refine pass — the first pass reveals new gaps.
```

## State Tracking

At any point, if the user asks "where are we?", report:

```
Phase: DISCOVER | REQUIRE | DELIVER
Discovery: exists/missing — N open questions (X [USER], Y [ENGINEERING], Z [RESEARCH])
PRD: exists/missing — N requirements, M blockers, K [DATA NEEDED]
Last action: [what you did last]
Next action: [what should happen next]
```

## Red Flags — STOP

- About to write a PRD requirement for something not in the discovery doc — STOP. Update discovery first.
- About to skip Gate 1 because "the discovery doc looks good enough" — STOP. Run the checklist.
- About to update the PRD without checking if discovery was updated first — STOP. Sync direction matters.
- About to resolve a [USER] question yourself to unblock the PRD — STOP. Ask the user.
- About to do discovery and PRD in one document — STOP. They are separate artifacts with different purposes.
- About to skip the user interview because "research covers it" — STOP. Research covers the domain. The user covers THEIR system.
- User said "just give me the PRD" and you're about to skip discovery — STOP. A PRD without discovery is fiction.
- About to add implementation details because "the PRD needs to be actionable" — STOP. Actionable = clear requirements, not tech choices.

## Common Rationalizations

| Excuse | Reality |
|--------|---------|
| "Discovery is done enough" | Run the gate checklist. Your intuition is not a gate. |
| "I can do discovery and PRD together to save time" | You'll produce a document that's half-verified, half-requirement, with no clear seam. |
| "The user said 'just give me the PRD'" | A PRD without discovery is requirements you invented. Push back once. |
| "I'll add it to the PRD and update discovery later" | Later never comes. Discovery first, always. |
| "This engineering question has an obvious answer" | Obvious to you ≠ correct for their system. Carry it as a blocker. |
| "The user doesn't want to be interviewed" | They don't want to waste time. Ask focused questions from discovered gaps, not a domain audit. |
| "Research covers everything" | Research covers the domain. Only the user covers their payer mapping, their partner contract, their RPA framework. |
| "I already know the domain well" | You know the domain. You don't know their system. Interview anyway. |
| "Gate checks slow things down" | Catching a missing section now is faster than rewriting the PRD later. |
| "I should present the user's options" | Just do the next step. If you need a decision, ask the specific question — don't present a menu. |
