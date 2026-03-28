# /prod:spec — Research to Product Spec

Take research output and convert it into a tight, actionable product spec. Strip narrative, define terms, surface unknowns, question KPIs.

---

## Input

The user provides:
1. **A research directory** to refine (e.g., `research/dental-claims`)
2. **Scoping guidance** — what's in scope, what's explicitly out of scope, what to focus on

Example: `/product-refine using research/dental-claims but focused solely on submission. claim status and ERA posting are considered separate solutions with separate specs.`

Parse the arguments from `$ARGUMENTS` to extract the research path and the scoping constraints.

---

## Phase 1: Ingest and Scope

1. **Read every file in the research directory.** Start with the synthesis, then read each agent output for depth. You need to understand all the research before you cut anything.

2. **Apply the user's scoping constraints.** Anything the user says is out of scope gets moved to an "Out of Scope (separate spec)" section — not deleted, just clearly fenced. If something in the research straddles the boundary, flag it as a scope question.

3. **Build a mental model of what THIS spec covers.** Write it down in one sentence before proceeding. If you can't say it in one sentence, the scope isn't clear — ask the user.

---

## Phase 2: Identify Unknowns

This is the most important phase. Research agents make assumptions. Your job is to find them.

**Types of unknowns to surface:**

### A. Platform Unknowns
Things the research assumes about the existing platform that haven't been verified:
- Data model — what fields/tables actually exist today?
- API capabilities — what can the existing systems actually do?
- Integration points — what's the real interface between systems?
- Infrastructure — what's deployed, what's theoretical?

Example: "The research assumes an encounter model with patient demographics and eligibility data. UNKNOWN: What is the actual encounter schema? Which of the assumed fields exist? What's the primary key structure? Is there a CDT code field or only CPT?"

### B. Domain Unknowns
Things a dental billing expert would know but the research had to guess at:
- Payer-specific behaviors that aren't documented
- Edge cases in claim processing
- Regional/state variations
- Real-world rejection patterns vs. theoretical ones

### C. Business Unknowns
Decisions the product team hasn't made yet:
- Build vs. buy decisions that depend on cost data we don't have
- Prioritization that depends on customer research
- Pricing model implications
- Go-to-market scope

### D. Integration Unknowns
Things that depend on third-party systems:
- Exact API capabilities of vendors (Stedi, NEA, etc.)
- Payer-specific enrollment timelines and requirements
- PMS system capabilities and constraints

**Format unknowns as open questions, not narrative:**

```
UNKNOWN [U-01]: Current encounter data model schema
  Assumed: Patient demographics, subscriber info, payer info, service dates, ICD-10 codes exist
  Risk if wrong: Dental extensions may need deeper refactoring than estimated
  Needed from: Engineering team — export current schema
  Blocks: Data model design, effort estimates
```

Number every unknown (U-01, U-02, ...) so they can be referenced and tracked.

---

## Phase 3: Refine the Spec

Write the refined spec to a new file: `[research-dir]/spec-[scope-slug].md`

For example: `research/dental-claims/spec-submission.md`

### Structure of the refined spec:

```markdown
# [Scope Title] — Product Spec

**Status:** DRAFT
**Scope:** [one sentence]
**Out of scope:** [list what's explicitly excluded]
**Date:** [today]
**Source research:** [research directory path]

---

## Unknowns Register

[All unknowns from Phase 2, numbered, with assumed/risk/needed-from/blocks fields]

---

## Definitions

[Every domain term used in this spec, defined precisely. No term should be ambiguous.
Include: technical terms, industry jargon, metric definitions, status names, role names.
If two terms could be confused (e.g., "rejection" vs "denial"), explain the difference.]

---

## Requirements

[Organized by functional area. Each requirement:]
- Has an ID (R-01, R-02, ...)
- States WHAT, not HOW
- References unknowns where assumptions are made: "Assumes [U-03] is resolved as X"
- Distinguishes MUST from SHOULD from COULD
- No implementation details — those go in a technical design doc later

---

## Data Requirements

[What data is needed, where it comes from, what's missing.
NOT a schema — a list of data needs with sources and gaps.
Reference unknowns for anything assumed about current state.]

---

## Business Rules

[Decision logic that the system must implement.
Each rule has an ID (BR-01, BR-02, ...).
Express as IF/THEN/ELSE, not prose.
Flag rules that depend on unknowns.]

---

## KPIs and Targets

[Only include KPIs that this spec's scope can actually influence.
For each KPI:]
- Definition (precise, no ambiguity — what's in the numerator? denominator? time window?)
- Why this number matters (what decision does it inform?)
- Proposed target with confidence level (high/medium/low)
- What unknown would change this target
- How it's measured (data source, calculation, frequency)

[Challenge any KPI that:]
- Can't be measured with available data
- Conflates two different things
- Has a target with no basis
- Measures activity instead of outcome

---

## Out of Scope (Separate Specs)

[Everything the user scoped out, with just enough context that someone
reading this spec understands the boundary. Reference the research
files for full detail.]

---

## Open Questions

[Questions that aren't unknowns (unknowns are about facts we don't have).
These are decisions that need to be made. Each with:]
- The decision to make
- The options
- What depends on this decision
- Who should decide
```

---

## Phase 4: Refinement Passes

After writing the first draft, make these passes:

### Pass 1: Fat Trimming
- Remove any paragraph that doesn't contain a requirement, rule, unknown, or decision
- Remove "background" and "context" sections — the research files are the context
- Remove examples unless they disambiguate a requirement
- If a section has more explanation than specification, it's too fat

### Pass 2: First Principles
- For every requirement, ask: "Why?" If the answer is "because that's how dental billing works," dig deeper — is there a structural reason, or is it convention?
- For every "must," ask: "What happens if we don't?" If the answer is "nothing breaks," it's a "should"
- For every process flow, ask: "What's the minimum viable version?" Strip ceremony.

### Pass 3: Ambiguity Check
- Search for weasel words: "generally," "typically," "usually," "often," "may," "might," "should consider," "it depends"
- Every instance is either: (a) converted to a specific rule, (b) converted to an unknown, or (c) deleted
- Search for undefined terms — if a term isn't in the Definitions section, either define it or don't use it

### Pass 4: Unknown Cross-Reference
- Every requirement that depends on an unknown gets an explicit reference: `[depends: U-03]`
- Every business rule that could change based on an unknown gets flagged
- Every KPI target that assumes an unknown is resolved gets noted

---

## Key Principles

1. **Unknowns are first-class citizens.** They sit at the top of the spec, not buried in footnotes. A spec that hides its assumptions is more dangerous than one with gaps.

2. **Requirements, not solutions.** "The system must submit claims to payers" is a requirement. "Use Stedi's JSON API to generate 837D" is an implementation detail. Keep them separate.

3. **No narrative.** If it reads like a blog post, it's wrong. Specs are reference documents, not stories.

4. **Define everything.** If someone could reasonably interpret a term two ways, it needs a definition. "Clean claim" means different things to different people — pick one and write it down.

5. **KPIs earn their place.** Every KPI must be: measurable with available data, actionable (someone can do something about it), attributable to this scope (not influenced more by out-of-scope systems). If a KPI fails any of these, cut it or flag the dependency.

6. **Scope is a weapon.** The user's scoping guidance is there to prevent scope creep. Enforce it aggressively. If something is out of scope, put it in the Out of Scope section and move on. Don't let "but it's related" pull things back in.

7. **Assumptions are risks.** Every assumption the research made is a risk until validated. Surface them, don't hide them.
