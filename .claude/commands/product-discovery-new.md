---
name: product-discovery-new
description: Use when starting documentation for a new product or major feature, when the user provides a blurb about what to document, when unfamiliar with the product domain, or when building a discovery doc from scratch
---

# Product Discovery — New

```
THE IRON LAW: PRODUCE WHAT THE TEAM NEEDS TO BUILD, NOT WHAT A STUDENT NEEDS TO LEARN.
If the team already operates in the domain, don't explain the domain to them.
```

## Overview

Produces a discovery document from a user-provided blurb about their product. Uses web search subagents to fill domain knowledge gaps. The output is a build reference — not a domain textbook.

## Process

### Step 0: Assess blurb completeness

The blurb must contain enough to set the noise filter and competitor list. If you can only extract 1-2 of the 6 categories below, STOP and ask the user for more context before researching. Researching without a noise filter produces exactly the kind of domain dump the Iron Law forbids.

Ask in ONE message — not a drip-feed. Cover: what they already have, distribution model, integration ownership, competitors they know about, constraints, and scope boundaries.

### Step 1: Parse the blurb — extract EVERYTHING

Before any research, extract ALL of these from the user's input. Missing any causes downstream errors:

**Product scope** — what the system does, what's excluded, where it starts/ends

**What the team already has/knows** — signals: "existing", "already built", "we have", "live". These become the NOISE FILTER. Researchers MUST NOT explain things the team already operates.

**Business model & distribution** — channel, direct, embedded, self-serve, hybrid. Customer relationship. Expansion plans.

**Integration ownership** — who owns each boundary (us vs partner vs vendor). Data flows. Read vs write. Who syncs what.

**Competitive landscape signals** — vendors mentioned by name. Partners vs competitors. "We don't use X" signals. These become the COMPETITOR LIST.

**Constraints** — off-limits approaches, explicit scope exclusions, things the team said they don't need.

### Step 2: Dispatch research subagents

Launch **3 parallel subagents**, each with the noise filter and competitor list:

**Subagent 1 — Domain mechanics & standards.** Technical standards, transaction types, data formats. Focus on what engineers need to BUILD. Skip anything the team already operates.

**Subagent 2 — Rules & requirements.** Decision rules that drive product logic — lookup tables, requirement matrices, conditional rules the system must encode. THIS IS THE HIGHEST VALUE SECTION.

**Subagent 3 — Failure modes & edge cases.** What goes wrong — specific error codes/reasons, timing constraints, non-obvious edge cases. Skip generic issues the team's existing infrastructure handles.

Each subagent MUST web-search to verify claims. Tag `[VERIFIED]` or `[UNVERIFIED]`.

```
EVERY SUBAGENT RECEIVES:
- Product scope and domain
- NOISE FILTER: what the team already knows — DO NOT explain these
- COMPETITOR LIST: DO NOT recommend these as integrations or strategies
- Research focus area
```

### Step 3: Competitive awareness check

Before assembly, scan ALL subagent outputs for vendor/product names.

```
FOR EACH vendor/product mentioned:
  IF on competitor list → REWRITE: name it, explain what it does,
     explain why we can't use it, identify OUR alternative
  IF partner → flag as existing relationship
  IF neutral → leave as-is
```

### Step 4: Fact-check error codes

Verify every specific error/status code in subagent outputs via web search. Subagents hallucinate code meanings. Fix or remove wrong codes. This is mandatory.

### Step 5: Assemble the discovery doc

<HARD-GATE>
Before including ANY section, ask: "Would someone who already operates {what the team has} need this to build the next thing?" If no, CUT IT.
</HARD-GATE>

**Structure:**
1. **What This Product Does** — 2-3 sentences. Scope and boundaries.
2. **Business Context** — What We Have / What We Need. NO opinions about the team.
3. **Domain Mechanics** — Standards and formats needed to build. NOT domain education.
4. **Rules & Requirements** — Decision-rule tables. Category-level with notes on where per-item rules are needed. HIGHEST VALUE SECTION.
5. **Data Contracts** — What data from each system, what we write back. Field-level.
6. **Failure Taxonomy** — Errors by stage with specific codes and resolution paths.
7. **Integration Inventory** — System, direction, format, status.
8. **Competitive Landscape** — Competitors, what they do, why we can't use them, our alternative.
9. **Open Questions** — Genuine unknowns. Tag each: `[RESEARCH]` (answerable via further web research), `[USER]` (needs user/stakeholder input), `[ENGINEERING]` (needs codebase investigation).

**Output path:** `docs/product/{slug}/discovery.md`

## Sections That DO NOT Belong

- Domain glossaries for things the team already operates
- Industry player/vendor landscape tables (unless asked)
- ROI/TAM calculations (unless asked)
- Success metrics (unless asked)
- Regulatory overviews the team already complies with
- Generic infrastructure notes (RPA mechanics, anti-bot challenges)
- "Team ramp-up" or onboarding sections

## Red Flags — STOP

- About to recommend a competitor's product as an integration — REWRITE
- Writing a glossary of 15+ terms — most are noise. Keep only terms the team hasn't encountered.
- Section explains something the team operates daily — CUT
- "The team needs to..." or "Team members should..." — this is a context file, not advice
- Using training data without web verification for specific claims — SEARCH FIRST
- Including information because it's "important to the domain" rather than needed to build — CUT
- Blurb is one sentence and you're about to start researching — STOP. Ask for context first.
- Boss asks for a glossary or reference dump — build it as a SEPARATE onboarding doc, not in the discovery doc
- Expanding scope to document adjacent systems "for completeness" — STOP. Put them in Integration Inventory as dependencies with data contracts, don't re-document them.

## Common Rationalizations

| Excuse | Reality |
|--------|---------|
| "Domain context helps novices" | Write a separate onboarding doc. Discovery is a build reference. |
| "NEA/FastAttach is the industry standard" | Check competitor list first. Industry standard ≠ our strategy. |
| "The blurb mentioned team experience" | That's WHY they want docs, not CONTENT for the docs. |
| "More context is always better" | More noise drowns signal. |
| "I'll be thorough and they can trim" | You're wasting their time. Filter before delivery. |
| "This payer info is important" | Only if the team asked for it or doesn't already handle payers. |
| "I know this from training data" | Training data may be wrong. Web-verify specific claims. |
| "Including this can't hurt" | Every irrelevant section erodes trust in the document. |
| "I can start with what I have" | Without a noise filter, you'll produce a domain dump. Ask first, research second. |
| "The boss asked for a glossary" | Build it as a separate artifact. Discovery is a build reference, not onboarding. |
| "This would be more valuable with cross-module context" | Put adjacent modules in Integration Inventory. Don't re-document them. |
