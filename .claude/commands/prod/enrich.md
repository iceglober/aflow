---
description: Autonomous spec enrichment from codebase. Reads a product spec, researches the current repo to resolve unknowns, and produces an updated spec version — no user input needed. Provide the spec file path.
---

# /prod:enrich — Codebase-Driven Spec Enrichment

Read a product spec, research the current codebase to resolve unknowns, and produce an updated spec version autonomously — no user input required.

Pipeline: `/prod:research` → `/prod:spec` → `/prod:enrich` → `/prod:refine` × N

Unlike `/prod:refine` (interactive, user answers questions), this skill is fully autonomous. It reads the repo to answer what the repo can answer, then hands off to the user for what it can't.

---

## Input

The user provides a path to an existing spec file.

Example: `/prod:enrich research/dental-claims/spec-submission.md`

Parse the spec path from `$ARGUMENTS`.

---

## Phase 1: Load Spec and Identify Researchable Unknowns

1. **Read the spec file in full.** Parse all UNKNOWN [U-xx] entries and their "Needed from" fields.

2. **Classify each unknown by researchability:**

   **Researchable from codebase** — the answer is in the repo:
   - Data model questions → read schema files, migrations, models, types
   - API capabilities → read route handlers, service files, SDK usage
   - Integration details → read config, client libraries, API calls
   - Current workflow/lifecycle → read state machines, event handlers, job runners
   - Provider/payer data → read seed files, config tables, enums

   **Researchable from dependencies** — the answer is in installed packages or their docs:
   - SDK capabilities → read node_modules types, package docs
   - Validation behavior → read library source or config

   **NOT researchable** — requires human input:
   - Business decisions (pricing, prioritization, GTM)
   - Domain expertise (payer-specific rules, billing practices)
   - External vendor capabilities (requires contacting vendor)
   - Legal/compliance questions

3. **Plan the research.** For each researchable unknown, identify:
   - What to search for (file patterns, keywords, types)
   - Where to look (directories, specific files)
   - What would constitute a resolution vs. a partial answer

4. **Present the plan** and proceed immediately — do NOT wait for approval.

---

## Phase 2: Research

Launch parallel research agents for independent unknowns. Use sequential research for unknowns that depend on each other.

### For each researchable unknown:

1. **Search the codebase** using Glob and Grep:
   - Schema/model files: `**/*.prisma`, `**/models/**`, `**/schema.*`, `**/migrations/**`, `**/*.entity.*`
   - Type definitions: `**/*.d.ts`, `**/types/**`, `**/interfaces/**`
   - API routes: `**/routes/**`, `**/api/**`, `**/controllers/**`
   - Config: `**/*.config.*`, `**/.env.example`, `**/config/**`
   - Services/integrations: `**/services/**`, `**/integrations/**`, `**/clients/**`
   - Search for keywords from the unknown (e.g., "encounter", "procedure", "npi", "stedi", "payer")

2. **Read relevant files** to understand the actual implementation.

3. **Record findings** with specific file:line references. Be precise:
   - "Found `encounter` table in `prisma/schema.prisma:42` with fields: patientId, providerId, dateOfService, status. No procedure-level fields."
   - NOT "The encounter model appears to have some fields."

4. **Classify the result:**
   - **RESOLVED** — found a definitive answer
   - **PARTIALLY RESOLVED** — found info that narrows the unknown
   - **UNRESOLVABLE FROM CODE** — not in the codebase, needs human

### Research strategies by unknown type:

**Data model unknowns:**
- Search for ORM models, schema files, migration files, database types
- Look for entity definitions, interfaces, and type aliases
- Check seed files for reference data

**Integration unknowns:**
- Search for SDK imports and client instantiation
- Read API call sites to understand what endpoints are used
- Check config/env for API keys, endpoints, feature flags

**Workflow unknowns:**
- Search for state machines, status enums, event handlers
- Read job/worker files for background processing patterns

**Provider/configuration unknowns:**
- Search for provider tables, NPI fields, taxonomy references
- Check onboarding flows, admin UIs, setup scripts

---

## Phase 3: Generate Updated Spec

1. **Write to a NEW file:** `[original-name]-v[N].md`. Never overwrite.

2. **For resolved unknowns:**
   - Remove from Unknowns Register
   - Embed the discovered fact with file:line references
   - Remove `[depends: U-xx]` tags from unblocked requirements
   - Update requirements if reality changes them

3. **For partially resolved unknowns:**
   - Update "Known" and "Remaining gap" fields with file:line references
   - Keep `[depends: U-xx]` tags

4. **For new discoveries:**
   - Add constraints or capabilities the spec didn't account for
   - Add new unknowns if the codebase reveals them

5. **Add a changelog** noting what was resolved from code vs. still needs human input.

---

## Phase 4: Report

```
## Enrichment Complete

**Researched:** N unknowns
**Resolved from codebase:** N
**Partially resolved:** N
**Not in codebase (needs human):** N
**New discoveries:** N

### Key findings:
- [facts with file references]

### Still needs human input:
- [U-xx]: [title] — [why]

Updated spec: [file path]
Run `/prod:refine [new file path]` to resolve remaining unknowns.
```

---

## Rules

1. **Cite everything.** Every fact from the codebase gets a file:line reference.
2. **Don't guess.** Ambiguity is a partial resolution, not a guess.
3. **Respect scope.** Only research unknowns in the spec.
4. **The codebase is truth.** If code contradicts the spec, the code wins.
5. **Proceed without approval.** This skill is autonomous by design.
6. **Version, don't overwrite.** Always write a new file.
