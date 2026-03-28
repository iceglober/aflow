# Synthesis: E2E Dental Claim Submission Product Spec

**Status:** COMPLETE
**Last updated:** 2026-03-28

---

## 1. Executive Summary

- **The existing platform provides 60-70% of the foundation needed.** The encounter model (patient, subscriber, payer, provider data), Stedi EDI integration, RPA engine, and web app are all directly reusable. The primary new build is dental-specific data extensions (5-6 new tables), a claim scrubbing rules engine, 835 auto-posting logic, and an attachment workflow.

- **The "Big 6" payers cover ~80% of the commercial dental market.** Delta Dental (~35%), UHC (~15%), Cigna (~9%), MetLife (~8%), Aetna (~7%), and Guardian (~5%). Getting these six working unlocks the vast majority of addressable claim volume. Delta Dental is the hardest because it is a federation of 39 independent entities, each with its own systems.

- **EDI via Stedi should be the primary submission channel, with RPA as a strategic complement.** Stedi handles 837D generation, 835 parsing, and 276/277 status — all via modern JSON APIs the team already integrates with. RPA fills gaps: payers where Stedi enrollment is slow, portal-based attachment uploads ($0/attachment vs. $0.75-1.00 via NEA), and faster status feedback. At scale with maintenance factored in, RPA and EDI are roughly cost-equivalent (~$0.37-0.40/claim).

