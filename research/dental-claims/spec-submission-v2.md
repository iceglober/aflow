# Dental Claim Submission — Product Spec

**Status:** DRAFT v2
**Scope:** Poll the PMS for completed procedures, assemble a valid 837D claim, validate it, attach supporting documents (manual upload / screen capture), route to the payer via RPA (primary) or EDI (fallback), confirm acceptance, and sync submission state back to the PMS.
**Out of scope:** Claim status tracking post-acceptance (276/277 polling), ERA/835 processing, payment posting to PMS, adjustment/write-off posting, denial management, appeals, secondary/COB claim generation, patient billing, reporting dashboards, paper claims, Medicaid dental.
**Date:** 2026-03-28
**Source research:** `research/dental-claims/`
**Previous version:** `spec-submission.md`

---

## Changelog

### v2 (2026-03-28)

- **Resolved:** U-03 (Stedi is eligibility-only), U-05 (RPA engine is strong — 10-20 portals, LLM self-healing), U-06 (we poll PMS for completed procedures), U-08 (canonical payer directory exists), U-09 (CDT licensing — already purchasing from ADA), U-13 (general dental practices, 500 launch)
- **Partially resolved:** U-01 (clinical data lives in PMS, our model is thin), U-02 (CDT codes exist internally, PMS procedure pull unclear), U-07 (org NPI exists, individual dentist NPIs are a gap), U-19 (Open Dental DB read proven, write unbuilt; Eaglesoft unknown), U-22 (Open Dental DB readable but not for procedures yet)
- **New unknowns:** U-23 (Eaglesoft read/write mechanism), U-24 (PMS polling cadence and change detection)
- **Decided:** OQ-02 (predeterminations as addendum), OQ-03 (event-based submission), OQ-04 (manual upload + screen capture), OQ-05 (no paper), OQ-06 (RPA ~$0 marginal cost), OQ-07 (both PMS and web app are first-class UIs)
- **Changed:** BR-05 flipped — RPA is primary channel, EDI is fallback. R-16 upgraded from SHOULD to MUST. R-19 (NEA) downgraded to COULD for launch. New architecture context: partner model, PMS as source of truth for clinical data.
- **Remaining unknowns:** 14 of original 22 (8 resolved/partially resolved, 2 new)
- **Remaining open questions:** 3 of original 8

---

## Architecture Context

**Partner model:** A partner company owns the customer relationship (11K offices, 500 on eligibility). The partner sends tenant/payer data via API at onboarding, triggers eligibility from their CRM. The partner does NOT handle RCM data — we own the full RCM pipeline.

**PMS as source of truth:** Clinical data (procedures, teeth, surfaces, fees) lives in the PMS. We pull it — we don't receive it from the partner or from user input. The primary PMS targets are **Eaglesoft** (primary) and **Open Dental** (secondary).

**Current PMS access:** Open Dental DB is queried via a lambda on a cadence (proven for appointment data). Eaglesoft mechanism is TBD. Both must support read AND write for RCM.

**RPA engine:** 10-20 dental payer portals already automated for EOB/eligibility. Handles MFA, self-heals with LLMs, manages credentials per provider. Portal components (login, navigation) are reusable for claim submission. Marginal cost per claim is ~$0.

**Stedi:** Currently eligibility (270/271) only. 837D claim submission is net-new. Payer enrollment for claims needs to be set up.

**CDT codes:** Internal store of all current CDT codes purchased from ADA on a quarterly basis, with nomenclature and descriptions.

**Canonical payers:** Payer directory exists with Stedi IDs, aliases, and portal mappings. PMS payer names are mapped to canonical payers at onboarding.

---

## Unknowns Register

### Platform Unknowns

