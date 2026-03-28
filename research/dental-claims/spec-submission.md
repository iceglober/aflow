# Dental Claim Submission — Product Spec

**Status:** DRAFT
**Scope:** Assemble a dental encounter into a valid 837D claim, validate it, attach supporting documents, route it to the correct payer via EDI or RPA, confirm acceptance, and sync submission-related state to the PMS (charge posting, claim creation, status updates through acceptance/rejection).
**Out of scope:** Claim status tracking post-acceptance (276/277 polling), ERA/835 processing, payment posting to PMS, adjustment/write-off posting, denial management, appeals, secondary/COB claim generation, patient billing, reporting dashboards.
**Date:** 2026-03-28
**Source research:** `research/dental-claims/`

---

## Unknowns Register

### Platform Unknowns

```
UNKNOWN [U-01]: Current encounter data model schema
  Assumed: Patient demographics, subscriber info, payer ID, service dates,
           and procedure codes exist. Eligibility (270/271) is already running.
  Risk if wrong: If the encounter model lacks structured procedure-level data
           (or only stores CPT, not CDT), the dental extension is a deeper
           refactor than "add 5 tables."
  Needed from: Engineering — export current schema for encounter and related tables
  Blocks: Data model design, effort estimates for R-01 through R-07

UNKNOWN [U-02]: Current procedure code storage
  Assumed: The encounter model stores procedure codes. Unknown whether it
           validates against CPT only or supports arbitrary code sets.
  Risk if wrong: If procedure code validation is hardcoded to CPT, adding CDT
           requires changing a validation layer, not just a data table.
  Needed from: Engineering — how are procedure codes stored and validated today?
  Blocks: R-03 (CDT code support), R-10 (scrubbing)

UNKNOWN [U-03]: Existing Stedi integration surface area
  Assumed: Stedi is integrated for eligibility (270/271). Unknown whether the
           integration includes claim submission (837), clearinghouse routing,
           or only eligibility transactions.
  Risk if wrong: If only eligibility is wired up, 837D submission requires new
           Stedi integration work (API auth, routing config, payer enrollment).
  Needed from: Engineering — what Stedi APIs/transaction types are currently live?
  Blocks: R-14 (EDI submission), effort estimates

UNKNOWN [U-04]: Stedi dental payer coverage
  Assumed: Stedi can route 837D to the Big 6 dental payers.
  Risk if wrong: If Stedi lacks enrollment with Delta Dental entities or MetLife,
           the RPA/secondary clearinghouse dependency is much larger.
  Needed from: Stedi — current dental payer list and enrollment lead times
  Blocks: R-15 (routing logic), channel strategy

UNKNOWN [U-05]: RPA engine capabilities and current dental coverage
  Assumed: The RPA engine exists and can automate browser-based workflows.
           No dental payer portals are automated today.
  Risk if wrong: If the RPA engine has constraints (no MFA handling, no file
           upload, no headless browser support), portal automation scope shrinks.
  Needed from: Engineering — RPA engine capabilities, MFA strategy, current bots
  Blocks: R-16 (RPA submission), R-20 (attachment upload via portal)

UNKNOWN [U-06]: How encounters become "complete"
  Assumed: There is a discrete event or status change when a provider finishes
           an encounter. This is the trigger for claim assembly.
  Risk if wrong: If encounter completion is implicit (e.g., end of day batch),
           the trigger mechanism for the submission pipeline changes.
  Needed from: Product/Engineering — what is the current encounter lifecycle?
  Blocks: R-08 (claim assembly trigger)

UNKNOWN [U-07]: Existing provider master data
  Assumed: Provider NPI, Tax ID, and address are stored somewhere.
           Unknown whether taxonomy codes, license numbers, and the billing-vs-
           rendering distinction exist.
  Risk if wrong: Dental requires both Type 1 (individual) and Type 2 (organization)
           NPIs plus dental-specific taxonomy codes. If provider data is flat,
           this needs a data migration.
  Needed from: Engineering — current provider data model
  Blocks: R-05 (provider data), R-10 (NPI validation)

UNKNOWN [U-08]: Existing payer master data
  Assumed: Payer IDs exist for eligibility. Unknown whether dental-specific payer
           IDs are stored (dental plans often have different payer IDs than medical).
  Risk if wrong: Submitting with the wrong payer ID is a top-5 rejection reason.
  Needed from: Engineering — current payer data model; Operations — do we have
           dental payer IDs or only medical?
  Blocks: R-06 (payer data), R-10 (payer ID validation)
```

