# /prod:refine — Interactive Spec Refinement

Walk through a product spec's unknowns with the user, integrate answers, and produce an updated spec with fewer unknowns.

Pipeline: `/prod:research` → `/prod:spec` → `/prod:refine` × N

---

## Input

The user provides a path to an existing spec file produced by `/prod-spec`.

Example: `/prod-refine research/dental-claims/spec-submission.md`

Parse the spec path from `$ARGUMENTS`.

---

## Phase 1: Load and Assess

1. **Read the spec file.** Parse:
   - All `UNKNOWN [U-xx]` entries from the Unknowns Register
   - All `[depends: U-xx]` references in Requirements, Business Rules, and KPIs
   - All `OQ-xx` Open Questions
   - The current scope, definitions, and out-of-scope list

2. **Build a dependency map.** For each unknown, list:
   - Which requirements depend on it
   - Which business rules depend on it
   - Which KPIs depend on it
   - Which open questions relate to it

3. **Prioritize unknowns by blast radius.** Sort by number of downstream dependencies. Unknowns that block the most requirements should be resolved first.

4. **Present the assessment to the user:**

```
## Spec Refinement: [spec name]

**Total unknowns:** N
**Open questions:** N
**Requirements blocked by unknowns:** N of M

### Priority unknowns (highest blast radius):

1. **[U-xx]: [title]** — blocks R-xx, R-xx, BR-xx (N items)
   Current assumption: [what the spec assumes]
   Question for you: [plain-language question]

2. **[U-xx]: [title]** — blocks R-xx, R-xx (N items)
   ...

3. ...

### Open questions:

1. **[OQ-xx]: [title]**
   Options: (A) ... (B) ... (C) ...

2. ...

---

I'll walk through these one at a time. Answer what you can — skip what you can't.
```

---

## Phase 2: Interactive Resolution

Walk through unknowns and open questions ONE AT A TIME, in priority order.

For each unknown:

1. **Ask the user a clear, answerable question.** Not the raw unknown text — translate it into a question the user can actually answer. Be specific.

   Bad: "What is the current encounter data model schema?"
   Good: "Does your encounter model store procedure codes? If so, are they CPT codes, CDT codes, or a generic code field?"

2. **Wait for the user's response.** They may:
   - **Answer fully** → mark the unknown as RESOLVED, note the answer
   - **Answer partially** → update the unknown with what's known, narrow the remaining gap
   - **Say "skip" or "don't know"** → leave it as-is, move to the next one
   - **Provide information that changes the spec** → note what needs to change
   - **Ask a clarifying question back** → answer it using the research/spec, then re-ask

3. **After each answer, briefly state the impact:**
   "Got it. That resolves U-01, which means R-01 through R-07 can now be finalized, and we can remove the [depends: U-01] tags from those requirements."

4. **If an answer creates NEW unknowns** (e.g., "we use Dentrix" → new unknown: "What is Dentrix's API capability?"), note them. They'll be added to the updated spec.

5. **If an answer changes a requirement, business rule, or KPI**, note the change. Don't rewrite the spec mid-conversation — collect all changes and apply at the end.

6. **After resolving an unknown, immediately move to the next one.** Don't wait for the user to prompt you. Keep the pace.

---

## Phase 3: Open Questions

After working through unknowns, present each Open Question. These are decisions, not facts — frame them accordingly:

"**OQ-03: Real-time or batched submission?**
The spec lists three options: (A) always real-time, (B) always batch, (C) configurable per practice.
Given what we've learned so far, [option X] seems most aligned. Do you have a preference, or should this stay open?"

If the user decides, convert the OQ into a business rule or requirement.
If the user defers, leave it as an OQ.

---

## Phase 4: Generate Updated Spec

Once the user has answered what they can (or says "that's enough for now"):

1. **Read the current spec file in full** — this is the base for the rewrite.