```
UNKNOWN [U-01]: Current encounter/platform data model
  Known: Our system stores tenant info, canonical payers, org NPI, portal
         credentials. Eligibility data flows through. Clinical procedure data
         is NOT in our system today — it lives in the PMS.
  Remaining gap: What exactly does our internal data model look like? What
         entities exist? How would procedure/claim data be modeled in our system
         once pulled from the PMS?
  Risk if wrong: If our data model requires significant new entities (procedures,
         claims, service lines, attachments), the modeling effort is substantial.
  Needed from: Engineering — current schema export; design session for claim data model
  Blocks: R-01 through R-07 data model design

UNKNOWN [U-02]: PMS procedure data extraction
  Known: CDT code reference data exists internally (ADA license). Open Dental
         DB is queryable (proven for appointments). Open Dental has a
         `procedurelog` table with CDT codes, teeth, surfaces, fees.
  Remaining gap: Have we ever pulled procedure data from Open Dental? Do we
         know the exact query / table relationships needed? For Eaglesoft,
         can we access procedure data at all?
  Risk if wrong: If procedure data extraction is harder than appointment
         extraction (more tables, more joins, data quality issues), the
         pipeline takes longer to build.
  Needed from: Engineering — spike pulling procedure data from Open Dental DB
  Blocks: R-08 (claim assembly), R-30 (PMS reads)

UNKNOWN [U-07]: Individual provider (dentist) data
  Known: Organization NPI and TIN are stored per tenant. Onboarding UX
         collects/confirms TIN and payer mapping.
  Remaining gap: Individual dentist NPIs (Type 1), dental taxonomy codes, and
         state license numbers are not stored. These are required on every
         837D claim (rendering provider loop).
  Risk if wrong: Without individual NPIs, no claim can be submitted. This is a
         data collection gap that must be solved during onboarding or via PMS pull.
  Needed from: Product — add rendering provider data to onboarding flow?
         Engineering — can individual provider NPIs be pulled from the PMS?
  Blocks: R-05 (provider data), R-10 (NPI validation), R-14 (837D generation)
```

### PMS Integration Unknowns

```
UNKNOWN [U-18]: PMS claim entity structure
  Known: Open Dental has a `claim` table. Eaglesoft likely has something similar.
         We have not interacted with either claim table.
  Remaining gap: What are the required fields to create/update a claim in each
         PMS? What status values do they use? Can we write to the claim table
         without breaking PMS-side workflows?
  Needed from: Engineering — document Open Dental `claim` table schema and
         required fields for insert/update
  Blocks: R-28, R-29

UNKNOWN [U-19]: PMS write path
  Known: Open Dental DB is readable (lambda pattern). Write path is unbuilt
         but technically feasible (direct DB or API). Eaglesoft mechanism is
         completely unknown.
  Remaining gap: For Open Dental — API vs direct DB write? For Eaglesoft —
         what write mechanisms exist at all?
  Risk if wrong: If Eaglesoft has no viable write path, PMS sync for Eaglesoft
         practices falls back to "display in our web app only" with no PMS
         status updates.
  Needed from: Engineering — evaluate Open Dental write options; research
         Eaglesoft integration mechanisms
  Blocks: R-27, R-28, R-29

UNKNOWN [U-20]: PMS claim status field requirements
  Known: Both PMS and our web app must show accurate claim status (both are
         first-class UIs).
  Remaining gap: What status values does Open Dental's claim table support?
         Do they map cleanly to our state machine (ready/submitted/accepted/
         rejected)? Same question for Eaglesoft.
  Needed from: Engineering — Open Dental claim status enum; Eaglesoft equivalent
  Blocks: R-29 field mapping

UNKNOWN [U-21]: Charge posting ownership
  Known: Charges are created in the PMS when procedures are completed (this is
         standard PMS behavior — the dentist charts a procedure, the PMS creates
         the charge). Our system pulls this data.
  Remaining gap: Confirm that charges are reliably posted in the PMS before we
         pull procedure data. If not, we may need to trigger charge posting.
  Risk if wrong: If some practices don't finalize charges promptly, we'd pull
         incomplete procedure data.
  Needed from: Engineering — verify charge posting behavior in Open Dental and
         Eaglesoft for a sample practice
  Blocks: R-27, BR-15

UNKNOWN [U-22]: Historical procedure data availability
  Known: Open Dental DB is readable. `procedurelog` table contains historical
         procedures with dates.
  Remaining gap: How far back does the data go? Is it reliable enough for
         frequency limit scrubbing (e.g., "last prophy was 5 months ago")?
         Eaglesoft — same question.
  Needed from: Engineering — sample query for prior procedure dates in Open Dental
  Blocks: R-12 (Tier 3 scrubbing accuracy)

UNKNOWN [U-23]: Eaglesoft read/write mechanism
  Assumed: We will need to read/write Eaglesoft data for claim submission.
  Risk if wrong: Eaglesoft historically uses a local SQL database (Patterson
         proprietary). No public cloud API. Integration may require a local
         agent, direct DB connection, or HL7 interface. This could be the
         longest-pole item.
  Needed from: Engineering — research Eaglesoft integration options (local DB,
         Patterson API program, third-party bridges like DentalAPI/Sikka)
  Blocks: All PMS sync requirements for Eaglesoft practices

UNKNOWN [U-24]: PMS polling cadence and change detection
  Assumed: We poll the PMS DB for new/completed procedures on a short cadence,
         similar to the appointment lambda.
  Risk if wrong: If the PMS doesn't have clean "completed" timestamps or status
         fields on procedures, detecting new claimable procedures is harder
         than detecting new appointments.
  Needed from: Engineering — what fields in Open Dental `procedurelog` indicate
         a procedure is complete and ready for claim assembly? Is there a
         reliable timestamp?
  Blocks: R-08 (claim assembly trigger), BR-01 timing
```