- **Attachments are not an afterthought — they are a core workflow.** 25-40% of dental claims require supporting documentation (X-rays, perio charts, narratives). For EDI-submitted claims, NEA FastAttach is the de facto standard ($0.75-1.00/attachment). For RPA-submitted claims, portal upload is free. The attachment-before-claim sequencing requirement (NEA# must be in PWK segment) adds a mandatory pipeline step.

- **The scrubbing rules engine and 835 auto-posting logic are the two biggest differentiators.** These are what make "minimal human touch" real. Scrubbing prevents 60-80% of denials pre-submission; auto-posting eliminates manual ERA entry. Both are core build — they cannot be bought off the shelf without losing the competitive moat.

- **Target: <20% human touch rate across the claim lifecycle.** 85%+ of claims auto-submitted, 90%+ of ERA payments auto-posted, 30%+ of denials auto-corrected. The denial feedback loop (denial patterns feed scrubbing rules) creates a data flywheel that improves over time.

- **Phased rollout over ~30-40 weeks** from foundation (Stedi 837D + encounter extensions) through optimization (denial pattern analysis, data flywheel). First claim submission in 8-12 weeks; end-to-end lifecycle in 14-20 weeks.

---

## 2. Platform Leverage Assessment

### What the Existing Platform Gives You For Free

| Existing Asset | Reuse for Dental Claims | Effort to Extend |
|---------------|------------------------|-----------------|
| **Encounter model** (running eligibility) | Patient demographics, subscriber info, payer info, service dates — all directly reusable for 837D | Low — need to add dental-specific fields (see below) |
| **Stedi integration** (EDI) | 837D generation (JSON->X12), 835 parsing (X12->JSON), 270/271 eligibility, 276/277 status — Stedi supports all HIPAA dental transaction sets | Low — extend to dental-specific segments (SV3, TOO, DN1/DN2) |
| **RPA engine** | Portal automation for payers where EDI is slow/unavailable, attachment upload ($0/attachment), claim status checks, ERA scraping | Medium — need dental-specific portal scripts per payer |
| **Web app** | Staff-facing UI for claim status, denial management, approval workflows | Low — extend with dental claim views |

### What Needs to Be Built

| Component | Complexity | Why It's Needed |
|----------|-----------|----------------|
| **Encounter model dental extensions** | Medium | CDT codes, tooth numbers, surfaces, oral cavity, prosthesis info, orthodontic info, missing teeth, dental-specific provider taxonomy. 5-6 new data tables. |
| **Claim scrubbing rules engine** | Medium-High | Payer-specific business rules (frequency limits, preauth requirements, bundling, age restrictions). Stedi validates X12 structure only, not clinical/payer rules. |
| **835 auto-posting logic** | High | Core differentiator. Maps ERA data to PMS ledger entries (payments, write-offs, patient responsibility transfers). Handles partial pays, denials, COB. |
| **Attachment workflow** | Medium | Storage, linking to encounters, NEA FastAttach integration for EDI claims, portal upload via RPA. 25-40% of dental claims need attachments. |
| **Submission routing layer** | Medium | Per-claim decision engine: EDI (Stedi) vs. RPA (portal) vs. secondary clearinghouse. Includes fallback logic. |
| **Secondary claim automation** | Medium | Auto-generate COB claims from primary ERA data. Map primary CAS/CLP into 837D Loop 2320/2330. |
| **PMS sync layer** | High | Business logic for all 10 lifecycle-to-ledger events. Abstracted across PMS backends. |

### Biggest Gap

**The scrubbing/rules engine + PMS auto-posting logic.** These are the two capabilities that make "minimal human touch" possible. Stedi handles commodity EDI plumbing, and the RPA engine handles portal automation, but the intelligence layer — knowing *which* claims will be denied before submission and posting ERA data correctly to the PMS — is entirely new build. This is also the primary competitive moat.

---

## 3. Recommended Architecture

### High-Level System View

```
                                    ┌─────────────────────┐
                                    │    PMS Systems       │
                                    │ (Dentrix, Eaglesoft, │
                                    │  Open Dental, Curve) │
                                    └──────────┬──────────┘
                                               │ PMS Sync Layer
                                               │ (abstracted)
┌──────────────┐    ┌──────────────────────────┴───────────────────────┐
│  Web App     │    │              PLATFORM CORE                       │
│  (Staff UI)  │◄──►│                                                  │
│  - Claims    │    │  ┌─────────────────┐  ┌────────────────────────┐ │
│  - Status    │    │  │ Encounter Model │  │ Claim Manager          │ │
│  - Denials   │    │  │ + Dental Ext.   │  │ - State machine        │ │
│  - Approvals │    │  │ - CDT codes     │  │ - Scrubbing engine     │ │
│              │    │  │ - Teeth/surfaces │  │ - Submission routing   │ │
│              │    │  │ - Prosthesis     │  │ - Status tracking      │ │
│              │    │  │ - Orthodontic    │  │ - Denial management    │ │
│              │    │  │ - Missing teeth  │  │ - Appeal workflow      │ │
│              │    │  └─────────────────┘  │ - COB automation       │ │
│              │    │                        └────────┬───────────────┘ │
│              │    │                                 │                 │
│              │    │  ┌─────────────────┐  ┌────────┴───────────────┐ │
│              │    │  │ Attachment Mgr  │  │ ERA Processor          │ │
│              │    │  │ - Storage (S3)  │  │ - 835 parsing (Stedi)  │ │
│              │    │  │ - NEA FastAttach│  │ - Auto-posting logic   │ │
│              │    │  │ - Portal upload │  │ - Payment matching     │ │
│              │    │  └─────────────────┘  │ - EFT reconciliation   │ │
│              │    │                        └────────────────────────┘ │
└──────────────┘    └────────────┬─────────────────────┬───────────────┘
                                 │                     │
                    ┌────────────┴────────┐  ┌────────┴──────────┐
                    │  Submission Router  │  │  Inbound Router   │
                    │  (per-claim logic)  │  │  (835, 277, 277CA)│
                    └──┬───────────┬──────┘  └──┬────────────┬───┘
                       │           │            │            │
              ┌────────┴───┐  ┌───┴────────┐   │   ┌────────┴────┐
              │ Stedi EDI  │  │ RPA Engine │   │   │ Stedi EDI   │
              │ (837D out) │  │ (Portal    │   │   │ (835/277 in)│
              │ + NEA      │  │  submit)   │   │   │             │
              │ (attach)   │  │ + attach   │   │   │ RPA (portal │
              └────────────┘  └────────────┘   │   │  EOB scrape)│
                                               │   └─────────────┘
                                          ┌────┴─────────┐
                                          │ Secondary CH │
                                          │(DentalXChange│
                                          │ gap-fill)    │
                                          └──────────────┘
```

### Encounter Model Extensions (New Tables)

```sql
encounter_dental_service {
  encounter_id        FK
  cdt_code            VARCHAR(5)     -- D-prefixed CDT code
  tooth_number        VARCHAR(2)     -- 1-32 or A-T
  tooth_surfaces      VARCHAR(5)     -- Combination: M,O,D,B,F,L,I
  oral_cavity_code    VARCHAR(2)     -- When not tooth-specific (quadrant/arch)
  quantity            INT
  line_charge         DECIMAL(10,2)
}

encounter_prosthesis {
  encounter_id        FK
  service_line_id     FK
  initial_placement   BOOLEAN
  prior_placement_date DATE
}

encounter_orthodontic {
  encounter_id        FK
  total_months        INT
  remaining_months    INT
  banding_date        DATE
  initial_exam_date   DATE
}

encounter_missing_teeth {
  encounter_id        FK
  tooth_number        VARCHAR(2)
  missing_reason_code VARCHAR(2)     -- E=extraction, M=congenital, U=unknown
}

encounter_dental_provider {
  encounter_id        FK
  billing_npi         VARCHAR(10)    -- Type 2 (organization)
  rendering_npi       VARCHAR(10)    -- Type 1 (individual dentist)
  referring_npi       VARCHAR(10)
  billing_taxonomy    VARCHAR(15)    -- e.g., 1223G0001X
  rendering_taxonomy  VARCHAR(15)
  license_number      VARCHAR(20)
}
```

### Submission Routing Decision Logic

```
For each claim:
1. Check payer -> Is Stedi enrolled for this payer?
   Yes -> Route via Stedi EDI
     -> Does claim need attachment?
        Yes -> Send attachment via NEA FastAttach first, get NEA#, insert into PWK segment
        No -> Submit 837D directly
   No -> Is RPA bot available for this payer portal?
     Yes -> Route via RPA (includes attachment upload at $0/attachment)
     No -> Route via secondary clearinghouse (DentalXChange)

2. On submission failure:
   EDI fail -> Fallback to RPA portal
   RPA fail -> Fallback to EDI via secondary clearinghouse
   All fail -> Queue for manual submission, alert staff
```

### Build vs. Buy Summary

| Capability | Decision | Vendor | Rationale |
|-----------|---------|--------|-----------|
| X12 generation/parsing | **BUY** | Stedi | Commodity; don't build |
| Clearinghouse routing | **BUY+HYBRID** | Stedi + DentalXChange + RPA | Stedi primary, gaps filled |
| Claim scrubbing (structural) | **BUY** | Stedi (included) | Guide-based validation |
| Claim scrubbing (business rules) | **BUILD** | In-house | Core differentiator; data flywheel |
| Attachment storage | **BUILD** | S3/blob storage | Simple; link to encounters |
| Attachment delivery | **HYBRID** | NEA FastAttach + RPA | NEA for EDI claims, RPA for portal claims |
| 835 parsing | **BUY** | Stedi | Commodity; don't build |
| 835 auto-posting | **BUILD** | In-house | Core differentiator; "minimal human touch" |
| 276/277 status tracking | **HYBRID** | Stedi + in-house orchestration | Stedi for transactions, own polling/UX |
| Portal RPA | **BUILD** | In-house RPA engine | Already have engine; extend to dental portals |
| PMS integration | **BUILD** | In-house (abstracted) | Core platform capability |

### HIPAA Compliance Requirements

- Platform is a **Business Associate** — BAAs required with every dental practice and every subcontractor (Stedi, cloud providers, RPA infrastructure)
- PHI encryption: AES-256 at rest, TLS 1.2+ in transit
- Audit logging on all PHI access
- NPI validation against NPPES before submission
- Taxonomy code validation (must match provider's NPPES registration)
- CDT code version management (annual update effective January 1)
- Annual HIPAA risk assessment
- Breach notification procedures (60-day for 500+ individuals)
- Watch: HIPAA Attachment Standard (275/C-CDA) enforcement expected 2026-2027; build attachment system with pluggable delivery layer

---

## 4. PMS Ledger Sync — Complete Business Logic

### Ledger Entry Types

The PMS ledger is the financial source of truth. Every claim lifecycle event must map to a ledger entry to keep A/R accurate. The platform's PMS integration layer is abstracted (mechanism varies by PMS: Dentrix, Eaglesoft, Open Dental, Curve, etc.), but the business logic below is universal.

| Entry Type | Debit/Credit | A/R Effect | Source |
|-----------|-------------|-----------|--------|
| **Charge** | Debit | +A/R | Encounter/procedure completion |
| **Insurance Payment** | Credit | -A/R | 835 ERA posting |
| **Patient Payment** | Credit | -A/R | Patient payment (checkout or later) |
| **Contractual Write-Off** | Credit | -A/R | 835 ERA — CO adjustment group |
| **Insurance Adjustment** | Credit or Debit | +/- A/R | 835 ERA — various groups |
| **Patient Adjustment** | Credit | -A/R | Manual write-off, courtesy discount |
| **Refund** | Debit | +A/R or -Cash | Overpayment refund |
| **Transfer** | Net zero | Moves buckets | Insurance balance to patient balance |

### Complete Lifecycle-to-Ledger Event Map

**Event 1: Encounter/Procedure Completion**
- Trigger: Dentist completes procedures, encounter finalized
- Ledger: One charge line per CDT code at practice's full fee schedule rate (NOT contracted rate)
- A/R: Increases by total charges, allocated to insurance and patient estimated portions
- PMS state: "Ready to Submit"
- Critical rule: Post at full fee; contractual adjustment comes later from ERA

**Event 2: Claim Submission (837D Sent)**
- Trigger: 837D transmitted to clearinghouse/payer
- Ledger: NO financial entries — status update only
- PMS state: "Submitted" with submission date, control number, payer reference

**Event 3: Claim Acknowledgment (277CA)**
- Trigger: Clearinghouse/payer acknowledgment received
- Ledger: NO financial entries — status update only
- PMS state: Accepted (A1/A2) -> "Accepted/In Process"; Rejected (A3-A8) -> "Rejected"
- Critical rule: Rejected claims do NOT trigger charge reversal; charges remain on ledger, claim corrected and resubmitted

**Event 4: ERA — Full Payment (835)**
- Trigger: Payer pays claim in full
- Ledger per service line (from SVC segment):
  - Insurance payment (SVC03 paid amount)
  - Contractual write-off (CAS CO group, CARC 45 — difference between billed and allowed)
  - Patient responsibility transfers: deductible (PR/CARC 1), coinsurance (PR/CARC 2), copay (PR/CARC 3)
- After posting: Insurance A/R = $0; remaining amount becomes patient A/R
- PMS state: "Paid" / "Closed"

**Event 5: ERA — Partial Payment / Partial Denial**
- Paid lines: Same as Event 4
- Denied lines: CO denial = contractual write-off (cannot bill patient); PR denial = transfer to patient balance; OA denial = requires manual review
- PMS state: "Partially Paid — Review Required"

**Event 6: ERA — Full Denial**
- Trigger: Entire claim denied
- Ledger: NO auto-write-off — flag for review
- Workflow: Categorize by CARC -> correctable (resubmit), appealable (appeal + attachments), final (write-off or patient transfer)
- Critical rule: Never auto-write-off denials. Many are correctable or appealable. Auto-posting loses revenue.
- PMS state: "Denied — Pending Review"

**Event 7: Secondary ERA (COB)**
- Trigger: Secondary payer adjudicates after primary
- Ledger: Secondary payment + secondary write-off against remaining balance
- PMS state: "Secondary Paid"; remaining = final patient balance

**Event 8: Write-Off**
- Types (must track separately for accounting/tax): Contractual, denial, bad debt, courtesy, small balance

**Event 9: Refund**
- Insurance refund or patient refund as debit entries
- Insurance recoupment via PLB segment on subsequent 835 — reduces net batch payment; must handle to avoid misposting
- Critical rule: PLB adjustments affect provider/payment level, NOT individual claim balances

**Event 10: Claim Correction/Replacement**
- Preferred: Submit replacement claim (frequency code 7); don't touch ledger until replacement ERA arrives
- Alternative: Void (frequency code 8) + new original (frequency code 1)

### Reconciliation Invariants (Must Hold at All Times)

1. `Charge = Insurance Paid + Contractual Write-Off + Patient Paid + Patient Balance + Other Adjustments`
2. After ERA posting, insurance A/R for that claim = $0
3. `Patient A/R = Patient Responsibility - Patient Payments - Patient Write-Offs`
4. `Total Revenue = Total Payments + Write-Offs + Outstanding A/R`
5. PLB adjustments affect aggregate payment level, NOT individual claim balances

### Claim State Machine

```
ENCOUNTER_CREATED -> Charges posted -> CLAIM_READY
CLAIM_READY -> 837D submitted -> CLAIM_SUBMITTED
CLAIM_SUBMITTED -> 277CA Accepted -> CLAIM_ACCEPTED
CLAIM_SUBMITTED -> 277CA Rejected -> CLAIM_REJECTED -> Correct -> CLAIM_SUBMITTED
CLAIM_ACCEPTED -> 835 Full Pay -> CLAIM_PAID -> (if COB) -> SECONDARY_READY -> SECONDARY_SUBMITTED -> SECONDARY_PAID -> CLAIM_CLOSED
CLAIM_ACCEPTED -> 835 Partial -> CLAIM_PARTIAL -> Appeal or Write-off -> CLAIM_CLOSED
CLAIM_ACCEPTED -> 835 Denied -> CLAIM_DENIED -> Resubmit / Appeal / Write-off -> CLAIM_CLOSED
CLAIM_ACCEPTED -> 277 Pended -> CLAIM_PENDED -> Submit info -> CLAIM_ACCEPTED
APPEAL_SUBMITTED -> Approved -> CLAIM_PAID / Denied -> CLAIM_CLOSED
CLAIM_CLOSED -> Patient balance? -> Yes: Statement generated / No: Done
```

---

## 5. Submission Channel Strategy

### Market Structure

The U.S. dental benefits market covers ~200 million commercially insured lives, ~$90B in annual premiums. The "Big 6" — Delta Dental (~35%), UHC (~15%), Cigna (~9%), MetLife (~8%), Aetna (~7%), Guardian (~5%) — collectively cover ~75-80% of commercially insured dental lives. Getting these six working unlocks the vast majority of the market.

**Critical nuance: Delta Dental is a federation** of 39 independent companies, each with its own portal, systems, and sometimes different claim rules. For RPA purposes, each Delta entity is a distinct payer. This is the single biggest RPA maintenance burden.

### Channel Mix (How Dental Claims Actually Flow Today)

| Channel | % of All Dental Claims | Trend |
|---------|----------------------|-------|
| EDI via clearinghouse | ~60-65% | Growing |
| EDI direct payer connection | ~5-10% | Stable (DSOs only) |
| Payer web portal (manual) | ~15-20% | Declining |
| Paper (ADA form) | ~10-15% | Declining |

Dental electronic adoption lags medical by 10-15 percentage points (~84% vs ~96% for claims). This gap = both challenge (more fragmentation) and opportunity (more room to add value).

### Recommended Channel Strategy: EDI-Primary, RPA-Complement

**Primary: EDI via Stedi** for the major payers they support
- All Big 6 accept 837D via clearinghouse
- Per-claim cost: $0.05-0.15
- Reliable (99.5-99.9% uptime, SLA-backed)
- Standardized acknowledgment (999/277CA) and audit trail

**Complement: RPA portal automation** for strategic gaps
- Payers where Stedi enrollment is slow or unavailable
- Attachment upload during claim submission ($0/attachment vs. $0.75-1.00 via NEA)
- Eligibility/claim status for portals with weak EDI support
- Fallback when EDI is down

**Attachments: Hybrid approach**
- Portal-based claims (via RPA): Upload attachments directly through portal. Zero incremental cost.
- EDI-based claims (via Stedi): NEA FastAttach ($0.75-1.00/attachment, ~60-70% market share, universal payer acceptance). Stedi does not handle dental attachments natively.
- 25-40% of dental claims need attachments (vs. ~5-10% medical) — this is not an afterthought, it is a core workflow.
- NEA# (attachment tracking number) must be captured and inserted into 837D PWK segment BEFORE claim submission. This creates a mandatory sequencing step in the claim pipeline.

### Portal Automation Difficulty by Payer

| Payer | Auth Pattern | Automation Difficulty | Notes |
|-------|-------------|---------------------|-------|
| Delta Dental (varies) | MFA (varies by state entity) | HARD (fragmentation) | Need 5-10 separate RPA scripts for major states |
| UHC | Username/PW + MFA (email/SMS) | MEDIUM | Aggressive session timeouts (~15 min); SPA rendering waits |
| Cigna | Username/PW + MFA | MEDIUM | Occasional CAPTCHA risk on login |
| MetLife | Username/PW + MFA (email OTP) | EASY-MEDIUM | Well-structured DOM, stable portal |
| Aetna (via Availity) | Two-layer auth (Availity + Aetna) | MEDIUM-HARD | Complex JavaScript state management |
| Guardian | Username/PW + TOTP | EASY-MEDIUM | TOTP is easier to automate than SMS |

### Cost Model at Scale (10,000 claims/month, 30% attachment rate)

| Approach | Year 1 Total | Year 2+ Annual | Effective Per-Claim |
|----------|-------------|---------------|-------------------|
| Pure EDI (Stedi + NEA) | ~$94K | ~$44K | $0.37 |
| Pure RPA (6 portals) | ~$106K | ~$46K | $0.38 |
| Hybrid (EDI primary + RPA 3 portals) | ~$83K | ~$48K | $0.40 |

**Key finding: Pure RPA is roughly cost-equivalent to EDI when maintenance is included.** The RPA advantage is most pronounced when: (a) the RPA engine already exists (amortized cost), (b) portal access is needed for other functions (eligibility, status, EOB), (c) attachment volumes are high ($0/attachment via portal), (d) targeting few high-volume payers (fewer scripts to maintain).

**Hidden RPA costs:** 40-80 hrs per portal to build ($6K-12K each), 5-15 hrs/month per portal maintenance ($750-2,250/month each), credential/MFA management overhead, 95-98% uptime vs. 99.5-99.9% for EDI.

### Payer Coverage Phasing

- **Phase 1:** Delta Dental (top 5 state entities), MetLife, Cigna — covers ~55% of market
- **Phase 2:** UHC, Aetna, Guardian — covers ~80% cumulative
- **Phase 3:** Humana, Ameritas, Principal, long tail — covers ~90%+ cumulative

### Clearinghouse Landscape Summary

| Clearinghouse | Per-Claim Cost | Dental Payer Coverage | Attachment Support | Best For |
|--------------|---------------|----------------------|-------------------|----------|
| **Stedi** | $0.05-0.15 | Growing (check specific payers) | No (need NEA) | API-first EDI, already in stack |
| **DentalXChange** | $0.12-0.35 | Excellent (900+ dental payers) | Yes (bundled) | Gap-fill for payers Stedi can't reach |
| **Tesia/Change HC** | $0.15-0.30 | Strong | Yes (via NEA) | Legacy; risk from 2024 cyberattack fallout |
| **NEA FastAttach** | N/A (attachments only) | Universal for attachments | Yes ($0.75-1.25/attachment) | Attachment-only; de facto standard |
| **Availity** | Free (payer-subsidized) | Aetna, Humana primary | Limited | Portal-centric payers |

---

## 6. Automation Opportunities & Human Touchpoints

### Automation Tiers (Synthesized from All Research Streams)

**Tier 1: Fully Automated — Zero Human Touch**

| Capability | Mechanism | Notes |
|-----------|-----------|-------|
| Eligibility verification (270/271) | Stedi API, run before every encounter | Already supported by existing encounter model |
| Claim assembly from encounter data | Auto-populate from encounter + provider master + payer master + fee schedule | 80%+ of 837D fields auto-populatable |
| Pre-submission scrubbing (structural) | Stedi guide-based validation | Catches X12 format errors |
| Pre-submission scrubbing (clinical Tier 1-2) | In-house rules engine | Tooth/surface validation, CDT code validity, NPI check |
| 837D generation and EDI submission | Stedi JSON-to-X12 API | Primary channel for ~70% of claims |
| RPA portal submission | In-house RPA engine | For payers where RPA is preferred |
| 277CA acknowledgment processing | Stedi 277 parsing | Auto-update claim status |
| 276/277 claim status polling | Stedi + scheduling engine | Every 3-5 business days for pending claims |
| 835 ERA parsing | Stedi X12-to-JSON | Structured JSON output |
| 835 auto-posting (standard payments) | In-house posting logic | Payment + CO write-off + PR transfer |
| Secondary claim auto-generation | In-house COB engine | Trigger on primary ERA post when secondary exists |
| Filing deadline monitoring | Scheduling engine | Alert at 80% of payer deadline |
| CDT code annual refresh | Config management | Update code tables every January 1 |

**Tier 2: Semi-Automated — System Prepares, Human Approves**

| Capability | What System Does | What Human Does |
|-----------|-----------------|----------------|
| Frequency/benefit limit warnings (Tier 3 scrub) | Warn "prophy last done 5 months ago, payer limits to 6 months" | Override with reason or hold claim |
| Payer-specific rule warnings (Tier 4 scrub) | Warn "Delta Dental CA requires narrative for D4341 all-quad same day" | Add narrative or override |
| Attachment assembly | Detect which claims need attachments, pull from patient imaging record | Confirm correct images selected, upload |
| Auto-correctable denials (Tier A) | Correct data errors, prepare resubmission | Review before auto-resubmit (initially; graduate to full auto) |
| Semi-auto denials (Tier B) | Prepare appeal letter, pre-fill correction form | Approve, modify, or reject corrective action |
| Out-of-network balance billing decisions | Present remaining balance after CO adjustment | Decide: bill patient, write off, or partial adjust |
| PLB recoupment review | Flag take-back, show affected claim | Decide: accept or appeal recoupment |
| Unmatched ERA resolution | Fuzzy match suggestions | Confirm or manually match |

**Tier 3: Human-Required — No Viable Automation**

| Capability | Why Human Required |
|-----------|-------------------|
| Complex appeal narratives (Tier C denials) | Clinical judgment needed — provider must explain medical necessity |
| Peer-to-peer reviews with payer dental directors | Provider-to-provider clinical discussion |
| Bad debt write-off decisions | Financial/business judgment |
| Courtesy adjustment approvals | Practice policy decision |
| Predetermination result communication to patients | Patient-facing communication |
| OA (Other Adjustment) denials | Ambiguous — varies case by case |

### Expected Human Touch Rates

| Metric | Target | Basis |
|-------|--------|-------|
| **Auto-Submission Rate** (claims submitted without human intervention) | >85% | Product spec target; 80%+ of data auto-populatable, 98% clean claim rate after scrubbing |
| **Auto-Post Rate** (ERA payments auto-matched and posted) | >90% | Standard ERA matching via CLP01/CLP07; exceptions for unmatched or failed math validation |
| **Auto-Correction Rate** (denials auto-corrected) | >30% of denials | Tier A denials (data errors, missing info, attachment gaps) |
| **Human Touch Rate** (claims requiring ANY human intervention) | <20% | The headline metric; inverse of automation rate |
| **Scrub-to-Submit Time** | <4 hours | Same-day submission after encounter completion |
| **ERA-to-Post Time** | <1 hour (auto), <24 hours (including exceptions) | Auto-post is near-instant; manual exceptions within 1 business day |

### Denial Prevention Potential

A well-built system can prevent 60-80% of denials through:
1. Pre-submission eligibility verification (270/271) — catches eligibility, benefit maximum, and frequency issues
2. Payer-specific rule engine (preauth requirements, frequency limits, age restrictions, bundling rules, attachment requirements, filing deadlines) — catches clinical/business denials
3. 4-tier pre-submission claim scrubbing — catches structural and coding errors
4. Proactive attachment submission — avoids 30-60 day "pended for documentation" cycle
5. Automated 277/835 monitoring with denial pattern learning loop — continuously improves scrubbing rules

### Dental-Specific Complexity Drivers (vs. Medical)

- 25-40% of dental claims require attachments (X-rays, perio charts, narratives) vs. ~5-10% medical
- Tooth/surface data requirements vary by CDT code category (restorative needs surfaces, crowns don't, endo needs tooth only)
- Annual maximums ($1,000-$2,500 typical) create a benefit tracking problem not seen in most medical plans
- Frequency limitations (prophy every 6 months, bitewings every 12 months) require date-of-last-service tracking
- 10-15% of dental patients have dual coverage (COB), often through both parents' employer plans for children
- Prosthetic replacement rules (once per 5-10 years per tooth) require historical tracking
- CDT code set is smaller (~800 codes vs. ~10,000+ CPT) but updated annually and date-of-service-sensitive

---

## 7. Key Risks & Open Questions

### Cross-Agent Contradictions and Tensions

1. **RPA cost advantage vs. maintenance burden.** The payer landscape agent (02) estimates RPA at $0.08/claim effective cost, while the technical agent (03) calculates it at $0.38/claim when maintenance is included. The product spec agent (04) splits the difference at $0.05-0.15/claim "at scale." The true answer depends on the team's existing RPA engine amortization — if the engine is already built and maintained for other workflows, marginal RPA cost for dental portals is closer to $0.08; if dental is the first RPA use case, $0.38 is more realistic. **Resolution: Use the team's actual RPA infrastructure cost data to set the right threshold.**

2. **Attachment rate discrepancy.** The domain agent (01) cites 30-35% of dental claims require attachments. The payer landscape agent (02) cites 25-40%. The product spec agent (04) uses 30%. These are consistent enough for planning purposes, but the actual rate varies significantly by practice type (specialty practices like perio/endo may exceed 50%). **Resolution: Track actual attachment rate per practice during onboarding; use 30% as the default planning assumption.**

3. **Clean claim rate targets.** The product spec agent (04) targets 98%+ clean claim rate, citing industry average of 90-95%. The domain agent (01) notes that 5-10% of dental claims are denied (post-adjudication), separate from rejection rate. These metrics are different: clean claim rate measures pre-adjudication acceptance, denial rate measures post-adjudication outcomes. Both targets are achievable but measuring different things. **Resolution: Track both metrics separately. Clean claim rate (pre-adjudication) target: 98%. Denial rate (post-adjudication) target: <5%.**

### Gaps in Research

4. **Stedi dental payer coverage gap is unquantified.** All agents note Stedi's payer network is "growing" but none provide a definitive list of which major dental payers Stedi currently supports. This is the single most important pre-build validation task. If Stedi cannot reach Delta Dental entities or MetLife directly, the secondary clearinghouse or RPA dependency is much larger. **Action: Get Stedi's current dental payer list before architecture is finalized.**

5. **PMS integration complexity is under-explored.** The product spec correctly notes the integration mechanism is abstracted, but the actual difficulty of integrating with Dentrix, Eaglesoft, Open Dental, and Curve varies enormously. Open Dental has an API; Dentrix and Eaglesoft historically require local-agent or database-level integration. This could be the longest-pole item. **Action: Spike PMS integration for the top 2 target PMS systems before committing to timeline.**

6. **CDT code licensing cost and terms.** The technical agent (03) notes CDT codes are ADA-copyrighted and require a license. The annual cost and terms (especially for embedding in a SaaS platform serving multiple practices) are not specified. **Action: Contact ADA for CDT licensing terms for a multi-tenant platform.**

7. **State-specific dental billing regulations.** The technical agent (03) mentions some states have regulations about who can submit claims on behalf of a dental practice (licensed professional or registered clearinghouse requirements). These are not enumerated. **Action: Legal review for target launch states.**

### Operational Risks

8. **Delta Dental fragmentation is the biggest RPA maintenance risk.** With 39 independent entities, each with different portals, automating even the top 5 state entities requires 5 separate RPA scripts. Budget 40-80 hours each to build, 5-15 hours/month each to maintain. This single payer family could consume half the RPA maintenance budget.

9. **Portal anti-automation measures are increasing.** UHC and Aetna/Availity have added bot detection (DataDome, PerimeterX). CAPTCHAs appear on Cigna and Guardian login flows. The trend is toward more anti-automation, not less. RPA scripts that work today may face increasing resistance. **Mitigation: Treat EDI as the long-term default; use RPA as a transitional/supplemental channel.**

10. **Change Healthcare ecosystem risk.** Tesia (dental clearinghouse) is part of the Change Healthcare ecosystem that suffered a major ransomware attack in February 2024. Some practices and vendors have diversified away from Change Healthcare-linked services. If DentalXChange is selected as the secondary clearinghouse, confirm it is not Change Healthcare-dependent.

11. **HIPAA Attachment Standard (275) uncertainty.** The mandated electronic attachment standard is expected to be enforced 2026-2027, but enforcement has been repeatedly delayed. Building the attachment system with a pluggable delivery layer is essential — if the standard is enforced, NEA FastAttach and proprietary channels may need to transition. If it is delayed again, the current approach continues to work.

### Open Questions for Dental Billing Experts

12. Does the team's existing encounter model already capture ICD-10 diagnosis codes? Many dental payers now require them, and medical-dental cross-coding (billing medical insurance for trauma-related dental work) always requires ICD-10.

13. What is the planned approach for Medicaid dental (DentaQuest/SKYGEN/MCNA)? These have state-specific portals and different workflows. If in scope, this significantly expands the payer coverage challenge.

14. Should the product support predeterminations and pre-authorization requests, or focus exclusively on actual claim submission first? Predeterminations use the same 837D structure but with different BHT/CLM flags — supporting them is relatively low incremental effort and high value for practice adoption.

15. What is the patient payment collection strategy? The product spec describes posting patient payments and generating statements, but the collection mechanism (online patient portal, text-to-pay, paper statements, collection agency integration) is not specified.

---

## 8. Phased Rollout Recommendation

### Phase 1: Foundation (Weeks 1-12)

**Goal:** First dental claim submitted electronically via Stedi.

| Component | Effort | Details |
|----------|--------|---------|
| Encounter model dental extensions | 3-4 weeks | 5-6 new tables (dental_service, prosthesis, orthodontic, missing_teeth, dental_provider). CDT code table loaded. |
| Stedi 837D integration | 3-4 weeks | JSON-to-X12 for dental claims. Map encounter model to 837D segments (SV3, TOO, DN1, DN2). |
| Basic claim scrubbing (Tier 1-2) | 2-3 weeks | Structural validation + dental-specific clinical validation (tooth/surface rules per CDT code category). |
| Claim state machine | 2 weeks | CREATED -> SCRUBBING -> QUEUED -> SUBMITTED -> ACCEPTED/REJECTED status tracking. |
| Payer enrollment via Stedi | Parallel | Enroll with top 3-5 dental payers. Lead time: 5-30 business days per payer. |

**Unlocks:** First claims flowing end-to-end (encounter -> 837D -> payer). Staff can see claim status.

**Validation milestone:** Submit 100 claims across 3+ payers with >95% acceptance rate.

### Phase 2: Feedback Loop (Weeks 10-18)

**Goal:** End-to-end claim lifecycle — from submission through payment posting.

| Component | Effort | Details |
|----------|--------|---------|
| 835 ERA parsing via Stedi | 2-3 weeks | X12-to-JSON parsing. Inbound 835 receipt (webhook or polling). |
| 835 auto-posting logic | 4-5 weeks | Payment matching (CLP01/CLP07 + fuzzy), insurance payment posting, CO write-off posting, PR patient responsibility transfer. Math validation before posting. Exception queue for unmatched/unbalanced ERAs. |
| PMS ledger sync | 3-4 weeks | Implement the 10 lifecycle-to-ledger events. Charge posting, payment posting, adjustment posting. Reconciliation invariants. Abstracted across target PMS. |
| 276/277 status polling | 2 weeks | Stedi 276 generation + 277 parsing. Polling schedule (7-day cadence). Status dashboard updates. |
| Claim status dashboard | 2 weeks | Traffic light view per claim. Work queue for billing specialist. |

**Unlocks:** Full revenue cycle visibility. Payments auto-posted to PMS. Staff can manage denials.

**Validation milestone:** 90%+ ERA auto-match rate. Insurance A/R < 25 days.

### Phase 3: Quality & Attachments (Weeks 16-24)

**Goal:** Reduce denial rate via scrubbing, support attachment-heavy procedures.

| Component | Effort | Details |
|----------|--------|---------|
| Scrubbing rules engine (Tier 3-4) | 3-4 weeks | Frequency limitation checks, payer-specific rules table, soft warnings. Payer-rules-engine table keyed by (payer_id, CDT_code). |
| Attachment workflow | 3-4 weeks | Internal storage (S3), attachment-to-encounter linking, NEA FastAttach integration for EDI claims (PWK segment with NEA#). Attachment requirement detection per CDT code + payer. |
| Denial management workflow | 2-3 weeks | Tier A/B/C categorization, auto-correction for Tier A, suggested actions for Tier B, human queue for Tier C. |
| Secondary claim automation (COB) | 2-3 weeks | Auto-detect dual coverage from eligibility. Auto-generate secondary claim from primary ERA (Loop 2320/2330 mapping). |
| Appeal letter generation | 1-2 weeks | Template engine per CARC code. Auto-populated fields. Deadline tracking. |

**Unlocks:** Clean claim rate target 98%. Attachment-heavy procedures (crowns, SRP, implants) supported. COB automated.

**Validation milestone:** Denial rate < 7%. 30%+ of denials auto-corrected. Clean claim rate > 97%.

### Phase 4: RPA Expansion (Weeks 22-34)

**Goal:** Cost reduction via RPA for high-volume payers, faster status feedback.

| Component | Effort | Details |
|----------|--------|---------|
| RPA portal submission — UHC, MetLife | 4-6 weeks each | Portal-specific scripts. Includes attachment upload. |
| RPA portal submission — Availity (Aetna + Humana) | 4-6 weeks | Single bot covering two payers (2-for-1). |
| Submission routing engine | 2-3 weeks | Per-claim decision logic: EDI vs. RPA vs. secondary CH. Health score monitoring. Auto-failover. |
| RPA portal status checks | 2 weeks per payer | Portal-based claim status scraping. Faster than 277 for some payers. |
| RPA health monitoring | 2 weeks | Health score calculation, auto-failover rules, portal change detection. |

**Unlocks:** ~30% cost reduction on high-volume payers. Faster status feedback loop. Attachment cost savings.

**Validation milestone:** RPA health score >95% across all automated portals. Cost per claim < $0.35.

### Phase 5: Optimization (Ongoing, from Week 30+)

**Goal:** Continuous improvement via data flywheel.

| Component | Details |
|----------|---------|
| Denial pattern analysis | Track denials by payer/CDT/CARC. Auto-generate candidate scrubbing rules. Quarterly rules review. |
| Payer-specific rule refinement | Expand Tier 4 rules based on observed adjudication patterns. Target 50+ payer-specific rules in first 6 months. |
| Predetermination support | Same 837D structure with BHT06="13". One-click toggle from treatment plan. Store estimated amounts. |
| KPI dashboards | Practice manager and billing specialist dashboards. Payer performance comparison. A/R aging waterfall. |
| Reporting suite | Daily flash report, monthly summary, quarterly business review packet. |
| Additional payer portals (RPA) | Cigna, Delta Dental of CA, and evaluate long tail. Only if volume justifies. |

---

## 9. KPI Targets

### Primary KPIs

| KPI | Definition | Industry Benchmark | Platform Target (6-month) | Platform Target (12-month) |
|-----|-----------|-------------------|--------------------------|---------------------------|
| **Clean Claim Rate** | Claims accepted on first submission / total submitted | 90-95% | 97% | 98%+ |
| **First-Pass Resolution Rate** | Claims fully paid on first submission / total submitted | 80-85% | 90% | 92%+ |
| **Days in A/R (Insurance)** | Average days from charge to insurance payment | <21 days | <20 days | <18 days |
| **Days in A/R (Total)** | Average days from charge to full resolution | <30 days | <30 days | <28 days |
| **Denial Rate (Overall)** | Denied claims / total adjudicated | 5-10% | <7% | <5% |
| **Denial Rate (Preventive)** | Preventive procedure denials | N/A | <3% | <2% |
| **Denial Rate (Major)** | Major restorative/prosthodontic denials | 15-25% | <15% | <10% |
| **Net Collection Rate** | Payments / (Charges - Contractual Adjustments) | 98%+ (12-month) | 97% | 98.5%+ |
| **Cost Per Claim** | Total processing cost / claims processed | $6-12 (manual), $2.93 (electronic) | <$4.00 | <$3.50 |

### Automation KPIs

| KPI | Definition | Target |
|-----|-----------|--------|
| **Auto-Submission Rate** | Claims submitted without human intervention | >85% |
| **Auto-Post Rate** | ERA payments auto-matched and posted | >90% |
| **Auto-Correction Rate** | Denials auto-corrected and resubmitted | >30% of denials |
| **Human Touch Rate** | Claims requiring ANY human intervention from creation to close | <20% |
| **Scrub-to-Submit Time** | Encounter completion to claim submission | <4 hours (same day) |
| **ERA-to-Post Time** | ERA receipt to payment posted in PMS | <1 hour (auto), <24 hours (all) |
| **RPA Uptime** | Per-payer RPA script operational time | >99% |
| **Denial Recovery Rate** | Revenue recovered from denied claims via appeal/resubmission | >60% |

### Financial Health Indicators (Practice-Level)

| Metric | Target | Red Flag |
|--------|--------|----------|
| A/R 0-30 days | >65% of total A/R | <50% |
| A/R 60+ days | <10% of total A/R | >20% |
| A/R 120+ days | <2% of total A/R | >5% |
| Monthly collection rate | >96% | <90% |
| Contractual adjustment % | Consistent with payer mix | Sudden change >5% |

### KPI Calibration Notes

- **Clean claim rate of 98% is aggressive but achievable** with the 4-tier scrubbing engine and proactive attachment submission. The domain research confirms the top rejection/denial reasons are all scrubbing-preventable (invalid subscriber ID, invalid NPI, missing tooth/surface, frequency limits, missing preauth).

- **Days in A/R < 18 (insurance) is realistic for electronic-only submission.** The domain research notes electronic dental claims typically adjudicate in 5-14 business days. Adding 2-3 days for submission pipeline and 1-2 days for ERA posting gets to ~15-20 days total.

- **<20% human touch rate is the north star.** This breaks down as: ~85% of claims pass scrubbing and auto-submit (15% need human fix), ~90% of ERAs auto-post (10% need manual matching/review), ~30% of denials auto-correct (70% need human decision). The weighted average yields ~15-20% human touch across the lifecycle.

- **Cost per claim of <$3.50 assumes the hybrid EDI+RPA model.** At 10,000 claims/month: ~$3,100/month blended channel cost (Section 5) + platform infrastructure (~$2,000/month) + 0.5 FTE rules engine maintenance (~$4,000/month) = ~$9,100/month / 10,000 claims = ~$0.91 in direct costs. Add allocated engineering/overhead to reach $2.50-3.50 all-in.

- **Net collection rate of 98.5% requires both good claims management AND good patient collection.** The platform controls the insurance side; patient collection (statements, online payments, collection agency) is a dependency that must be addressed in the product roadmap.
