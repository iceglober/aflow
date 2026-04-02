---
name: product-prd-refine
description: Use when updating an existing PRD with stakeholder feedback, resolving blockers with user decisions, tightening acceptance criteria, researching to strengthen requirements, or re-syncing PRD with an updated discovery doc
---

# Product PRD — Refine

```
THE IRON LAW: THE DISCOVERY DOC IS THE SCOPE BOUNDARY. THE USER IS THE DECISION MAKER.
You are a scope guardian and a scribe — not a product manager.
```

## Overview

Updates an existing PRD with feedback, user decisions, research, or discovery doc changes. Can autonomously research to strengthen existing requirements. Enforces scope boundaries and prevents the three most common PRD corruption modes: fabricated numbers, blocker laundering, and scope creep.

## Process

### Step 0: Load the scope anchor

Before evaluating ANY feedback, re-read:
1. The PRD's Out of Scope section
2. The discovery doc's Section 1 ("What This Product Does")
3. The PRD's Blockers section

These three define the boundaries of every change you can make.

### Step 1: Classify each change request

Categorize EVERY piece of feedback before acting:

| Category | Action |
|----------|--------|
| **In-scope correction** — fixes wrong info in existing requirements | Apply directly |
| **Acceptance criteria tightening** — makes existing ACs more testable | Apply, but numbers must have sources |
| **Research enrichment** — strengthens existing requirements with verifiable facts | Research via discovery doc first, then sync PRD. See Research Mode. |
| **Blocker resolution** — user makes a decision on an open question | Write the decision as a requirement with the user as source |
| **Discovery doc sync** — discovery was updated, PRD must reflect it | Update requirements to match, add new ones if discovery added scope |
| **Scope expansion** — adds requirements for things outside discovery scope | REJECT. The discovery doc is the scope boundary. |
| **Number fabrication** — fills [DATA NEEDED] with invented values | REJECT. Only the user can provide these numbers. |
| **Priority assignment** — adds or changes priority tiers | Apply ONLY if the user provides the ranking. Never invent tiers. |

Present this classification to the user BEFORE making changes.

### Step 1.5: Research Mode

When invoked without specific feedback (just a PRD path) or with "research to strengthen this," the skill enters Research Mode.

```
RESEARCH MODE FLOW:
1. Read the PRD and discovery doc
2. Identify RESEARCHABLE gaps (see table below)
3. Research via /product-discovery-refine — update the DISCOVERY DOC first
4. Sync the updated discovery doc to the PRD
5. Present changes to the user

DISCOVERY FIRST. ALWAYS. Research never goes directly into the PRD.
```

#### What IS researchable

| Gap Type | Example | Action |
|----------|---------|--------|
| Thin acceptance criteria that reference discovery sections | "per the discovery doc's Attachment Requirements table" but the table is sparse | Research to enrich the discovery doc section, then sync to tighten the AC |
| Requirements referencing unverified discovery content | Discovery section tagged [UNVERIFIED] | Research to verify/correct in discovery, then sync |
| Missing domain rules that affect existing requirements | Bundling rules table has 7 entries but the domain has more | Research to expand the discovery table, then sync |
| Competitive gaps that inform requirements | "match or beat Vyne Trellis" but no specific benchmark | Research competitor capabilities in discovery, then sync |

#### What is NOT researchable (still requires user/engineering)

| Gap Type | Example | Why Research Can't Fix It |
|----------|---------|---------------------------|
| [DATA NEEDED] placeholders | SLA targets, alert thresholds, retry policies | These are BUSINESS DECISIONS, not facts. Industry benchmarks ≠ your SLA. |
| [BLOCKER] items | Eaglesoft write-back, provider onboarding ownership | These require decisions from people, not facts from the internet. |
| New requirements not in discovery | "Add audit trail requirements" | Scope expansion — even if research finds it's important. |
| Implementation choices | "Use exponential backoff for retries" | Tech spec territory, not PRD. |