### Domain Unknowns

```
UNKNOWN [U-10]: Actual payer-specific scrubbing rules
  Assumed: Research lists common rules (frequency limits, preauth requirements,
         bundling). Real payer behavior may differ.
  Risk if wrong: Scrubbing rules built from research may not match actual
         adjudication behavior, leading to false positives/negatives.
  Needed from: Dental billing expert, or learn from rejection data once claims
         are flowing
  Blocks: R-12 (payer-specific scrubbing), KPI-01 accuracy

UNKNOWN [U-11]: Attachment rate by procedure category
  Assumed: ~30% of claims require attachments (market average for general dental).
  Risk if wrong: If actual rate is higher, attachment workflow is more critical.
  Needed from: Validate against actual claim data once flowing
  Blocks: R-18 through R-21 prioritization

UNKNOWN [U-12]: State-specific dental billing regulations
  Assumed: No state requires a licensed professional or registered clearinghouse
         to submit claims on behalf of a dental practice.
  Risk if wrong: Could block launch in specific states.
  Needed from: Legal — review for target launch states
  Blocks: Go-to-market, compliance
```

### Business Unknowns

```
UNKNOWN [U-15]: Medicaid dental in scope
  Assumed: Out of scope for launch. Medicaid dental uses state-specific portals
         and different workflows.
  Risk if wrong: If target practices have significant Medicaid patients, claim
         submission only works for their commercial patients.
  Needed from: Partner — what % of the 500 practices have Medicaid patients?
  Blocks: Payer coverage strategy
```

### Integration Unknowns

```
UNKNOWN [U-04]: Stedi dental payer coverage for claims
  Known: Stedi is used for eligibility. All Big 6 accept 837D via clearinghouse.
  Remaining gap: Which specific dental payers can Stedi route 837D claims to
         today? What are enrollment lead times?
  Risk if wrong: If Stedi coverage is thin, more claims must go through RPA —
         which is fine (RPA is cheaper) but affects the fallback story.
  Needed from: Stedi account team — dental payer list for claims
  Blocks: R-14, R-15 routing logic

UNKNOWN [U-16]: NEA FastAttach API availability
  Assumed: NEA has an API for programmatic attachment submission.
  Note: Deferred to post-launch. At launch, attachments go through RPA portal
         upload or manual upload. NEA becomes relevant when EDI-submitted claims
         need attachments.
  Needed from: Engineering — evaluate when EDI attachment volume justifies NEA
  Blocks: R-19 (deferred)

UNKNOWN [U-17]: Stedi 837D validation behavior
  Assumed: Stedi validates X12 structure but not payer business rules.
  Risk if wrong: Affects where scrubbing responsibility lives.
  Needed from: Engineering — test Stedi validation with sample dental claims
  Blocks: R-10/R-11 scrubbing scope
```