2. **Apply all changes:**

   **For resolved unknowns:**
   - Remove from the Unknowns Register
   - Add the resolved fact to the relevant section (Data Requirements, Definitions, or inline in the requirement)
   - Remove `[depends: U-xx]` tags from requirements/rules that are now unblocked
   - If the resolution changes a requirement's MUST/SHOULD/COULD level, update it

   **For partially resolved unknowns:**
   - Update the unknown's "Assumed" and "Risk if wrong" fields with the new information
   - Narrow the "Needed from" to the remaining gap
   - Keep the `[depends: U-xx]` tags

   **For new unknowns discovered during the conversation:**
   - Add to the Unknowns Register with the next available U-number
   - Add `[depends: U-xx]` to any affected requirements

   **For resolved open questions:**
   - Remove from Open Questions
   - Convert to a business rule (BR-xx) or requirement (R-xx) as appropriate
   - Add to Definitions if the decision defines a term

   **For changed requirements:**
   - Update the requirement text
   - If a SHOULD became a MUST (or vice versa), update the level
   - If a requirement was split, add new R-numbers

   **For changed business rules:**
   - Update the rule text
   - Remove conditional `[depends: U-xx]` if the unknown is resolved

3. **Write the updated spec to a NEW file:** `[original-name]-v[N].md`

   For example, if the input was `spec-submission.md`, write to `spec-submission-v2.md`.
   If the input was already `spec-submission-v2.md`, write to `spec-submission-v3.md`.

   NEVER overwrite the previous version. The version history is the audit trail.

4. **Update the header:**
   - Increment any version indicator
   - Update the date
   - Add a changelog section at the top:

```markdown
## Changelog

### v2 (2026-03-28)
- Resolved: U-01 (encounter schema), U-03 (Stedi integration scope), U-21 (charge posting ownership)
- Updated: U-07 (provider data — partially resolved, taxonomy codes still unknown)
- New unknowns: U-23 (Dentrix API rate limits)
- Decided: OQ-01 (charge posting — existing workflow handles it), OQ-07 (web app is primary UI)
- Changed: R-27 (charge posting requirement simplified), BR-15 (removed conditional)
- Remaining unknowns: N of original M
- Remaining open questions: N of original M
```

5. **Present a summary to the user:**

```
## Refinement Complete

**Resolved:** N unknowns, N open questions
**Partially resolved:** N unknowns
**New unknowns added:** N
**Remaining unknowns:** N
**Remaining open questions:** N

**Key changes:**
- [1-3 sentence summary of the most impactful changes]

**Next steps:**
- [List the highest-priority remaining unknowns and who needs to provide the answer]

Updated spec: [file path]
Run `/prod-refine [new file path]` when you have more answers.
```

---

## Rules

1. **One question at a time.** Don't dump all unknowns on the user at once. Walk through them sequentially.

2. **Translate, don't copy.** The unknown text is written for spec readers. The question you ask should be written for the person sitting in front of you. Use plain language.

3. **"Skip" is always valid.** Never pressure the user to answer. If they don't know, move on. The unknown stays in the spec.

4. **Facts become requirements. Decisions become rules.** When the user provides a fact ("we use Open Dental"), update the relevant requirement. When they make a decision ("let's do real-time sync"), create a business rule.

5. **Never lose information.** Resolved unknowns don't disappear — they become facts embedded in the spec. The changelog tracks what was resolved and when.

6. **Version, don't overwrite.** Every refinement pass produces a new file. The original spec is never modified.

7. **New unknowns are progress.** Resolving U-01 ("what's the encounter schema?") might create U-23 ("does the encounter model support multi-location practices?"). That's good — the unknowns are getting more specific, which means the spec is getting more concrete.

8. **Stay in scope.** If the user's answer touches something in the Out of Scope section, note it but don't pull it into this spec. Say: "That's useful context for the [ERA/payment] spec — I'll note it but it doesn't change this spec."

9. **Keep the pace.** After the user answers and you state the impact, immediately ask the next question. Don't summarize excessively between questions. Save the summary for the end.
