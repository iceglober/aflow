---
name: product-discovery-refine
description: Use when updating an existing discovery doc with new information, stakeholder feedback, or when gaps need to be filled — not for creating a new discovery doc from scratch
---

# Product Discovery — Refine

```
THE IRON LAW: A DISCOVERY DOC IS A BUILD REFERENCE. EVERY CHANGE MUST PASS THE DOC-TYPE GATE.
If a requested change doesn't help someone build, it doesn't belong — regardless of who asked.
```

## Overview

Updates an existing discovery document with new information, stakeholder feedback, or gap-fills. Enforces document-type boundaries on every change request.

## Process

### Step 0: Load the doc-type anchor

Before evaluating ANY feedback, re-read the discovery doc's scope statement (Section 1: "What This Product Does"). This is your filter for every change request that follows.

```
FOR EVERY REQUESTED CHANGE, ASK:
  "Does this help someone who already operates in this domain BUILD the next thing?"
  YES → evaluate the change
  NO  → reject, explain why, offer the correct artifact type
```

### Step 1: Classify each change request

Categorize every piece of feedback before acting on any of it:

| Category | Action |
|----------|--------|
| **In-scope correction** — fixes wrong info within existing sections | Apply directly, re-verify via web search |
| **In-scope gap fill** — adds missing info within existing scope | Research and add, mark [VERIFIED] or [UNVERIFIED] |
| **Scope expansion** — adds new domain areas | REJECT. Offer to create a separate discovery doc |
| **Wrong artifact** — glossary, metrics, ROI, onboarding content | REJECT. Name the correct artifact type |
| **Depth change** — more/less detail on existing sections | Apply if it serves build needs, cut if it serves education |

Present this classification to the user BEFORE making changes. Do not start editing until classification is confirmed.

### Step 2: Apply changes with verification

For each approved in-scope change:
1. Web-search to verify any new factual claims
2. Tag new content [VERIFIED] or [UNVERIFIED]
3. Check that new content doesn't duplicate what the team already operates (noise filter from original doc)
4. Update the Integration Inventory if dependencies changed

### Step 3: Scope expansion protocol

When asked to add content from adjacent domains (e.g., "also cover eligibility verification"):

1. **Do NOT add new domain sections to this doc** — even if the CTO asks, even "just a summary"
2. Enrich the Integration Inventory entry for that domain — add richer data contracts, API boundaries, failure modes AT THE INTEGRATION POINT
3. Offer to create a separate discovery doc for the new domain
4. Explain: "A discovery doc that covers 4 domains is a domain textbook, not a build reference"

```
SCOPE EXPANSION IS NOT A COMPROMISE. There is no "add it but note it's out of scope."
That's scope expansion wearing a disclaimer. The doc grows, the signal degrades, the team stops reading it.
```

### Step 4: Contradictory feedback resolution

When stakeholders give conflicting feedback:

1. **Do NOT ask "who is the audience?"** — you already know. A discovery doc is a BUILD REFERENCE for the engineering team.
2. Test each request against the doc-type anchor:
   - "Add error codes" → helps build → IN
   - "Add success metrics" → business case, not build reference → OUT (belongs in PRD)
   - "Remove business context" → if context helps engineers understand WHY to build → KEEP but trim
   - "Add market sizing" → OUT (belongs in PRD or business case)
3. Act on the classification. Do not defer to the user on questions the doc type already answers.

### Step 5: Stale content updates

When updating content that may be outdated:

1. **Never update from training data alone.** Web-search for current information.
2. If you can't verify current state, mark the section [NEEDS VERIFICATION] rather than guessing
3. Ask the user for missing context (e.g., "which tier/plan are you on?") before trimming sections
4. Previous research effort is irrelevant — replace wrong content regardless of how long it took to produce

## Sections That STILL Do Not Belong (Even When Requested)

- Glossaries → separate onboarding doc
- Success metrics / KPIs → PRD
- Market sizing / TAM → business case
- ROI calculations → business case
- Team ramp-up / onboarding plans → separate doc
- Domain education for things the team operates → noise

## Red Flags — STOP

- About to add a glossary "because the CTO asked" — WRONG ARTIFACT. Offer a separate onboarding doc.
- About to add a new domain section "just as a summary" — scope expansion. Enrich Integration Inventory instead.
- Resolving contradictory feedback by "incorporating both" — test each against the doc-type anchor first.
- Updating facts from training data without web verification — SEARCH FIRST.
- Deferring a decision the doc type already answers — act, don't ask.
- About to write "this section may be out of scope but..." — if it's out of scope, cut it.
- One stakeholder's feedback passed the gate and another's didn't — apply selectively, explain the filter.

## Common Rationalizations

| Excuse | Reality |
|--------|---------|
| "The CTO asked for a glossary, so it belongs" | Authority doesn't change document type. Glossaries go in onboarding docs. |
| "I'll add it but note it's out of scope" | That's scope creep with a disclaimer. The doc still grows. |
| "Both stakeholders have valid points" | Valid for different artifact types. Discovery is a build reference — filter accordingly. |
| "I'll just ask the user to decide" | If the doc type already answers the question, decide yourself. |
| "Updating from training data is faster" | Faster and potentially wrong. Web-verify. |
| "The previous research was thorough, I'll keep most of it" | Sunk cost. If it's wrong, replace it. |
| "A summary of the adjacent domain can't hurt" | Every out-of-scope section erodes the doc's purpose. |
| "I should be helpful and do what was asked" | Being helpful means delivering the right artifact, not the requested artifact. |