---

## Definitions

| Term | Definition |
|------|-----------|
| **837D** | X12 005010X224A2 — the HIPAA-mandated EDI format for dental claim submission. |
| **CDT code** | Current Dental Terminology code (ADA). Format: `Dxxxx`. The dental equivalent of CPT. Updated annually Jan 1. Our system maintains a licensed CDT code table updated quarterly from the ADA. |
| **Claim** | A request for payment for dental services rendered. One claim = one patient + one date of service + one or more procedures. |
| **Clean claim** | A claim that passes all pre-submission validation and is accepted by the payer on first submission (277CA = A1/A2) without rejection. |
| **Rejection** | Claim bounced pre-adjudication due to data/format errors (999 or 277CA). Can be corrected and resubmitted. Not the same as a denial. |
| **Denial** | Claim adjudicated and not paid (in whole or part). OUT OF SCOPE for this spec. |
| **Scrubbing** | Pre-submission validation of a claim against structural, clinical, and payer-specific rules. |
| **SV3** | X12 segment for dental service line data (procedure code, tooth, surfaces, charge). Replaces SV1 (medical). |
| **TOO** | X12 segment for tooth information (tooth number, surfaces). |
| **PWK** | X12 segment for paperwork/attachment reference. Links a claim to an externally hosted attachment via a control number. |
| **Attachment** | Supporting documentation submitted with or referenced by a claim: X-rays, perio charts, narratives, photos. At launch, sourced via manual upload or screen capture in our web app. |
| **Canonical payer** | Our internal payer entity. Maps to Stedi payer IDs (+ aliases) and RPA portal configurations. PMS payer names are mapped to canonical payers at onboarding. |
| **NPI Type 1** | Individual provider (the dentist). Required as rendering provider on 837D. Currently NOT stored in our system — gap. |
| **NPI Type 2** | Organization (the practice). Stored per tenant as billing provider. |
| **Taxonomy code** | Provider specialty code registered with NPPES. General dentistry = `1223G0001X`. |
| **UCR fee** | Usual, Customary, and Reasonable — the practice's standard fee. Always billed on claims; payer adjudicates down to their allowed amount. Sourced from PMS fee schedule. |
| **Frequency limitation** | Payer rule restricting how often a procedure can be performed (e.g., prophylaxis every 6 months). |
| **Predetermination** | Non-binding estimate of benefits from a payer. Uses 837D with `BHT06 = "13"`. In scope as addendum, not core. |
| **Pre-authorization** | Binding (with caveats) approval from payer before service. Uses 837D with `BHT06 = "18"`. Returns an authorization number. |
| **277CA** | Claim Acknowledgment — payer-level response confirming receipt and acceptance/rejection of individual claims. |
| **999** | Implementation Acknowledgment — confirms EDI file was syntactically valid. |
| **Routing** | Per-claim decision of which channel (RPA or EDI) to use for submission. RPA is primary (cheaper, handles attachments); EDI is fallback. |
| **PMS** | Practice Management System. Primary targets: Eaglesoft, Open Dental. Source of truth for clinical/procedure data. We read from and write to PMS. |
| **PMS sync (submission)** | Reads: pull procedure data, patient history, fee schedule. Writes: create/update claim record, sync status through acceptance/rejection. Payment posting and adjustments belong to the ERA spec. |
| **Charge posting** | Creating a debit entry on the patient's ledger in the PMS for each procedure at UCR fee. This happens in the PMS when the dentist completes charting — we read the result, we don't trigger it. |
| **Partner** | The company that owns the customer relationship. Sends tenant/payer data via API. Triggers eligibility. Does not touch RCM. |

---

## Requirements

### Data Model

**R-01**: The system MUST store dental service line data per claim: CDT code, tooth number, tooth surfaces, oral cavity designation, quantity, and charge amount. Data is sourced from PMS procedure records. `[depends: U-01, U-02]`

**R-02**: The system MUST store prosthesis information per service line: initial-vs-replacement flag and prior placement date (if replacement). Sourced from PMS. `[depends: U-02]`