### Domain Unknowns

```
UNKNOWN [U-09]: CDT code licensing terms for multi-tenant SaaS
  Assumed: CDT codes can be embedded in a multi-tenant platform.
  Risk if wrong: ADA licensing may require per-practice fees or restrict
           how codes are displayed/stored in a SaaS product.
  Needed from: Legal — contact ADA for CDT licensing terms
  Blocks: R-03 (CDT code support), cost model

UNKNOWN [U-10]: Actual payer-specific scrubbing rules
  Assumed: Research lists common rules (frequency limits, preauth requirements,
           bundling). Real payer behavior may differ.
  Risk if wrong: Scrubbing rules built from research may not match actual
           adjudication behavior, leading to false positives/negatives.
  Needed from: Dental billing expert or historical claim data from a pilot practice
  Blocks: R-12 (payer-specific scrubbing), accuracy of clean claim rate target

UNKNOWN [U-11]: Attachment rate by procedure category
  Assumed: 25-40% of dental claims require attachments (research range).
  Risk if wrong: If actual rate is higher (e.g., specialty practices at 50%+),
           attachment workflow is more critical to MVP than estimated.
  Needed from: Pilot practice data or dental billing expert
  Blocks: R-17 through R-20 prioritization

UNKNOWN [U-12]: State-specific dental billing regulations
  Assumed: No state requires a licensed professional or registered clearinghouse
           to submit claims on behalf of a dental practice.
  Risk if wrong: Some states may require clearinghouse registration or restrict
           third-party submission. This could block launch in specific states.
  Needed from: Legal — review for target launch states
  Blocks: Go-to-market, compliance
```

### Business Unknowns

```
UNKNOWN [U-13]: Target customer segment
  Assumed: General dental practices (single-location, 5-10 staff).
  Risk if wrong: DSOs (dental service organizations) have different needs
           (multi-location, centralized billing, high volume). Specialty
           practices (perio, endo, oral surgery) have higher attachment
           rates and more complex coding.
  Needed from: Product/GTM — who is the first customer?
  Blocks: Feature prioritization, scrubbing rule depth, RPA payer selection

UNKNOWN [U-14]: Predetermination support in MVP
  Assumed: Out of scope for initial launch.
  Risk if wrong: Predeterminations use the same 837D structure (different BHT06
           flag). Supporting them is low incremental effort and high practice
           adoption value. Excluding them may hurt sales.
  Needed from: Product — is predetermination support a launch requirement?
  Blocks: R-22 scope

UNKNOWN [U-15]: Medicaid dental in scope
  Assumed: Out of scope. Medicaid dental (DentaQuest, SKYGEN, MCNA) uses
           state-specific portals and different workflows.
  Risk if wrong: If a target customer has Medicaid patients, claim submission
           only works for their commercial patients.
  Needed from: Product/GTM
  Blocks: Payer coverage strategy
```

### PMS Integration Unknowns