```
THE RESEARCH TRAP: "I'll research industry benchmarks to fill the SLA placeholder."

Industry benchmark ≠ your SLA commitment.
"Clearinghouses typically respond in 30 seconds" does NOT mean your SLA is 30 seconds.
The user must decide their SLA. Research cannot replace that decision.

[DATA NEEDED] stays [DATA NEEDED] regardless of how much you research.
Blockers stay blockers regardless of how much you research.
```

#### Research Mode output

After research, briefly report what changed:
1. What was researched and where it was added to the discovery doc
2. Which PRD requirements were strengthened as a result
3. Any new open questions the research revealed

DO NOT list unchanged items ([DATA NEEDED] placeholders, unresolved blockers).
DO NOT present a menu of options. The orchestrating skill handles next steps.

### Step 2: The three corruption modes

#### Corruption Mode 1: Number fabrication

```
[DATA NEEDED] IS A CONTRACT, NOT A GAP TO FILL.

BANNED: Replacing [DATA NEEDED] with "reasonable defaults"
BANNED: "99.9% uptime" / "200ms p95" / "3 second response time" from training data
BANNED: Adding specific numbers to acceptance criteria without a source

A [DATA NEEDED] placeholder is MORE VALUABLE than a plausible-sounding number.
The placeholder forces a decision. The number buries it.
```

When the user asks you to "just pick reasonable defaults":
1. Push back ONCE: "These numbers may end up in engineering SLAs or customer contracts. I can suggest ranges for you to choose from, but the decision needs to be yours."
2. If the user insists, present OPTIONS with tradeoffs, not single values. Let the user pick.
3. Tag every user-chosen number: "Source: user decision [date]"

#### Corruption Mode 2: Blocker laundering

```
BLOCKERS CANNOT BE RESOLVED BY THE AGENT. PERIOD.

A blocker is tagged [USER] or [ENGINEERING] because it requires a DECISION
from someone who isn't you. You do not have the context to make that decision.

"Assumption [EA-01]: Eaglesoft write-back via Patterson API" ← THIS IS A DECISION DISGUISED AS AN ASSUMPTION.
You just decided the integration approach. That's not your call.

BANNED: "Resolving" blockers by making assumptions
BANNED: "Documented assumptions" that make product or business decisions
BANNED: Creating an "assumptions register" to make invention look rigorous

The ONLY way a blocker is resolved:
1. The USER makes a decision → you write it as a requirement with "Source: user decision"
2. An [ENGINEERING] investigation produces facts → you update with "Source: engineering finding"
```

When the user asks you to "resolve blockers as best you can":
1. Explain what each blocker requires and who can resolve it
2. For each blocker, ask the specific question that would resolve it
3. If the user makes the decision live, write it immediately as a requirement
4. If the user defers, the blocker stays. Do not paper over it.

#### Corruption Mode 3: Scope creep

```
THE DISCOVERY DOC IS THE SCOPE BOUNDARY.

"Add monitoring requirements" → is monitoring in the discovery doc? No? → REJECT.
"Add denial management" → is denial management in the discovery doc? No? → REJECT.
"Make it more comprehensive" → comprehensive ABOUT WHAT'S ALREADY IN SCOPE.

Comprehensive ≠ wider. Comprehensive = deeper within the existing boundary.
```

When asked to add requirements outside discovery scope:
1. Name the scope boundary that excludes it
2. Offer to create a separate discovery doc for the new domain
3. If the request is borderline, ask ONE clarifying question
4. Do not add it "but note it's aspirational" — that's scope creep wearing a disclaimer

### Step 3: Tightening acceptance criteria

When asked to make ACs more testable:

```
GOOD tightening: making conditions specific and verifiable
  Before: "System handles errors gracefully"
  After:  "System surfaces error to correction queue with human-readable description"

BAD tightening: inventing specific numbers
  Before: "System processes claims promptly"
  After:  "System processes claims within 3 seconds" ← WHERE DID 3 SECONDS COME FROM?

If the current AC has no number, adding one requires a source.
If the current AC has [DATA NEEDED], that's not an invitation to invent.
```