**R-03**: The system MUST support CDT codes as a procedure code set. CDT codes MUST be validated against the internal ADA CDT code table for the date of service (not submission date).

**R-04**: The system SHOULD store orthodontic treatment data per encounter: total months, remaining months, banding date, initial exam date. Deferred to post-launch unless early customer demand. `[depends: U-02]`

**R-05**: The system MUST store billing provider (Type 2 NPI, Tax ID, taxonomy code, address — sourced from tenant record) and rendering provider (Type 1 NPI, taxonomy code — new data, must be collected) separately. SHOULD store referring provider NPI. SHOULD store state license number. `[depends: U-07]`

**R-06**: The system MUST use the canonical payer directory for claim routing. Canonical payers already have Stedi IDs, aliases, and portal mappings.

**R-07**: The system MUST store a missing tooth map per patient: which teeth are missing and why (extraction, congenital, unknown). Sourced from PMS if available. `[depends: U-02]`

### PMS Data Extraction

**R-30**: The system MUST poll the PMS for completed procedures on a regular cadence to detect claimable encounters. `[depends: U-24, U-02]`

**R-32**: The system MUST read the following from the PMS for each claimable encounter:
- Patient demographics and insurance/subscriber info
- Procedure codes (CDT), tooth numbers, surfaces, oral cavity designations
- Fee schedule / charge amounts (UCR)
- Rendering provider (if identifiable in PMS)
- Prior authorization numbers (if tracked in PMS)

`[depends: U-02, U-23 for Eaglesoft]`

**R-33**: The system SHOULD read historical procedure data from the PMS to support frequency limitation scrubbing (Tier 3). `[depends: U-22]`

### Claim Assembly

**R-08**: The system MUST automatically assemble a claim when new completed procedures are detected in the PMS. Assembly combines: PMS procedure data, canonical payer mapping, provider master (billing + rendering), and internal CDT code table for validation. `[depends: U-24]`

**R-09**: Claims MUST bill at the UCR fee from the PMS fee schedule. IF a fee is $0 or missing, THEN flag for human review. Never submit contracted/allowed amounts.

### Pre-Submission Scrubbing

**R-10**: The system MUST validate every claim before submission against structural rules (Tier 1):
- Patient name, DOB, gender, address present
- Subscriber ID and relationship code present
- Billing and rendering NPI pass Luhn check
- Payer ID maps to a canonical payer
- At least one service line with valid CDT code, date of service, and charge > $0
- Date of service is not in the future
- No duplicate claim (same patient + DOS + procedure + provider within 30 days)

`[depends: U-07 for rendering NPI]`

**R-11**: The system MUST validate dental-specific clinical rules (Tier 2):
- Restorative codes (D2xxx) MUST have tooth number AND surfaces
- Endo codes (D3xxx) MUST have tooth number, MUST NOT have surfaces
- Quadrant perio codes (D4341/D4342) MUST have oral cavity designation, MUST NOT have individual tooth numbers
- Crown codes (D27xx) MUST have tooth number, MUST NOT have surfaces
- Extraction codes (D7xxx) MUST have tooth number
- Surface codes MUST be valid for tooth position (O for posterior, I for anterior)
- Tooth number MUST be plausible for patient age

**R-12**: The system SHOULD validate frequency and payer-specific rules (Tier 3-4):
- Check common frequency limitations against prior service dates from PMS
- Warn on procedures that commonly require pre-authorization
- Warn on likely bundling conflicts

Tier 3-4 produce WARNINGS, not blocks. Human can override with logged reason.

`[depends: U-10, U-22]`

**R-13**: Scrubbing MUST complete in < 2 seconds per claim. Results MUST classify each finding as ERROR (must fix) or WARNING (can override).

### Submission

**R-14**: The system MUST generate a valid 837D transaction for EDI submission via Stedi. The 837D MUST include all required segments: ISA/GS/ST envelope, BHT, billing/rendering provider loops, subscriber/patient loops, CLM, SV3, TOO, DTP, and (where applicable) DN1, DN2, PWK. `[depends: U-04]`

**R-15**: The system MUST route each claim to a submission channel. RPA is the primary channel (lower cost, handles attachments). EDI via Stedi is the fallback. Routing is per canonical payer configuration.