```
UNKNOWN [U-18]: Does the PMS have a "claim" entity?
  Assumed: The PMS has some concept of a claim record that can be created and
           updated. Some PMS systems only have an "insurance transaction" or
           "ledger entry" with no separate claim object.
  Risk if wrong: If the PMS has no claim entity, we need to decide whether to
           (a) create one in the PMS, (b) track claims only in our system and
           sync status as ledger notes, or (c) use a PMS-specific workaround.
           This fundamentally shapes the integration.
  Needed from: Engineering — PMS data model for target PMS systems (Open Dental,
           Dentrix, Eaglesoft, Curve)
  Blocks: R-27, R-28, R-29, PMS sync architecture

UNKNOWN [U-19]: PMS write capabilities (API vs. direct DB vs. local agent)
  Assumed: We can write to the PMS programmatically.
  Risk if wrong: Dentrix and Eaglesoft historically require local-agent or
           direct-database integration (no cloud API). Open Dental has an API.
           Curve is cloud-native. If the target PMS has no write API, every
           PMS sync requirement becomes dramatically harder.
  Needed from: Engineering — evaluate write paths for top 2 target PMS systems
  Blocks: All R-27 through R-30, feasibility of real-time sync

UNKNOWN [U-20]: What data does the PMS need to see for a submitted claim?
  Assumed: At minimum the PMS needs: claim exists, payer, date submitted,
           and current status. Unknown whether the PMS also needs the full
           837D content, control numbers, or submission channel.
  Risk if wrong: Over-syncing creates maintenance burden and consistency risks.
           Under-syncing means staff can't see claim status in their primary tool.
  Needed from: Dental billing expert — what do staff look at in the PMS after
           submitting a claim? Product — what's the UX model (PMS as primary
           view vs. our web app as primary view)?
  Blocks: R-28, R-29 field scope

UNKNOWN [U-21]: PMS charge posting — who owns it?
  Assumed: Charges are posted to the PMS when the encounter is finalized.
           Unknown whether this already happens today (via existing encounter
           workflow) or whether our system needs to trigger it.
  Risk if wrong: If our system must post charges, we need PMS write access for
           financial data — a higher-trust integration than status updates.
           If charges are already posted by the PMS/clinical workflow, we only
           need to create/update the claim record.
  Needed from: Engineering — does the current encounter workflow post charges to
           the PMS? Or is that a gap?
  Blocks: R-27, BR-15

UNKNOWN [U-22]: PMS read capabilities for scrubbing data
  Assumed: Prior service dates, missing tooth maps, and fee schedules can be
           read from the PMS (or from our own data store populated from PMS).
  Risk if wrong: If we can't read historical service dates from the PMS,
           frequency limitation scrubbing (Tier 3) only works for claims
           processed through our system — not historical claims.
  Needed from: Engineering — can we read patient history from the target PMS?
  Blocks: R-12 (Tier 3 scrubbing accuracy), data requirements
```

### Integration Unknowns

```
UNKNOWN [U-16]: NEA FastAttach API availability
  Assumed: NEA has an API for programmatic attachment submission.
  Risk if wrong: If NEA only offers a desktop client or manual upload,
           the attachment workflow requires RPA on NEA's interface or a
           different attachment vendor.
  Needed from: Engineering — evaluate NEA FastAttach integration options
  Blocks: R-19 (attachment delivery via EDI)

UNKNOWN [U-17]: Stedi 837D validation behavior
  Assumed: Stedi validates X12 structure but not payer business rules.
  Risk if wrong: If Stedi does more validation than expected, some scrubbing
           rules may be redundant. If less, more claims will be rejected at
           the clearinghouse.
  Needed from: Engineering — test Stedi validation with sample dental claims
  Blocks: R-10/R-11 scrubbing scope
```

---

## Definitions

| Term | Definition |
|------|-----------|
| **837D** | X12 005010X224A2 — the HIPAA-mandated EDI format for dental claim submission. |
| **CDT code** | Current Dental Terminology code (ADA). Format: `Dxxxx`. The dental equivalent of CPT. Updated annually Jan 1. |
| **Claim** | A request for payment for dental services rendered. One claim = one patient + one date of service + one or more procedures. |
| **Clean claim** | A claim that passes all pre-submission validation (structural, clinical, frequency, payer-specific) and is accepted by the payer on first submission without rejection. |
| **Rejection** | Claim bounced pre-adjudication due to data/format errors (999 or 277CA). Can be corrected and resubmitted. Not the same as a denial. |
| **Denial** | Claim adjudicated and not paid (in whole or part). Requires appeal or corrected resubmission. OUT OF SCOPE for this spec. |
| **Scrubbing** | Pre-submission validation of a claim against structural, clinical, and payer-specific rules. |
| **SV3** | The X12 segment for dental service line data (procedure code, tooth, surfaces, charge). Replaces SV1 (medical). |
| **TOO** | X12 segment for tooth information (tooth number, surfaces). |
| **PWK** | X12 segment for paperwork/attachment reference. Links a claim to an externally hosted attachment via a control number. |
| **Attachment** | Supporting documentation submitted with or referenced by a claim: X-rays, perio charts, narratives, photos. |
| **NEA FastAttach** | Dominant dental attachment delivery platform. Attachments uploaded to NEA, referenced on claim via PWK segment + control number. |
| **Payer ID** | Clearinghouse-specific identifier for routing claims to a payer. Dental plans often have different payer IDs than medical plans from the same carrier. |
| **NPI Type 1** | Individual provider (the dentist). |
| **NPI Type 2** | Organization (the practice). |
| **Taxonomy code** | Provider specialty code registered with NPPES. General dentistry = `1223G0001X`. |
| **UCR fee** | Usual, Customary, and Reasonable — the practice's standard fee. Always billed on claims; payer adjudicates down to their allowed amount. |
| **Frequency limitation** | Payer rule restricting how often a procedure can be performed (e.g., prophylaxis every 6 months). |
| **Predetermination** | Non-binding estimate of benefits from a payer. Uses 837D with `BHT06 = "13"`. |
| **Pre-authorization** | Binding (with caveats) approval from payer before service. Uses 837D with `BHT06 = "18"`. Returns an authorization number. |
| **277CA** | Claim Acknowledgment — payer-level response confirming receipt and acceptance/rejection of individual claims. |
| **999** | Implementation Acknowledgment — confirms EDI file was syntactically valid. Does NOT mean claim was accepted. |
| **Routing** | Per-claim decision of which channel (EDI or RPA) to use for submission. |
| **PMS** | Practice Management System — the practice's primary software for scheduling, charting, billing, and patient records (e.g., Dentrix, Eaglesoft, Open Dental, Curve). The financial ledger lives here. |
| **PMS sync (submission)** | The subset of PMS integration owned by this spec: charge posting, claim record creation, and status updates through acceptance/rejection. Payment posting, adjustments, and write-offs belong to the ERA spec. |
| **Charge posting** | Creating a debit entry on the patient's ledger in the PMS for each procedure at UCR fee. This is the first financial event in the claim lifecycle. |

