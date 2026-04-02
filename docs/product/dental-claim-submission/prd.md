# PRD: Dental Claim Submission

## Problem Statement

Dental office managers lose $23,400/month in revenue because 65% of denied insurance claims are never resubmitted -- staff doesn't exist to rework them, and manually creating claims, collecting attachments, and routing to the correct payer is too slow and error-prone for the people they do have.

## Success Metric

**First-pass acceptance rate above 90% within 90 days of activation.** Industry norm is 80-85%. Best-in-class is 95-98%. Measured as percentage of claims accepted by the payer on initial submission (277CA accepted, no rework).

## User Story

Today the office manager opens the PMS after each appointment, manually creates a claim, hunts for the right CDT codes, uploads x-rays one at a time, guesses which payer ID to use for the patient's Delta Dental plan, and clicks submit. If the claim bounces -- wrong payer ID, missing perio chart, frequency limit already hit -- it lands in a pile that never gets touched. The practice loses the revenue.

After: the office manager sees claims auto-generated from completed appointments, already validated, with attachments pulled from the imaging system. She reviews a batch, clicks submit, and they go out -- to any payer, EDI or portal. Denials from preventable errors drop. The pile of abandoned claims shrinks. Revenue recovers.

## Scope

### In

| Capability | Reasoning |
|---|---|
| Auto-generate 837D claims from PMS appointment data | Eliminates manual claim creation -- the single largest time cost. No competitor does this. |
| Validate against CDT rules, payer requirements, and bundling/frequency logic | 53% of denials stem from incomplete information or incorrect codes. Catchable before submission. |
| Auto-collect and attach required documentation from PMS imaging | Missing attachments cause 18% of denials. Manual attachment costs $10.81/claim vs. $0.84 electronic. |
| Submit via EDI (Stedi, 345 dental payers) with RPA fallback for non-EDI payers | Guarantees delivery to any payer. No competitor covers 100%. |
| Coordination of benefits sequencing for secondary claims | COB errors cause 6% of denials. Birthday rule and sequencing logic are well-defined. |
| Embedded in channel partner CRM (iframe) | Zero new software for the practice. Activation is a switch flip by the partner. |

### Out

| Exclusion | Reasoning |
|---|---|
| Eligibility verification | Separate product on the platform already. Different workflow, different data. |
| Claim status tracking (277) and ERA/payment posting (835) | Post-submission lifecycle. Adding it bloats scope without improving first-pass acceptance. |
| Pre-treatment estimates / predeterminations | Different user intent (treatment planning vs. billing). |
| Denial management and appeals | Goal is to prevent denials, not manage them. |
| Patient billing and collections | Different user, different compliance rules, different product. |
| Eaglesoft and Dentrix PMS integration | Henry Schein owns 70% of eAssist. Channel conflict. Open Dental first. |

---

## Requirements

### Claims submit without manual data entry

- Auto-generate 837D claims from completed PMS appointments -- patient demographics, provider NPIs, CDT codes, tooth/surface data, and service dates pulled directly from PMS records.
- Map free-text payer names from PMS to canonical payer IDs, including Delta Dental state-specific routing (39 independent entities, not the generic 94276 fallback) and BCBS alpha-prefix resolution (3-character prefix to correct state plan).
- Present generated claims to the office manager for batch review before submission. No claim leaves without human approval.
- Write submission confirmation back to the PMS so the office manager doesn't have to reconcile between two systems.
- Include prior authorization numbers (REF G1) and predetermination numbers (REF G3) on claims when they exist in the PMS for that patient and procedure.

### Attachments arrive with the claim

- Determine which attachments each claim needs based on CDT code and payer combination (e.g., perio charting for D4341, pre-op x-ray for D2750, operative narrative for D7210).
- Auto-pull required x-rays, perio charts, and intraoral photos from the PMS imaging system and attach them to the claim.
- Auto-generate treatment narratives from clinical notes for procedures that require them (crowns, SRP, surgical perio, implants). Office manager reviews before submission.
- Submit attachments electronically via EDI 275 where supported (28 payers via Stedi) and via RPA portal upload for all other payers.
- Reference attachments correctly in the 837D via PWK segment (report type, transmission code, attachment control number). For Delta Dental, use payer ID 94276 for attachment routing regardless of state-specific claim payer ID.
- Convert attachments to payer-accepted formats (JPEG/TIFF) and enforce size limits before submission.