**R-16**: The system MUST support submission via RPA (payer portal automation) as the primary channel. The RPA engine handles MFA, self-heals with LLMs, and reuses existing portal login/navigation components from the eligibility workflow.

**R-17**: IF submission fails on the primary channel, THEN the system MUST attempt the fallback channel. IF both fail, THEN queue for manual submission and alert staff.

### Attachments

**R-18**: The system MUST detect when a claim requires an attachment based on CDT code + payer combination. MUST prompt for attachment before allowing submission. `[depends: U-11]`

**R-19**: For EDI-submitted claims requiring attachments, the system COULD deliver the attachment via NEA FastAttach. Deferred to post-launch. At launch, claims needing attachments SHOULD be routed to RPA where portal upload is free. `[depends: U-16]`

**R-20**: For RPA-submitted claims, the system MUST upload attachments through the payer portal during the submission flow.

**R-21**: The system MUST support attachment upload via manual file upload and screen capture in the web app. Supported formats: JPEG, PNG, PDF. DICOM support is a SHOULD.

### Acknowledgment Processing

**R-22**: The system MUST process 999 and 277CA responses for EDI-submitted claims. IF 277CA reports rejection (A3-A8), THEN route back to scrubbing queue with rejection reason. IF acceptance (A1/A2), THEN update claim status to "accepted."

**R-23**: For RPA-submitted claims, the system MUST capture the portal's submission confirmation (confirmation number, accepted/rejected status).

### PMS Sync (Submission Lifecycle)

**R-27**: Charge posting to the PMS is handled by the PMS itself when the dentist completes charting. Our system MUST NOT post charges. Our system reads charges as input. `[depends: U-21 — confirm this assumption]`

**R-28**: The system MUST create or update a claim record in the PMS when a claim passes scrubbing and is ready for submission. `[depends: U-18, U-19]`

**R-29**: The system MUST update the PMS claim status at each submission milestone:
- "Submitted" — when transmitted to payer. Include: submission date, control/confirmation number.
- "Accepted" — when 277CA returns A1/A2 or portal confirms acceptance.
- "Rejected" — when 277CA returns A3-A8 or portal indicates rejection. Include: rejection reason.

`[depends: U-18, U-19, U-20]`

**R-31**: PMS sync failures MUST NOT block claim submission. IF a PMS write fails, THEN queue for retry and proceed with submission. Alert staff if sync fails for > 1 hour.

### Audit & Compliance

**R-24**: Every submission MUST log: claim ID, channel used, timestamp, routing reason, confirmation number, and a hash of the submission payload.

**R-25**: The system MUST encrypt PHI at rest (AES-256) and in transit (TLS 1.2+). BAAs required with practices and subcontractors.

**R-26**: The system MUST validate NPIs against the NPPES registry before submission.

### Addendum: Predeterminations

**R-34**: The system SHOULD support predetermination submission using the same 837D pipeline with `BHT06 = "13"`. Same scrubbing, routing, and PMS sync apply. Not on the critical path for launch.

---

## Data Requirements