---

## Requirements

### Data Model

**R-01**: The system MUST store dental service line data per encounter: CDT code, tooth number, tooth surfaces, oral cavity designation, quantity, and charge amount. `[depends: U-01, U-02]`

**R-02**: The system MUST store prosthesis information per service line: initial-vs-replacement flag and prior placement date (if replacement). `[depends: U-01]`

**R-03**: The system MUST support CDT codes as a procedure code set distinct from CPT. CDT codes MUST be validated against the ADA CDT code table for the date of service (not submission date). `[depends: U-02, U-09]`

**R-04**: The system MUST store orthodontic treatment data per encounter: total months, remaining months, banding date, initial exam date. COULD defer to a later phase if orthodontic claims are not in the initial target segment. `[depends: U-13]`

**R-05**: The system MUST store billing provider (Type 2 NPI, Tax ID, taxonomy code, address) and rendering provider (Type 1 NPI, taxonomy code) separately. SHOULD store referring provider NPI. SHOULD store state license number (some payers require it). `[depends: U-07]`

**R-06**: The system MUST maintain a payer directory with dental-specific payer IDs. Dental payer IDs are often different from medical payer IDs for the same carrier. `[depends: U-08]`

**R-07**: The system MUST store a missing tooth map per patient: which teeth are missing and why (extraction, congenital, unknown). This is a claim-level field with no medical equivalent; payers use it for treatment planning validation.

### Claim Assembly

**R-08**: The system MUST automatically assemble a claim when an encounter is marked complete. Assembly pulls data from: encounter record, eligibility cache, provider master, payer directory, and fee schedule. `[depends: U-06]`

**R-09**: The system MUST apply the practice's UCR fee schedule to each service line. IF a fee is $0 or missing, THEN flag for human review. The claim MUST always bill at UCR; contracted/allowed amounts are never submitted.

### Pre-Submission Scrubbing

**R-10**: The system MUST validate every claim before submission against structural rules (Tier 1):
- Patient name, DOB, gender, address present
- Subscriber ID and relationship code present
- Billing and rendering NPI pass Luhn check
- Payer ID maps to a known payer
- At least one service line with valid CDT code, date of service, and charge > $0
- Date of service is not in the future
- No duplicate claim (same patient + DOS + procedure + provider within 30 days)

`[depends: U-07, U-08]`

**R-11**: The system MUST validate dental-specific clinical rules (Tier 2):
- Restorative codes (D2xxx) MUST have tooth number AND surfaces
- Endo codes (D3xxx) MUST have tooth number, MUST NOT have surfaces
- Quadrant perio codes (D4341/D4342) MUST have oral cavity designation (quadrant), MUST NOT have individual tooth numbers
- Crown codes (D27xx) MUST have tooth number, MUST NOT have surfaces
- Extraction codes (D7xxx) MUST have tooth number
- Surface codes MUST be valid for tooth position (O for posterior, I for anterior — not interchangeable)
- Tooth number MUST be plausible for patient age (primary teeth A-T for children, permanent 1-32 for adults)