You CAN make ACs more testable by:
- Adding specific conditions (given/when/then structure)
- Referencing discovery doc tables and rules by name
- Making pass/fail criteria unambiguous
- Breaking compound ACs into individual testable assertions

You CANNOT make ACs more testable by:
- Inventing SLAs, latency targets, or throughput numbers
- Adding implementation-specific conditions (database response time, cache hit rate)
- Referencing systems or tools not in the discovery doc

### Step 4: Discovery doc sync

When the discovery doc has been updated and the PRD must reflect changes:

1. Diff the discovery doc changes
2. For each change, determine if it adds, modifies, or removes a requirement
3. Update affected requirements — do not rewrite the entire PRD
4. Check if any resolved discovery questions unblock PRD blockers
5. Check if any new discovery open questions create new PRD blockers

```
SYNC DIRECTION: Discovery → PRD. Never the reverse.
If PRD work reveals a discovery gap, update discovery FIRST, then sync to PRD.
```

## Output

After applying changes, provide a brief change summary:
- Requirements added (with IDs)
- Requirements modified (with IDs and what changed)
- Blockers resolved (with source of resolution)
- Requests rejected (with reason)

DO NOT list unchanged blockers or [DATA NEEDED]. DO NOT present options or ask "what next?"

## Red Flags — STOP

- About to write a number that isn't in the discovery doc or from the user — STOP. Use [DATA NEEDED].
- About to "resolve" a blocker by making an assumption — STOP. Ask the user.
- About to add a requirement for something not in the discovery doc — STOP. That's scope creep.
- About to create priority tiers the user didn't provide — STOP. Ask first.
- About to create an "assumptions register" — STOP. That's blocker laundering with a pretty label.
- The user said "comprehensive" and you're about to add monitoring, logging, alerting — STOP. Those aren't in the discovery doc.
- About to update the PRD without checking if the discovery doc was updated first — STOP. Sync direction matters.
- About to fill [DATA NEEDED] with "industry benchmarks" — STOP. Benchmarks ≠ your SLA.
- About to add research findings directly to the PRD without updating discovery first — STOP. Discovery first, always.
- About to convert a blocker into a requirement via research — STOP. Blockers need decisions, not facts.

## Common Rationalizations

| Excuse | Reality |
|--------|---------|
| "I'll label it as an assumption" | Labeled assumptions are invisible decisions. Blockers stay visible. |
| "These are reasonable defaults" | Reasonable to whom? The user hasn't decided. [DATA NEEDED] is more honest. |
| "The engineer needs specific numbers to build" | The engineer needs CORRECT numbers. Wrong numbers are worse than placeholders. |
| "I'm just making the AC testable" | Testable ≠ specific numbers. Testable = unambiguous pass/fail conditions. |
| "Monitoring is table stakes for any system" | If it's not in the discovery doc, it's not in the PRD. Propose a discovery update. |
| "The user said to resolve the blockers" | The user doesn't know that your 'resolution' is an invention. Push back once, then ask. |
| "I'll add options for the user to choose" | Options are fine. Single values presented as defaults are not. |
| "The stakeholder asked for this feature" | Test it against the discovery scope. Stakeholder authority doesn't override scope. |
| "I'm being helpful by filling gaps" | You're being helpful by protecting the document's integrity. Gaps are honest. |
| "Industry benchmarks are a reasonable starting point for SLAs" | Industry benchmarks ≠ your commitment. The user must decide, not research. |
| "Research can resolve this blocker" | Blockers need decisions from people. Facts from the internet don't make product decisions. |
| "I'll add the research directly to the PRD to save time" | Discovery first. Always. Skipping discovery breaks traceability. |
| "This requirement is weak, let me add one from my research" | Strengthen existing requirements, don't add new ones. New scope requires discovery. |