| Data Need | Source | Status | Unknown |
|-----------|--------|--------|---------|
| Patient demographics (name, DOB, gender, address) | PMS → our system | Readable from Open Dental DB | U-23 (Eaglesoft) |
| Subscriber info (ID, group #, relationship) | PMS + eligibility cache | Available from eligibility flow | — |
| CDT procedure codes per service line | PMS `procedurelog` (Open Dental) | Not yet pulled, but table exists | U-02, U-23 |
| Tooth number per service line | PMS procedure data | Not yet pulled | U-02, U-23 |
| Tooth surfaces per service line | PMS procedure data | Not yet pulled | U-02, U-23 |
| Oral cavity designation (quadrant/arch) | PMS procedure data | Not yet pulled | U-02, U-23 |
| Prosthesis replacement flag + prior date | PMS procedure data | Not yet pulled | U-02 |
| Missing tooth map per patient | PMS patient data | Unknown if available | U-02 |
| Billing provider NPI (Type 2) + Tax ID | Tenant record | Exists | — |
| Rendering provider NPI (Type 1) + taxonomy | NOT stored — gap | Must collect at onboarding or pull from PMS | U-07 |
| Dental-specific taxonomy codes | NOT stored — gap | Must add to provider data model | U-07 |
| Canonical payer + Stedi ID + portal mapping | Canonical payer directory | Exists | — |
| UCR fee schedule per CDT code | PMS fee schedule | Not yet pulled | U-02, U-23 |
| Internal CDT code table | ADA license (quarterly) | Exists | — |
| Payer-specific frequency rules | Must build | Does not exist | U-10 |
| Attachment files | Manual upload / screen capture | Launch approach decided | — |
| Prior service dates per patient | PMS historical procedures | Readable from Open Dental | U-22, U-23 |
| PMS claim entity (writable) | PMS system | Unknown schema | U-18, U-19 |
| PMS claim status field (writable) | PMS system | Unknown status values | U-18, U-20 |

---

## Business Rules

**BR-01**: IF new completed procedures detected in PMS (via polling), THEN auto-assemble claim. Target: detect and assemble within one polling cycle. `[depends: U-24]`

**BR-02**: IF any Tier 1 or Tier 2 scrubbing error exists, THEN block submission. Claim enters "needs correction" queue.

**BR-03**: IF only Tier 3-4 warnings exist, THEN allow submission with human override. Log override reason.

**BR-04**: IF claim has no scrubbing findings, THEN auto-submit via routing engine with zero human touch.

**BR-05**: IF canonical payer has an active, healthy (>95% success rate over 7 days) RPA portal script, THEN route to RPA. ELSE IF Stedi can route to this payer, THEN route to EDI. ELSE queue for manual submission.

**BR-06**: IF claim requires attachment AND channel is RPA, THEN upload attachment via portal during submission flow (preferred — $0 cost).

**BR-07**: IF claim requires attachment AND channel is EDI, THEN route to RPA instead if RPA is available for this payer (to avoid NEA cost at launch). IF RPA unavailable, THEN queue for manual attachment handling.

**BR-08**: IF RPA bot fails 3 consecutive times for a payer, THEN disable RPA for that payer, route to EDI, alert engineering.

**BR-09**: IF 277CA rejects a claim (or RPA portal indicates rejection), THEN route back to scrubbing queue with rejection reason. Correct and resubmit with frequency code "7" (replacement) and original reference number.

**BR-10**: IF submission fails on both RPA and EDI, THEN queue for manual submission. Alert billing specialist within 1 hour.

**BR-11**: Always bill at UCR fee from PMS fee schedule. Never submit contracted/allowed amounts.

**BR-12**: IF CDT code is a restorative procedure (D2xxx) AND surface count does not match code suffix, THEN block with error.

**BR-13**: IF CDT code changes between encounter date and submission date (annual Jan 1 update), THEN use the CDT code valid on the DATE OF SERVICE.

**BR-14**: IF a claim has > 50 service lines, THEN split into multiple claims.

**BR-15**: Charge posting is the PMS's responsibility. Our system reads charges, does not post them. IF procedure data pulled from PMS has $0 charges, THEN flag for review rather than posting charges ourselves. `[depends: U-21]`

**BR-16**: IF PMS write fails during claim status sync, THEN retry up to 3 times with exponential backoff. Continue with claim submission regardless. Alert staff after 1 hour of failed sync.

**BR-17**: IF 277CA rejects a claim AND claim was synced to PMS as "submitted," THEN update PMS claim status to "rejected." On resubmission, update back to "submitted."

**BR-18**: Our platform's claim state machine is the source of truth. The PMS is a downstream sync target. On divergence, our state wins and PMS is re-synced.

---

## KPIs and Targets

### KPI-01: Clean Claim Rate
- **Definition:** Claims accepted on first submission (277CA A1/A2, or portal acceptance) / total claims submitted. Per calendar month.
- **Why it matters:** Every rejection requires human rework.
- **Target:** 95% at launch (Tier 1-2 scrubbing only), 98% steady state (with Tier 3-4).
- **Confidence:** Medium. `[depends: U-10 for Tier 3-4 accuracy]`
- **Measurement:** Acceptance count / submission count. Source: submission audit log + acknowledgment processing.

### KPI-02: Auto-Submission Rate
- **Definition:** Claims that pass scrubbing and submit without human intervention / total claims assembled. Per calendar month.
- **Why it matters:** The "minimal human touch" metric for submission.
- **Target:** 70% at launch, 85% steady state.
- **Confidence:** Low. Depends on data quality from PMS (how often is procedure data complete and clean?) and rendering provider NPI availability. `[depends: U-07, U-02]`
- **Measurement:** Claims with zero human interactions from assembly to submission / total assembled.

### KPI-03: Time to Submit
- **Definition:** Median elapsed time from procedure completion in PMS to claim transmitted to payer. Per calendar month.
- **Why it matters:** Faster submission = faster payment.
- **Target:** < 4 hours for auto-submitted claims (bounded by PMS polling cadence + scrubbing + submission).
- **Confidence:** High for auto-submitted claims. `[depends: U-24 for polling cadence]`
- **Measurement:** PMS procedure completion timestamp → submission timestamp.

### KPI-04: Rejection Rate
- **Definition:** Claims rejected (277CA A3-A8, or portal rejection) / total submitted. Per calendar month.
- **Why it matters:** Each rejection reason feeds back into scrubbing rules.
- **Target:** < 5% at launch, < 2% steady state.
- **Measurement:** Rejection count / submission count.

### Excluded KPIs

Out of scope for this spec:
- **Days in A/R** — depends on adjudication + ERA posting
- **Denial rate** — post-adjudication; denial management spec
- **Net collection rate** — payment posting + patient collections
- **Auto-post rate** — ERA processing spec
- **Cost per claim** — full lifecycle metric

---

## Out of Scope (Separate Specs)

| Area | Boundary | Notes |
|------|----------|-------|
| **Claim status tracking** | Ends at 277CA acceptance / portal confirmation. 276/277 polling is separate. | |
| **ERA/835 processing** | Parsing remittance, matching payments, posting to PMS. | |
| **PMS ledger sync (post-submission)** | Payment posting, adjustments, write-offs, refunds, reconciliation. This spec owns PMS sync through acceptance/rejection only. | |
| **Denial management** | Post-adjudication denials. Rejected claims (pre-adjudication) ARE in scope — they re-enter scrubbing. | |
| **Secondary/COB claims** | Auto-generating from primary ERA data. | |
| **Patient billing** | Statements, collections, online payment. | |
| **Dashboards & reporting** | Shared capability. Submission KPIs above are measured but the UI is separate. | |
| **Paper claims** | Not supported. Payers that can't take EDI/portal are not supported at launch. | |
| **Medicaid dental** | State-specific portals, different workflows. Out of scope until validated. `[depends: U-15]` | |
| **NEA FastAttach** | Deferred. Attachments handled via RPA portal upload or manual upload at launch. | |

---

## Open Questions

**OQ-01: Is charge posting really the PMS's responsibility in all cases?**
- BR-15 assumes the PMS posts charges when the dentist charts. This is standard behavior but needs confirmation for both Open Dental and Eaglesoft.
- IF some practices delay charting finalization, our polling may pick up incomplete data.
- `[blocked by: U-21]`
- Who decides: Engineering (fact-finding with sample practices)

**OQ-08: What PMS polling cadence?**
- Options: (A) every 1-5 minutes — near real-time, (B) every 15-30 minutes — balanced, (C) configurable per practice
- Tradeoff: shorter cadence = faster submission but more DB load on practice's PMS
- Who decides: Engineering (feasibility + PMS load impact)
- `[related: U-24]`

**OQ-09: How to collect rendering provider NPIs?**
- Individual dentist NPIs are a gap. Options:
  - (A) Add to onboarding UX — practice admin enters each dentist's NPI
  - (B) Pull from PMS provider table (Open Dental has a `provider` table with NPI)
  - (C) Look up via NPPES API using dentist name + practice address
  - (D) Combination — pull from PMS, verify against NPPES, prompt to confirm
- Who decides: Product + Engineering
- `[related: U-07]`