### Payer-specific rules don't cause rejections

- Validate CDT codes against field requirements: tooth number, surface codes, oral cavity area, and quadrant -- per the CDT-to-field mapping for each code category. Strip unnecessary fields where the CDT code doesn't require them.
- Check frequency limitations before submission (e.g., D0120 2x/12mo, D2750 1x/tooth/60-84mo, D1110 2x/12mo) and flag claims that will exceed the patient's payer-specific limits. Flags are warnings -- office manager can override.
- Flag known bundling conflicts (e.g., D2950+D2750 buildup into crown, D4341+D4355 same date, D0330+D0274 FMX remap risk) and alert the office manager before submission.
- Flag procedures commonly subject to downcoding (e.g., D7210 to D7140, D4341 to D4342, composite to amalgam under LEAT) with documentation requirements to avoid it. Informational, not blocking.
- Validate payer-specific routing: Cigna DHMO uses payer ID 62308 via EDI. MetLife uses 61109 for claims (not 65978). Guardian uses 64246 or GI813 by plan type. GEHA routes through UHC (39026). Ameritas enforces 250-char narrative limit and exact TIN match. Principal requires Privacy ID, not SSN.
- Include ICD-10 diagnosis codes and KX modifier on Medicare dental claims.
- Validate subscriber ID format per payer and NPI type per provider role (billing = Type 2 org or Type 1 solo; rendering = always Type 1; taxonomy in 1223 series).

### Secondary claims process correctly

- Determine primary vs. secondary payer using COB rules: subscriber over dependent, active employment over COBRA, Birthday Rule for dependent children (month/day comparison, not age), longest coverage as tiebreaker, Medicaid always payer of last resort.
- Populate Loop 2320 (Other Subscriber Information) with primary payer's adjudication data -- amounts paid, adjustments, allowed amounts -- when submitting secondary claims.
- Queue secondary claims until primary ERA is received. Do not submit primary and secondary simultaneously.

### Claims reach every payer

