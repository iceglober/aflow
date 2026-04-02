---
name: product-prd-new
description: Use when creating a PRD from a completed discovery document, when the user wants to turn research into buildable requirements, or when engineering needs a requirements doc for a feature
---

# Product PRD — New

```
THE IRON LAW: A PRD DEFINES WHAT TO BUILD AND WHY. NOT HOW TO BUILD IT.
If you're making implementation decisions, you're writing a tech spec. Stop.
```

## Overview

Creates a Product Requirements Document from a completed discovery doc. The PRD is the bridge between research and engineering — it defines requirements and acceptance criteria without making implementation choices.

## Process

### Step 0: Pre-flight checks

Before writing anything:

1. **Read the discovery doc completely.** The PRD's scope boundary IS the discovery doc's scope. Nothing more.
2. **Count open questions.** Questions tagged [USER] or [ENGINEERING] that affect requirements are BLOCKERS. List them. Do not fill them with assumptions.
3. **Check for prioritization signals.** If the discovery doc has none, you MUST ask the user before inventing priorities.

```
HARD GATE: Do not write a PRD with fabricated priorities.
"Top 15 of 47 rules covers 80% of cases" — WHERE DID THAT NUMBER COME FROM?
If you can't cite a source, you made it up. Ask the user instead.
```

### Step 1: Scope lock

The PRD covers EXACTLY what the discovery doc covers. No more.

```
BANNED ADDITIONS:
- Features you know about from training data that "modern systems usually have"
- "Future Considerations" sections that smuggle scope back in
- "Nice to have" lists sourced from your domain knowledge
- "Suggested additions" outside discovery scope

If it's not in the discovery doc, it's not in the PRD.
The user said "comprehensive" — that means comprehensive ABOUT THE DISCOVERY SCOPE,
not comprehensive about the entire domain.
```

### Step 2: Requirements, not implementation

For each section, write WHAT the system must do + acceptance criteria. Never specify HOW.

```
PRD (correct):
  "System must convert prices between supported currencies with rounding
   rules per currency as defined in the Rules & Requirements section.
   Acceptance: converted amounts match expected values for all test
   currency pairs in the validation suite."

TECH SPEC (wrong — you're making implementation decisions):
  "Use ECB as the rate provider with 60-second cache TTL.
   Store rates in Redis with a staleness threshold of 6 hours.
   Use Pagar.me as the BRL acquirer."

The difference: PRD says WHAT must be true. Tech spec says HOW to make it true.
Cache TTL, vendor selection, and storage mechanism are engineering decisions.
```

### Step 3: Numbers must have sources

```
HARD RULE: Every number in the PRD must trace to the discovery doc or the user.

BANNED: "4.7% cart abandonment" (from where?)
BANNED: "$2.1M ARR at risk" (who calculated this?)
BANNED: "Top 15 rules cover 80% of cases" (based on what data?)

If the discovery doc doesn't contain the number and the user didn't provide it,
you CANNOT include it. Leave a [DATA NEEDED] placeholder instead.
```

### Step 4: Open questions are gaps, not fill-in-the-blanks

When the discovery doc has unresolved questions:

1. **Do NOT resolve them yourself.** You don't have the context. The discovery doc tagged them [USER] or [ENGINEERING] for a reason.
2. **Carry them forward as blockers.** List them in a Blockers section with impact ("cannot define acceptance criteria for X until this is resolved").
3. **Do NOT invent answers and mark them as assumptions.** Assumptions become invisible requirements. A [BLOCKER] stays visible.
4. **Unblocking path:** If the user wants to resolve a blocker NOW, they make the call — you write their decision as a requirement with them as the source. "User decided: PDF only for v1" is a requirement. "Best guess: probably PDF only" is not.

### Step 5: Prioritization protocol

If the discovery doc has no prioritization:

1. **Ask the user.** "The discovery doc has 47 business rules and 12 integrations with no priority ranking. Before I write the PRD, I need to know: what's the MVP? What ships first?"
2. **Do NOT invent tiers.** No "Sprint 1 / Sprint 2 / Future" without user input.
3. **Do NOT estimate coverage percentages.** "Top 15 rules = 80% of cases" requires data you don't have.
4. If the user says "just write it, we'll prioritize later" — write it flat (no tiers) and note that prioritization is pending.

## PRD Structure

1. **Problem Statement** — What problem this solves and for whom. From discovery doc's scope.
2. **Requirements** — Organized by domain area from discovery doc. Each requirement has:
   - Requirement ID (REQ-001)
   - Description (WHAT, not HOW)
   - Acceptance criteria (testable conditions)
   - Source (which discovery doc section)
   - Priority (from user, or "UNRANKED" if not provided)
3. **Data Requirements** — What data from each system, field-level. From discovery doc's Data Contracts.
4. **Integration Requirements** — System boundaries. From discovery doc's Integration Inventory.
5. **Error Handling Requirements** — Required behavior per error class. From discovery doc's Failure Taxonomy.
6. **Blockers** — Unresolved open questions from discovery doc that affect requirements.
7. **Out of Scope** — Explicitly excluded. From discovery doc's scope boundaries.

**Sections that do NOT belong in a PRD:**
- Implementation details (tech stack, architecture, vendor selection)
- "Future Considerations" or "Nice to Have" sourced from training data
- Business case / ROI / market sizing (separate artifact)
- Success metrics without user input (you don't know what to measure)
- Glossaries (from discovery doc or separate onboarding doc)

**Output path:** `docs/product/{slug}/prd.md`

## Red Flags — STOP

- About to specify a vendor, library, or technical approach — you're writing a tech spec. STOP.
- About to add a feature not in the discovery doc — scope creep. STOP.
- About to write a number you can't trace to the discovery doc or user — fabrication. STOP.
- About to invent priority tiers without user input — ask first. STOP.
- About to resolve an open question yourself — carry it as a blocker. STOP.
- About to add a "Future Considerations" section — scope smuggling. STOP.
- About to write "the system should" without testable acceptance criteria — vague requirement. REWRITE.
- About to estimate percentage coverage ("covers 80% of cases") — with what data? STOP.

## Common Rationalizations

| Excuse | Reality |
|--------|---------|
| "The user said comprehensive" | Comprehensive about the discovery scope, not the entire domain. |
| "Modern systems usually include this feature" | If it's not in the discovery doc, it's not in the PRD. |
| "I'll add it as a suggestion, not a requirement" | Suggestions become soft requirements. Out of scope means out. |
| "I need to specify the approach for clarity" | Specify the requirement and acceptance criteria. Engineering picks the approach. |
| "I can estimate priority from the domain" | Priority comes from the user, not your domain knowledge. |
| "I'll mark it as an assumption" | Assumptions become invisible. Blockers stay visible. |
| "A PRD without numbers looks incomplete" | A PRD with fabricated numbers looks authoritative and wrong. |
| "Future Considerations is standard in PRDs" | Not when it's sourced from your training data instead of the user. |
| "This is the obvious implementation" | Then engineering will choose it themselves. Don't bake it in. |