**R-12**: The system SHOULD validate frequency and payer-specific rules (Tier 3-4):
- Check common frequency limitations (prophy/6mo, bitewings/12mo, crowns/5yr per tooth) against prior service dates
- Warn on procedures that commonly require pre-authorization for this payer
- Warn on likely bundling conflicts (e.g., D0220 + D3310 same date)

Tier 3-4 produce WARNINGS, not blocks. Human can override with logged reason.

`[depends: U-10]`

**R-13**: Scrubbing MUST complete in < 2 seconds per claim. Scrubbing results MUST classify each finding as ERROR (must fix) or WARNING (can override).

### Submission

**R-14**: The system MUST generate a valid 837D transaction and transmit it to the payer via EDI (clearinghouse). The 837D MUST include all required segments: ISA/GS/ST envelope, BHT, billing/rendering provider loops, subscriber/patient loops, CLM, SV3, TOO, DTP, and (where applicable) DN1, DN2, PWK. `[depends: U-03, U-04]`

**R-15**: The system MUST route each claim to a submission channel based on per-payer configuration. The routing decision MUST consider: (1) whether the payer is reachable via EDI, (2) whether an RPA bot is available and healthy, (3) whether the claim has attachments, and (4) a manual override per payer.

**R-16**: The system SHOULD support submission via RPA (payer portal automation) as a secondary channel. RPA is used when: EDI enrollment is pending, RPA is cheaper for a high-volume payer, or as fallback when EDI fails. `[depends: U-05]`

**R-17**: IF submission fails on the primary channel, THEN the system MUST attempt the fallback channel. IF both channels fail, THEN queue for manual submission and alert staff.

### Attachments

**R-18**: The system MUST detect when a claim requires an attachment based on CDT code + payer combination. MUST prompt for attachment before allowing submission. `[depends: U-11]`

**R-19**: For EDI-submitted claims requiring attachments, the system MUST deliver the attachment via an external attachment service (e.g., NEA FastAttach), obtain a control number, and include it in the 837D PWK segment BEFORE claim transmission. Attachment delivery MUST complete before claim submission. `[depends: U-16]`

**R-20**: For RPA-submitted claims, the system SHOULD upload attachments directly through the payer portal during submission (zero incremental cost vs. $0.75-1.00/attachment via NEA). `[depends: U-05]`

**R-21**: The system MUST store attachments (X-rays, perio charts, narratives, photos) linked to the encounter. Supported formats: JPEG, PNG, PDF, DICOM.

### Acknowledgment Processing

**R-22**: The system MUST process 999 (syntax acknowledgment) and 277CA (claim acknowledgment) responses. IF 277CA reports rejection (A3-A8), THEN route the claim back to the scrubbing queue with the rejection reason. IF 277CA reports acceptance (A1/A2), THEN update claim status to "accepted."

**R-23**: For RPA-submitted claims, the system MUST capture the portal's submission confirmation (confirmation number, accepted/rejected status).

### PMS Sync (Submission Lifecycle)

**R-27**: The system MUST post charges to the PMS patient ledger when an encounter is finalized — one charge line per CDT code at UCR fee. IF charges are already posted by the existing encounter workflow, THEN this requirement is satisfied and our system MUST NOT double-post. `[depends: U-21, U-19]`

**R-28**: The system MUST create or update a claim record in the PMS when a claim is assembled and passes scrubbing. The PMS claim record MUST include at minimum: patient reference, payer, date of service, total charges, and claim status = "ready to submit." `[depends: U-18, U-19]`

**R-29**: The system MUST update the PMS claim status at each submission milestone:
- "Submitted" — when 837D is transmitted or RPA submission completes. Include: submission date, channel used, control/confirmation number.
- "Accepted" — when 277CA returns A1/A2. Include: payer reference number.
- "Rejected" — when 277CA returns A3-A8. Include: rejection reason code.

`[depends: U-18, U-19, U-20]`

**R-30**: The system MUST read from the PMS (or a synchronized data store) to support claim assembly and scrubbing:
- Patient demographics and insurance info (if PMS is source of truth rather than encounter model)
- Prior service dates per patient per CDT code (for Tier 3 frequency scrubbing)
- Missing tooth map (if maintained in PMS)
- Fee schedule / UCR rates (if maintained in PMS)
- Prior authorization numbers (if tracked in PMS)

`[depends: U-22]`