- Submit claims via Stedi EDI to the 345 dental payers in their network.
- For payers not on Stedi's EDI network, submit via RPA directly through the payer's provider portal.
- Include an Idempotency-Key header on every Stedi API call. Retry within the 24-hour deduplication window only.
- Detect and prevent duplicate submissions (same patient/provider/date-of-service/procedure within payer's duplicate window).
- Confirm submission via payer acknowledgment (277CA accepted), not just clearinghouse acceptance. Claims stay in "pending payer acknowledgment" state until 277CA arrives.
- Store payer claim control numbers from 277CA for use in subsequent corrections (frequency code 7) or voids (frequency code 8).

### The office manager stays in control

- Embed the entire workflow in the channel partner's CRM as an iframe. No separate login, no new software.
- Show claim status in a queue: generated, validating, pending correction, submitted, pending payer acknowledgment, acknowledged. Office manager acts on exceptions, not every claim.
- When validation catches an issue, present the specific problem and what to do about it in plain language -- not raw CARC codes or X12 segment references.
- Allow the office manager to edit any claim before submission. Auto-generation is a starting point, not a locked output.
- Send webhook notifications to the partner CRM when a claim requires correction (exponential backoff retries; email fallback after 24 hours of webhook failure).
- Track timely filing deadlines per payer and alert before approaching: 30-day and 14-day warnings for 90-day payers (Aetna, Cigna, UHC, Ameritas); 60-day and 30-day warnings for 12-month payers (Delta Dental, Guardian, Principal, MetLife, Medicare).

### Errors that don't need humans get fixed automatically

- Auto-fix without surfacing to staff: total charge mismatches (recalculate from lines), PCN truncation to 17 chars, reserved X12 character stripping, segment reordering, duplicate line item control number regeneration, charge rounding (tolerance +/-$0.01), attachment format conversion (to JPEG/TIFF), oversized attachment compression, NPI type correction per provider role, unnecessary tooth/surface data stripping.
- Route to the correction queue with human-readable explanation: future/placeholder DOBs, subscriber ID not found after eligibility cross-reference, missing subscriber address, any CARC 16/4/252/253 rejection with paired RARC detail, wrong COB ordering, provider not credentialed with payer (CARC 208 -- handle reactively, not as a prerequisite).
- Do not retry coverage/benefit denials: CARC 1/2/3 (deductible/coinsurance/copay), CARC 27 (coverage terminated), CARC 29 (timely filing expired), CARC 50 (not medically necessary), CARC 96 (non-covered), CARC 97 (bundled by payer). Surface to staff as informational.

---

## Acceptance Criteria

These answer: **how do we know this worked for the user?**

| Criterion | Measurement |
|---|---|
| First-pass acceptance rate exceeds 90% across activated practices within 90 days | 277CA accepted (A1) vs. total claims submitted |
| Office manager spends less than 5 minutes per batch reviewing and submitting a day's claims | Time-on-task observation during pilot |
| Zero claims rejected for missing attachments when the imaging data exists in the PMS | Track CARC 252 denials against attachment-eligible claims where PMS had the image |
| Claims reach payers not on Stedi's EDI network via RPA without manual intervention | RPA submission success rate for non-EDI payers during pilot |
| Secondary claims include correct primary payer adjudication data and are not rejected for COB errors | Track CARC 22/289 rejections on secondary claims |
| Office manager can identify and resolve a flagged validation issue without leaving the CRM | Observed during pilot -- no context-switching to PMS or payer portal to understand the problem |
| Practices see measurable reduction in revenue lost to preventable denials | Compare denial rate and unresubmitted-denial rate before vs. after activation (baseline: ~19% denial rate, 65% never resubmitted) |
| Zero structural rejections (999) for claims that pass pre-submission validation | Stedi 999 rejection rate on validated claims |

---

## Open Questions

**[USER]** What is the partner's revenue share expectation? Research suggests 70/30 or 80/20 (us/partner) is standard for embedded dental software, but this is unconfirmed.

**[USER]** Does the partner want per-practice SaaS pricing ($150-250/month) or per-claim pricing ($1-2/claim)? Per-practice is simpler and aligns with the existing eligibility product's pricing model. Per-claim scales better for high-volume DSOs.

**[USER]** How does the partner currently handle practice onboarding for the eligibility product? Claim submission activation should mirror that flow.

**[USER]** Who owns provider data onboarding (billing NPI, rendering NPI, taxonomy code, service facility address)? Partner adds to our system, or we manage independently?

**[ENGINEERING]** Stedi supports EDI 275 attachments for only 28 dental payers. Which payers are in the 28, and do they cover the highest-volume payers in the partner's practice base?

**[ENGINEERING]** Open Dental DB/API access: the technical scan found a single live instance via Tailscale. What is the plan for accessing PMS data at scale across 11k practices -- direct DB, Open Dental API, or bridge service?

**[ENGINEERING]** Frequency limitation checking requires claim history per patient. Where does this data come from -- PMS records, prior submissions through our system, or both?

**[ENGINEERING]** Secondary claim automation requires primary ERA data. Since ERA/835 processing is out of scope, how does the system get primary payer adjudication data to populate Loop 2320? Manual entry by office manager? Import from PMS?

**[ENGINEERING]** The CDT-to-field-requirements mapping (which codes need tooth number, surface, quadrant, etc.) is behind the ADA paywall. License ADA's Appendix 3 table, or build from payer companion guides?

**[ENGINEERING]** How is dual coverage (COB) detected -- from eligibility response, PMS insurance plan data, or both?

**[ENGINEERING]** Eaglesoft integration is out of scope for launch, but if pursued later: schema is undocumented, write-back mechanism is unclear, and Patterson's partner program is cost-prohibitive. Legal position on 21st Century Cures Act information blocking provisions needs evaluation.

---

## Non-Goals

| Non-Goal | Reasoning |
|---|---|
| Replace the billing outsourcer | We automate claim creation and submission, not the full RCM cycle. Practices that outsource 100% of billing (15-25% of market) are not the target user. |
| Real-time adjudication | Only Tesia/Vyne offers this via proprietary payer integrations built over decades. Not reproducible, and not required to hit 90% first-pass acceptance. |
| ML-based denial prediction | Requires claim outcome training data we don't have yet. Rules-based validation gets us from 80% to 90%+. ML is a future layer. |
| Print-and-mail fallback | RPA covers non-EDI payers without physical mail. The 14% of claims still on paper are a shrinking segment. |
| PMS write-back of adjudication results | Depends on claim status tracking (out of scope). Write-back of submission confirmation is in scope; write-back of payment data is not. |

---

*Generated 2026-04-01. Source: problem.md, research-market.md, research-domain.md, research-competitive.md, research-technical.md, research-benchmarks.md.*