**R-31**: PMS sync failures MUST NOT block claim submission. IF a PMS write fails, THEN queue the sync for retry and proceed with submission. The claim lifecycle is the source of truth; the PMS is kept in sync on a best-effort basis with retry. Alert staff if sync fails for > 1 hour.

### Audit & Compliance

**R-24**: Every submission MUST log: claim ID, channel used, timestamp, routing reason, confirmation number, and a hash of the submission payload.

**R-25**: The system MUST encrypt PHI at rest (AES-256) and in transit (TLS 1.2+). The platform operates as a Business Associate; BAAs are required with practices and subcontractors.

**R-26**: The system MUST validate NPIs against the NPPES registry before submission.

---

## Data Requirements

| Data Need | Source | Status | Unknown |
|-----------|--------|--------|---------|
| Patient demographics (name, DOB, gender, address) | Encounter/eligibility | Assumed to exist | U-01 |
| Subscriber info (ID, group #, relationship) | Eligibility response (271) | Assumed to exist | U-01 |
| CDT procedure codes per service line | Clinical encounter input | Unknown if model supports CDT | U-02 |
| Tooth number per service line | Clinical encounter input | Likely does not exist | U-01 |
| Tooth surfaces per service line | Clinical encounter input | Likely does not exist | U-01 |
| Oral cavity designation (quadrant/arch) | Clinical encounter input | Likely does not exist | U-01 |
| Prosthesis replacement flag + prior date | Clinical encounter input | Likely does not exist | U-01 |
| Orthodontic treatment info | Clinical encounter input | Likely does not exist | U-01 |
| Missing tooth map per patient | Patient record / PMS | Likely does not exist | U-01 |
| Billing provider NPI (Type 2) + Tax ID | Provider master | Unknown | U-07 |
| Rendering provider NPI (Type 1) + taxonomy | Provider master | Unknown | U-07 |
| Dental-specific taxonomy codes | Provider master | Likely does not exist | U-07 |
| Dental payer IDs | Payer directory | Likely does not exist | U-08 |
| UCR fee schedule per CDT code | Practice configuration | Unknown | U-01 |
| Payer-specific frequency rules | Payer rules engine | Does not exist — must build | U-10 |
| Attachment files (X-ray, perio chart, etc.) | Imaging system / upload | Unknown integration | U-16 |
| Prior service dates per patient per CDT code | Historical claims / PMS | Unknown | U-01, U-22 |
| PMS claim entity (writable) | PMS system | Unknown — may not exist | U-18, U-19 |
| PMS charge posting capability | PMS system | Unknown — may already happen | U-21, U-19 |
| PMS claim status field (writable) | PMS system | Unknown | U-18, U-20 |

---

## Business Rules

**BR-01**: IF encounter is marked complete, THEN auto-assemble claim within 30 seconds. `[depends: U-06]`

**BR-02**: IF any Tier 1 or Tier 2 scrubbing error exists, THEN block submission. Claim enters "needs correction" queue.

**BR-03**: IF only Tier 3-4 warnings exist, THEN allow submission with human override. Log override reason.

**BR-04**: IF claim has no scrubbing findings, THEN auto-submit via routing engine with zero human touch.

**BR-05**: IF payer has an active, healthy (>95% success rate over 7 days) RPA bot AND claim does not exceed $1,000, THEN route to RPA. ELSE route to EDI. `[depends: U-05]`

**BR-06**: IF claim requires attachment AND channel is EDI, THEN submit attachment to delivery service first, obtain control number, embed in PWK, THEN submit claim. Attachment MUST precede claim.

**BR-07**: IF claim requires attachment AND channel is RPA, THEN upload attachment via portal during claim submission flow.

**BR-08**: IF RPA bot fails 3 consecutive times for a payer, THEN disable RPA for that payer, route all claims to EDI, alert engineering.

**BR-09**: IF 277CA rejects a claim, THEN route back to scrubbing queue with rejection code. Do NOT create a new claim — correct and resubmit the original with frequency code "7" (replacement) and the original reference number.

**BR-10**: IF submission fails on both EDI and RPA, THEN queue for manual submission. Alert billing specialist within 1 hour.

**BR-11**: Always bill at UCR fee. Never submit the contracted/allowed amount.

**BR-12**: IF CDT code is a restorative procedure (D2xxx) AND surface count does not match code suffix (D2391 = 1 surface, D2392 = 2 surfaces, D2393 = 3 surfaces), THEN block with error.

**BR-13**: IF CDT code changes between encounter date and submission date (annual Jan 1 update), THEN use the CDT code valid on the DATE OF SERVICE.

**BR-14**: IF a claim has > 50 service lines, THEN split into multiple claims. (837D supports 50 max; ADA paper form supports 10.)

**BR-15**: IF encounter completion already triggers charge posting in the PMS (existing workflow), THEN do NOT re-post charges. IF charges are not posted by existing workflow, THEN post charges to PMS at encounter completion (before claim assembly). `[depends: U-21]`

**BR-16**: IF PMS write fails during claim status sync, THEN retry up to 3 times with exponential backoff. IF all retries fail, THEN continue with claim submission and queue the PMS sync for background retry. Alert staff after 1 hour of failed sync.

**BR-17**: IF 277CA rejects a claim (BR-09) AND claim was synced to PMS as "submitted," THEN update PMS claim status to "rejected" with reason code. The claim re-enters scrubbing (BR-09) and PMS status updates to "submitted" again on resubmission.

**BR-18**: The platform's claim state machine is the source of truth. The PMS is a downstream sync target. IF PMS state and platform state diverge, THEN platform state wins and PMS is re-synced.

---

## KPIs and Targets

### KPI-01: Clean Claim Rate
- **Definition:** Claims accepted on first submission (277CA = A1 or A2) / total claims submitted. Measured per calendar month.
- **Why it matters:** Every rejected claim requires human rework. This is the primary measure of submission quality.
- **Target:** 95% at launch (month 1-3), 98% steady state (month 6+)
- **Confidence:** Medium. The 98% target comes from research citing systems with mature Tier 3-4 scrubbing. At launch with only Tier 1-2, expect lower. `[depends: U-10 for Tier 3-4 accuracy]`
- **Measurement:** Count of 277CA acceptances / count of 837D submissions. Source: submission audit log + acknowledgment processing.

### KPI-02: Auto-Submission Rate
- **Definition:** Claims that pass scrubbing and submit without any human intervention / total claims assembled. Measured per calendar month.
- **Why it matters:** This is the "minimal human touch" metric for submission specifically. Distinct from the full-lifecycle human touch rate (which includes denials, posting, etc. — out of scope).
- **Target:** 70% at launch, 85% steady state.
- **Confidence:** Low. Depends heavily on U-01 (how much data auto-populates) and U-10 (false positive rate of scrubbing warnings). If the encounter model is sparse, more claims need human data entry before submission.
- **Measurement:** Claims with zero human interactions between assembly and submission / total assembled. Source: submission audit log.

### KPI-03: Time to Submit
- **Definition:** Median elapsed time from encounter marked complete to claim transmitted to payer. Measured per calendar month.
- **Why it matters:** Faster submission = faster payment. Same-day submission is the goal.
- **Target:** < 4 hours (same business day) for auto-submitted claims.
- **Confidence:** High for auto-submitted claims (pipeline is deterministic). Low for claims needing correction (depends on staff response time, which is outside system control).
- **Measurement:** Timestamp of encounter completion → timestamp of 837D transmission. Source: claim state machine events.

### KPI-04: Rejection Rate
- **Definition:** Claims rejected at clearinghouse or payer front-end (277CA = A3-A8) / total submitted. Measured per calendar month.
- **Why it matters:** Inverse of clean claim rate, but tracked separately because rejection reasons are actionable (each feeds back into scrubbing rules).
- **Target:** < 5% at launch, < 2% steady state.
- **Confidence:** Same as KPI-01.
- **Measurement:** Count of 277CA rejections / count of submissions. Source: acknowledgment processing.

### Excluded KPIs

The following KPIs from the research are OUT OF SCOPE for this spec. They are influenced primarily by systems covered in separate specs:

- **Days in A/R** — depends on payer adjudication speed and ERA posting (separate spec)
- **Denial rate** — post-adjudication; denial management is a separate spec
- **Net collection rate** — depends on payment posting and patient collections
- **Auto-post rate** — ERA processing, separate spec
- **Cost per claim** — meaningful only across the full lifecycle

---

## Out of Scope (Separate Specs)

| Area | Boundary | Research Reference |
|------|----------|-------------------|
| **Claim status tracking** | This spec ends at 277CA acceptance. Ongoing 276/277 polling and status dashboard are a separate solution. | `04-product-spec.md` §5.1-5.2, `synthesis.md` §3 |
| **ERA/835 processing** | Parsing remittance advice, matching payments to claims, and posting to PMS are a separate solution. | `01-domain.md` §3 Phase 4, `04-product-spec.md` §6, `synthesis.md` §4 |
| **PMS ledger sync (post-submission)** | Payment posting from ERA, contractual adjustments, patient responsibility transfers, denial write-offs, refunds, and reconciliation are all downstream of submission. This spec owns PMS sync through acceptance/rejection only. | `synthesis.md` §4 (Events 4-10) |
| **Denial management** | Denied claims (post-adjudication) require categorization, appeal, or resubmission. Separate spec. Note: rejected claims (pre-adjudication, 277CA) ARE in scope — they route back through scrubbing. | `04-product-spec.md` §5.3-5.7 |
| **Secondary/COB claims** | Auto-generating secondary claims from primary ERA data is downstream of ERA processing. | `01-domain.md` §6, `synthesis.md` §6 |
| **Patient billing** | Statements, collections, online payment — all downstream of ERA posting. | `04-product-spec.md` §1 |
| **Dashboards & reporting** | Submission-specific KPIs (§ above) are measured, but the dashboard UI is a shared capability across all specs. | `04-product-spec.md` §7 |

---

## Open Questions

**OQ-01: Is our system or the PMS/clinical workflow responsible for charge posting?**
- If the existing encounter workflow already posts charges to the PMS, we just need to not double-post (BR-15).
- If it doesn't, we own charge posting — and we need PMS write access for financial data, which is a higher-trust integration than status updates.
- This is blocked by U-21. Once answered, it becomes a business rule, not a question.
- Options: (A) existing workflow handles it — we verify, (B) we own it — post at encounter completion
- Who decides: Engineering (fact-finding) + Product (if gap exists)

**OQ-07: What is the primary UI for billing staff — the PMS or our web app?**
- This determines how much PMS sync fidelity matters.
- If staff live in the PMS, claim status must be visible there (R-29 is critical).
- If staff use our web app as the primary claims tool, PMS sync is a background reconciliation concern.
- Options: (A) PMS is primary — full sync required, (B) our web app is primary — PMS sync is best-effort status, (C) hybrid — different staff use different tools
- Who decides: Product + customer research
- `[related: U-20]`

**OQ-08: Should PMS sync be real-time or batched?**
- Real-time sync (update PMS immediately on each state change) gives staff instant visibility but requires reliable PMS write access.
- Batched sync (periodic reconciliation) is more fault-tolerant but introduces lag.
- Options: (A) real-time with retry (R-31), (B) batched every N minutes, (C) real-time for critical events (submitted, accepted, rejected) + batched for metadata
- Who decides: Engineering (feasibility based on PMS capabilities) + Product
- `[related: U-19]`

**OQ-02: Should predeterminations be in the MVP?**
- Same 837D structure, different BHT06 flag. Low incremental effort.
- High value for practice adoption (patients want cost estimates before treatment).
- Options: (A) include in MVP, (B) defer to v2
- Who decides: Product
- `[related: U-14]`

**OQ-03: What is the submission timing model — real-time or batched?**
- EDI can be real-time (API call per claim) or batched.
- RPA benefits from batching (session management, rate limits).
- Some practices prefer batch review before submission (end-of-day).
- Options: (A) always real-time, (B) always batch, (C) configurable per practice
- Who decides: Product

**OQ-04: How are imaging/X-ray files sourced for attachments?**
- Research assumes attachments are uploaded or pulled from a patient imaging system.
- Unknown: do target practices use digital imaging? Is there an integration point?
- Options: (A) manual upload only, (B) integrate with imaging systems (Dexis, Apteryx, etc.), (C) pull from PMS if PMS stores images
- Who decides: Product + Engineering
- `[related: U-16]`

**OQ-05: Should the system support paper claim generation as a fallback?**
- 10-15% of dental claims are still paper. Some small payers don't accept EDI.
- Options: (A) not supported — out of scope, (B) generate printable ADA claim form (J400/J430) as PDF
- Who decides: Product

**OQ-06: What is the RPA cost baseline?**
- Research gives conflicting per-claim costs ($0.08 vs $0.38) depending on whether RPA engine costs are amortized.
- The routing engine (BR-05) needs a real cost comparison to make good decisions.
- Options: Use actual marginal cost (near-zero if engine exists) or fully loaded cost (including maintenance)
- Who decides: Engineering + Finance
