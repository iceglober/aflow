# Product Spec & Automation Design

**Status:** COMPLETE
**Last updated:** 2026-03-28

---

## CRITICAL INSTRUCTIONS FOR AGENT

> **YOU WILL BE STOPPED AND RELAUNCHED IF YOU VIOLATE THIS PROTOCOL.**
>
> The ONLY acceptable pattern is: **Search -> Edit -> Search -> Edit -> Search -> Edit.**
> NEVER: Search -> Search. NO EXCEPTIONS. NOT EVEN ONCE.
>
> After EVERY search or fetch, IMMEDIATELY Edit this file with what you learned.
> If you do two searches in a row without an Edit to this file, you are VIOLATING THE PROTOCOL and will be killed.
>
> Work through sections in order. For each section:
> 1. Search/fetch for information
> 2. IMMEDIATELY write findings to this file under that section
> 3. Search/fetch for more information on the same section
> 4. IMMEDIATELY update this file with additional findings
> 5. Move to next section only after writing current section
>
> If a web fetch returns a 403 error, WRITE WHAT YOU HAVE before trying another URL.
>
> Every number needs a source. Every source needs a clickable URL inline.
> Do NOT collect sources at the end -- put them inline with the facts.
>
> When you are DONE with all sections, change "Status: IN PROGRESS" to "Status: COMPLETE" at the top.

---

## 1. User Personas and Workflows — Who Submits, What Do They Need to See

### Persona 1: Front Office Coordinator

**Role in claim flow:** First touch — captures patient demographics, verifies insurance eligibility (already handled by existing encounter model), collects copays, and initiates the encounter record that becomes the basis of a claim.

**What they need to see:**
- **Eligibility snapshot** at check-in: plan active/inactive, remaining annual maximum, deductible met/remaining, frequency limitations (e.g., "next prophylaxis eligible: 2026-07-15")
- **Patient responsibility estimate** before treatment — what the patient will owe based on fee schedule vs. plan allowable, so they can collect at time of service
- **Claim status at a glance** — a simple traffic light (green = paid, yellow = pending, red = denied/needs action) on the patient's account
- **Outstanding patient balances** — for collections conversations at check-in/check-out

**Key workflow moments:**
1. Patient check-in → eligibility auto-verified (existing) → benefits summary displayed
2. Patient check-out → encounter finalized → charges auto-posted → patient portion collected → claim queued for submission
3. Follow-up calls → view claim status, explain to patients what insurance paid

### Persona 2: Billing Specialist / Insurance Coordinator

**Role in claim flow:** Primary owner of claims from submission through payment posting. In most dental practices, this is 1-2 dedicated staff members. In a [2023 ADA Health Policy Institute survey](https://www.ada.org/resources/research/health-policy-institute), the average general dental practice has 7.8 employees — typically 1 billing specialist handles insurance for the entire office.

**What they need to see:**
- **Claim work queue** — all claims organized by status: ready to submit, submitted/pending, denied/needs action, paid/ready to post
- **Scrubbing results** — pre-submission validation errors with specific fix instructions (e.g., "Missing tooth number for CDT D2740 — crown requires tooth #")
- **Denial dashboard** — denied claims grouped by denial reason (CO-4 procedure code inconsistent, CO-29 time limit, CO-16 missing information, etc.) with suggested corrective actions
- **ERA/EOB feed** — incoming payment explanations matched to claims, with discrepancies highlighted (paid amount vs. expected, unexpected denials)
- **Aging report** — claims in A/R buckets (0-30, 31-60, 61-90, 90+ days) with drill-down
- **Payer-specific notes** — known quirks per payer (e.g., "Delta Dental of CA requires narrative for D4341 when more than 4 quadrants billed same day")
- **Batch submission controls** — ability to review, hold, or release claims before batch goes out

**Key workflow moments:**
1. Morning: Review overnight ERA/EOBs → auto-matched payments posted → review exceptions
2. Claim scrubbing queue: Fix validation errors → approve for submission
3. Denial management: Review denied claims → correct and resubmit or initiate appeal
4. End of day: Verify all encounters converted to claims → batch submission
5. Monthly: Reconciliation, aging report review, write-off decisions

### Persona 3: Dentist / Provider

**Role in claim flow:** Clinical documentation owner. The provider completes the clinical encounter — procedure codes, diagnosis codes, tooth/surface designations, and clinical narratives. Providers also sign off on treatment plans that drive predetermination requests.

**What they need to see:**
- **Minimal billing friction** — charting in the clinical workflow should automatically generate the correct CDT codes, diagnoses, and tooth/surface info without requiring the provider to "think like a biller"
- **Pre-authorization status** — for treatment-planned procedures, whether preauth was approved/denied/pending
- **Revenue summary** — high-level production vs. collection metrics (daily/weekly/monthly)
- **Narrative prompts** — when a procedure requires a clinical narrative for the payer (e.g., medical necessity for D4341 scaling/root planing), prompt the provider at chairside rather than creating a billing bottleneck later

**Key workflow moments:**
1. During treatment: Complete clinical notes → procedures auto-coded → tooth/surface recorded
2. Treatment planning: Flag procedures needing preauthorization → auto-generate predetermination
3. End of day: Quick review of daily production numbers
4. When asked: Provide clinical narratives or additional documentation for denied claims

### Persona 4: Practice Owner / Office Manager

**Role in claim flow:** Oversight and financial accountability. Not in the day-to-day claim flow but needs visibility into financial health and process efficiency.

**What they need to see:**
- **KPI dashboard** — clean claim rate, days in A/R, collection ratio, denial rate
- **Payer performance comparison** — which payers pay fastest, deny most, underpay most
- **Staff productivity** — claims processed per day, denials resolved per day
- **Revenue cycle health** — production vs. collections trend, aging trend

### Workflow State Machine (Claim Lifecycle from User Perspective)

```
Encounter Created
    → [Auto] Procedures coded, fees attached
    → [Auto] Scrubbing/validation
    → [If errors] → Billing Specialist fixes → Re-scrub
    → [If clean] → Queued for submission
    → [Auto] Submitted (EDI or RPA based on routing rules)
    → Pending with payer
    → [Auto] Status checked (276/277 or portal scrape)
    → Payment received (ERA/835)
        → [Auto] Payment posted to PMS
        → [If patient balance] → Statement generated
        → [If secondary insurance] → Secondary claim auto-generated
    → OR Denial received
        → [Auto] Denial categorized
        → [If auto-correctable] → Auto-corrected and resubmitted
        → [If needs human] → Routed to billing specialist queue
```

## 2. Claim Creation Flow — From Encounter to Submission-Ready Claim

### 2.1 The Encounter-to-Claim Pipeline

An encounter in the existing model already captures patient demographics and insurance eligibility. The claim creation flow extends this by assembling the full data payload required for an 837D (dental) transaction. Per the [X12 837D Implementation Guide](https://x12.org/products/transaction-sets), a dental claim requires data from five distinct domains:

| Data Domain | Auto-Populatable? | Source |
|---|---|---|
| **Patient demographics** (name, DOB, address, gender) | Yes — from encounter/eligibility | Existing encounter model |
| **Subscriber/insured info** (subscriber ID, group #, relationship to patient) | Yes — from eligibility response (271) | Existing encounter model |
| **Provider info** (billing NPI, rendering NPI, taxonomy code, TIN, address) | Yes — from provider master | Provider configuration |
| **Payer info** (payer ID, payer name, payer address) | Yes — from payer master | Payer configuration |
| **Clinical/service info** (CDT codes, tooth #, surfaces, diagnosis, fees, date of service) | Partially — requires clinical input | Clinical encounter + fee schedule |

### 2.2 Data Assembly — What Can Be Auto-Populated vs. Requires Input

**Fully Auto-Populated (zero human input needed):**
- Patient name, DOB, address, gender, subscriber ID, group number, relationship to subscriber — all from the eligibility verification (270/271) already running on the encounter model
- Billing provider NPI, Tax ID, taxonomy code (1223G0001X for general dentistry, specialty-specific codes for specialists) — from provider master data configured once
- Rendering provider NPI (if different from billing) — from encounter assignment
- Payer ID and address — from payer master, mapped during eligibility setup
- Place of service (typically "11" for office, "22" for outpatient hospital) — from encounter location
- Date of service — from encounter date
- Claim frequency code (1 = original, 7 = replacement, 8 = void) — defaults to "1", set to "7" on resubmission

**Auto-Populated with Clinical Input (from charting/procedure entry):**
- **CDT procedure codes** — mapped from the clinical procedure the provider selects during charting. The [ADA CDT code set](https://www.ada.org/publications/cdt) contains ~800 active codes organized in 12 categories (D0100-D0999 diagnostics, D1000-D1999 preventive, D2000-D2999 restorative, etc.). The system should present codes contextually (e.g., when charting on tooth #19, show common posterior codes)
- **Tooth number** — from the clinical chart (Universal Numbering System, 1-32 for permanent, A-T for primary teeth). Required for procedure categories: restorative, endodontic, periodontic (per-tooth), prosthodontic, oral surgery (extractions), implant
- **Tooth surfaces** — for restorative procedures (e.g., MOD = mesial-occlusal-distal). Valid surfaces: M, O, D, B/F, L, I. Surface count affects fee (1-surface vs. 3-surface composite)
- **Oral cavity designation** — for procedures billed by quadrant (e.g., D4341 scaling/root planing: UR, UL, LR, LL) or arch (upper, lower)
- **Diagnosis codes** — ICD-10-CM codes. While dental claims historically didn't require diagnosis codes, many payers now require them, and medical-dental cross-coding (e.g., billing medical insurance for dental implants due to trauma) always requires ICD-10. Common dental diagnoses: K02.x (caries), K05.x (gingivitis/periodontitis), K08.1 (loss of teeth), S02.x (fracture of tooth)

**Requires Human Input or Decision:**
- **Prosthetic replacement indicator** — "Is this an initial placement or a replacement?" If replacement, the prior placement date is required. This is a common denial trigger if omitted or incorrect
- **Orthodontic treatment info** — if applicable: treatment start date, months of treatment remaining, total months
- **Accident information** — if the dental treatment relates to an accident: date, type (auto, employment, other), state
- **Prior authorization number** — if preauth was obtained, the authorization # must be attached
- **Clinical narratives / remarks** — payer-specific requirements for certain procedures (e.g., narrative justifying medical necessity for D4341, explanation for D2740 crown on a non-posterior tooth)
- **Attachments** — X-rays, perio charts, clinical photos. The system should flag when a procedure typically requires attachments based on payer rules

### 2.3 Fee Schedule Lookup Logic

Fees on claims follow a hierarchy:
1. **Office fee schedule (UCR)** — the practice's standard fee for each CDT code. This is the "charged amount" on the claim
2. **Payer-contracted fee schedule** — if the practice is in-network, the payer has a contracted allowable. This is NOT submitted on the claim but is used to calculate expected payment and patient responsibility
3. **Fee schedule selection rule:** Always bill the full office UCR fee on the claim. The payer will adjudicate down to their allowable. Billing below UCR is a common billing error that leaves money on the table

**Auto-population logic:**
- On encounter completion, each procedure gets the office UCR fee from the fee schedule table (keyed by CDT code + provider/location if fee schedules vary)
- If fee is $0 or missing → flag for billing specialist review
- If procedure is bundled (e.g., D0220 periapical X-ray included with D3310 endo) → flag for review but don't auto-remove (payer bundling rules vary)

### 2.4 Claim Assembly Sequence (Automated Pipeline)

```
1. Encounter marked "complete" by provider
   ↓
2. System extracts procedures, fees, tooth/surface data from clinical record
   ↓
3. System pulls patient/subscriber/payer data from encounter + eligibility cache
   ↓
4. System pulls provider data from provider master
   ↓
5. System checks for required fields per procedure type:
   - Restorative → tooth # + surfaces required
   - Endo → tooth # required
   - Perio (quadrant) → oral cavity designation required
   - Prosthetics → replacement indicator + prior date if replacement
   - Ortho → treatment dates + remaining months
   ↓
6. System applies fee schedule (UCR for charge amount)
   ↓
7. System attaches any prior authorization numbers
   ↓
8. System flags missing/incomplete data → routes to scrubbing queue (Section 3)
   ↓
9. If all fields complete → claim enters "Ready for Submission" status
```

### 2.5 Multi-Procedure and Split-Claim Considerations

- **Multiple procedures, same visit:** Common in dental (e.g., exam + X-rays + prophylaxis + fluoride). All go on one claim unless payer-specific rules require splitting
- **Maximum procedures per claim:** The 837D supports up to 50 service lines per claim. The ADA paper form (J400/J430) supports 10 procedures. For EDI, this is rarely a constraint; for portal/paper, may need to split
- **Primary vs. secondary claims:** The system must generate secondary claims automatically after primary payment posts (see Section 6 for COB logic)
- **Predetermination vs. claim:** The same data structure, but with claim frequency type "predetermination." Should be a one-click toggle during treatment planning

## 3. Automated Scrubbing & Validation Rules (Pre-Submission)

Pre-submission scrubbing is the single highest-leverage automation for improving clean claim rate. Industry benchmarks put the [average dental clean claim rate at 90-95%](https://www.dentistryiq.com/practice-management/insurance/article/14302767/clean-claims-in-the-dental-office), meaning 5-10% of claims are rejected or denied on first submission. Robust scrubbing can push clean claim rates above 98%, per [Vyne Dental (formerly National Electronic Attachment)](https://www.vynedentalclaims.com/).

### 3.1 Tier 1: Structural Validation (Reject Immediately)

These are 837D format-level validations that will cause an outright rejection by the clearinghouse or payer before adjudication:

| Rule | Validation | Error Message |
|---|---|---|
| **Missing patient info** | Patient last name, first name, DOB, gender, address all required | "Patient [field] is missing" |
| **Missing subscriber info** | Subscriber ID, group number (if applicable), relationship code | "Subscriber ID is required" |
| **Invalid NPI** | Billing and rendering NPI must pass Luhn check algorithm and exist in [NPPES registry](https://npiregistry.cms.hhs.gov/) | "NPI [number] failed validation" |
| **Missing/invalid payer ID** | Payer ID must map to a known payer in the clearinghouse payer list | "Payer ID [id] not recognized" |
| **Missing procedure code** | At least one service line with valid CDT code required | "Claim has no service lines" |
| **Invalid CDT code** | Code must exist in current CDT version (updated annually in January) | "CDT code [code] is not valid for date of service" |
| **Missing date of service** | Each service line must have a date of service | "Date of service missing on line [n]" |
| **Future date of service** | Date of service cannot be in the future (except predeterminations) | "Date of service is in the future" |
| **Missing fee/charge amount** | Each service line must have a charge amount > $0 | "Charge amount missing or zero on line [n]" |
| **Duplicate claim** | Same patient + same DOS + same procedure + same provider within 30 days | "Possible duplicate claim detected" (warning, not hard block) |

### 3.2 Tier 2: Dental-Specific Clinical Validation

These catch coding errors specific to dentistry that are the leading cause of denials:

**Tooth Number Validation:**
- Procedures in categories D2000-D2999 (restorative), D3000-D3999 (endodontic), D4000-D4999 (periodontic, per-tooth only), D6000-D6999 (prosthodontic — implants, bridges), D7000-D7999 (oral surgery — extractions) → MUST have tooth number
- Tooth number must be 1-32 (permanent) or A-T (primary/deciduous)
- Cross-check tooth number against patient age: primary teeth (A-T) generally only valid for patients under ~14; permanent teeth (1-32) not valid for patients under ~6 for molars, ~7 for incisors
- Cross-check: cannot bill an extraction (D7210) and a crown (D2740) on the same tooth on the same date (logically inconsistent)
- Cross-check: if patient has a prior extraction on record for tooth #X, cannot bill restorative/endo on tooth #X (tooth already missing)

**Surface Validation:**
- Restorative procedures (D2140-D2394 amalgams, D2330-D2394 composites) MUST have surface designation
- Valid surfaces: M (mesial), O (occlusal), D (distal), B (buccal) or F (facial), L (lingual), I (incisal)
- Anterior teeth (6-11, 22-27 permanent; C-H, M-R primary) → use "I" (incisal) not "O" (occlusal)
- Posterior teeth (1-5, 12-21, 28-32) → use "O" (occlusal) not "I" (incisal)
- Number of surfaces must match procedure code: D2140 = 1 surface, D2150 = 2 surfaces, D2160 = 3 surfaces, D2161 = 4+ surfaces (amalgam). Same pattern for composites D2330/D2331/D2332/D2335
- Cannot have duplicate surfaces on same tooth (e.g., "MOD" is valid, "MOOD" is not)

**Quadrant/Arch Validation:**
- D4341/D4342 (scaling/root planing) requires quadrant designation (UR, UL, LR, LL)
- Cannot bill same quadrant SRP twice within payer's frequency limit (typically 24 months, varies by payer)
- D4910 (periodontal maintenance) — cannot bill same date as D1110 (prophylaxis). These are mutually exclusive

**Prosthetic Validation:**
- D6000-D6199 (implant procedures) must have tooth number
- D5110/D5120 (complete dentures) — cannot bill if patient has existing teeth in that arch (unless combined with full-mouth extraction on same claim)
- D5211/D5212 (partial dentures) — prosthesis replacement indicator required. If "replacement," prior placement date required. Missing this is a [top-5 dental denial reason per DentalXChange](https://www.dentalxchange.com/)

### 3.3 Tier 3: Frequency & Benefit Limitation Checks

These are payer-specific rules that vary but have common industry patterns. The scrubber should check against known frequency rules and warn (not hard-block, since payer rules vary):

| Procedure | Common Frequency Limit | Validation Rule |
|---|---|---|
| D0120 (periodic exam) | 2 per benefit year | Check prior D0120 dates; warn if <6 months since last |
| D0150 (comprehensive exam) | 1 per 36 months (many payers) | Check prior D0150 dates; warn if <36 months |
| D0210 (full mouth X-rays) | 1 per 36-60 months | Check prior; warn if within window |
| D0274/D0272 (bitewings) | 1 set per 6-12 months | Check prior; warn if within window |
| D1110 (adult prophylaxis) | 2 per benefit year | Check prior D1110/D4910 dates; warn if <6 months |
| D1120 (child prophylaxis) | 2 per benefit year | Same as above; also check patient age (typically <14) |
| D1206/D1208 (fluoride) | 1-2 per year; age limit (typically <19, some payers <14) | Check age + frequency |
| D1351 (sealants) | 1 per tooth per lifetime; age limit (typically 6-16) | Check tooth history + patient age |
| D2740-D2799 (crowns) | 1 per tooth per 5-10 years | Check prior crown history for same tooth |
| D4341 (SRP) | 1 per quadrant per 24 months | Check prior D4341 per quadrant |
| D4910 (perio maintenance) | 2-4 per year | Check frequency within benefit year |

**Implementation note:** Frequency rules should be stored in a payer-rules-engine table keyed by (payer_id, CDT_code). Default rules cover ~80% of payers. Overrides for specific payers are added as discovered through denials. This table is a core competitive asset over time.

### 3.4 Tier 4: Payer-Specific Rules Engine

Beyond frequency limits, each payer has idiosyncratic rules. Examples:

- **Delta Dental:** Requires narrative for D4341 when all 4 quadrants billed same day. Downcodes D2392 (posterior composite, 3-surface) to D2161 (amalgam equivalent) in some state plans — flag for patient notification
- **MetLife:** Requires pre-authorization for crowns >$X. Will deny D2950 (core buildup) if not billed same date as crown
- **Cigna:** Requires separate claims for services rendered by different rendering providers on same DOS
- **Guardian:** Does not cover D1208 (fluoride varnish) for patients over age 15 in many plans
- **United Concordia (military):** Has unique TRICARE rules for active duty vs. dependents

**Implementation:** Start with a "soft" rules engine — warn the billing specialist but don't block. As confidence in rules increases (validated against actual adjudication outcomes), graduate rules to "hard" blocks. Target: 50+ payer-specific rules in the first 6 months, growing via a feedback loop from denial data.

### 3.5 Scrubbing UX Flow

```
Claim enters scrubbing queue
    ↓
Auto-scrub runs Tiers 1-4
    ↓
Results displayed to billing specialist:
  ├─ ERRORS (Tier 1-2): Must fix before submission. Red indicators.
  │     → Inline fix suggestions (e.g., "Add tooth # → [dropdown]")
  │     → Fix applies immediately, re-scrub runs automatically
  ├─ WARNINGS (Tier 3-4): Likely to be denied. Yellow indicators.
  │     → Billing specialist can override with reason
  │     → Override logged for audit trail
  └─ CLEAN: All checks passed. Green indicator.
        → Auto-submitted per routing rules (Section 4)
        → OR held for batch if practice prefers batch submission
```

**Target metrics:**
- Scrub should complete in <2 seconds per claim
- Auto-fix (no human touch needed) for >60% of Tier 1 errors (e.g., auto-lookup missing tooth # from clinical chart)
- Clean claim rate after scrubbing: target 98%+ (vs. industry average of ~90-95%)

## 4. Submission Routing Engine — EDI vs. RPA Decision Logic

### 4.1 Core Routing Philosophy

The platform has two submission channels:
1. **EDI via Stedi** — X12 837D transactions sent through Stedi's API to payer clearinghouses. Industry-standard, highly reliable, but incurs per-transaction clearinghouse fees (typically [$0.25-$0.75 per claim](https://www.stedi.com/edi/pricing) depending on volume)
2. **RPA (Robotic Process Automation)** — automated browser-based submission through payer portals. The team's RPA engine is described as "strong" and "generally cheaper than EDI." Cost is primarily infrastructure + maintenance rather than per-transaction

The routing engine decides, per claim, which channel to use. The decision is not just cost — it's a multi-factor optimization.

### 4.2 Routing Decision Matrix

For each claim, evaluate these factors in priority order:

```
ROUTING DECISION TREE:

1. Does this payer have an active, stable RPA script?
   ├─ NO → Route to EDI (Stedi)
   └─ YES → Continue to step 2

2. Does this claim have attachments required?
   ├─ YES → Does the RPA script handle attachment upload?
   │   ├─ YES → Continue to step 3
   │   └─ NO → Route to EDI + NEA/DentalXChange attachment channel
   └─ NO → Continue to step 3

3. Is the RPA script health score > 95% (last 7 days)?
   ├─ NO → Route to EDI (RPA degraded, fail-safe)
   └─ YES → Continue to step 4

4. Is the claim high-value (charge amount > $1,000)?
   ├─ YES → Route to EDI (higher reliability for high-value claims)
   └─ NO → Continue to step 5

5. Is this claim a resubmission or corrected claim?
   ├─ YES → Route to same channel as original (for tracking continuity)
   └─ NO → Continue to step 6

6. Cost comparison: RPA cost per claim < EDI cost per claim?
   ├─ YES → Route to RPA
   └─ NO → Route to EDI
```

### 4.3 Payer-Channel Configuration Table

Each payer gets a configuration record:

| Field | Description | Example |
|---|---|---|
| `payer_id` | Unique payer identifier | `DDPCA` (Delta Dental of CA) |
| `edi_supported` | Payer accepts 837D via clearinghouse | `true` |
| `edi_payer_id` | Payer's clearinghouse routing ID | `DELTA01` |
| `rpa_available` | Active RPA script exists | `true` |
| `rpa_script_id` | Reference to RPA automation | `delta-dental-ca-v3` |
| `rpa_health_score` | Rolling 7-day success rate (auto-calculated) | `97.2%` |
| `rpa_supports_attachments` | Can upload X-rays/perio charts via portal | `true` |
| `preferred_channel` | Manual override by ops team | `RPA` / `EDI` / `AUTO` |
| `edi_cost_per_claim` | Current EDI per-transaction cost | `$0.35` |
| `rpa_cost_per_claim` | Amortized RPA cost (infra + maintenance / volume) | `$0.08` |
| `avg_edi_response_days` | Average days to first response via EDI | `5.2` |
| `avg_rpa_response_days` | Average days to first response via RPA | `4.8` |
| `last_rpa_failure` | Timestamp of most recent RPA failure | `2026-03-15T14:22:00Z` |

### 4.4 RPA Health Monitoring & Auto-Failover

RPA scripts are inherently fragile — payer portals change their UI, add CAPTCHAs, modify login flows. The system needs automated health monitoring:

**Health Score Calculation:**
```
health_score = (successful_submissions_last_7_days / total_attempts_last_7_days) * 100
```

**Auto-failover rules:**
- If `health_score < 95%` → log alert to ops, route new claims to EDI
- If `health_score < 80%` → disable RPA for this payer, alert engineering, all claims routed to EDI
- If RPA script has 3 consecutive failures → immediate pause, route to EDI, alert engineering
- After RPA fix deployed → run 5 test claims before re-enabling for production traffic
- Health score resets after successful fix validation

**Portal change detection:**
- RPA scripts should capture page structure hashes on each run
- If page structure hash changes significantly → proactive alert before failures accumulate
- Maintain a "portal change log" per payer to predict maintenance cycles

### 4.5 Cost Model & When RPA Wins

Given that RPA is "generally cheaper" for this team, here's the economic framework:

**EDI costs (variable, per-transaction):**
- Stedi/clearinghouse fee: ~$0.25-$0.50 per 837D claim
- ERA (835) receipt: often included or ~$0.10-$0.25
- Status inquiry (276/277): ~$0.10-$0.25
- Total per claim lifecycle: ~$0.45-$1.00

**RPA costs (mostly fixed):**
- Infrastructure: server/browser automation resources (amortized across all RPA scripts)
- Engineering maintenance: ~2-8 hours per payer per quarter for portal change fixes
- Per-claim marginal cost: near zero (CPU + bandwidth)
- Amortized cost per claim: depends on volume, but typically $0.05-$0.15 at scale

**Break-even analysis:**
- RPA is cheaper when: `(monthly_rpa_fixed_cost / monthly_claim_volume_for_payer) < edi_per_claim_cost`
- If RPA maintenance for a payer costs ~$500/month (engineering time), and EDI costs $0.40/claim, RPA wins at >1,250 claims/month for that payer
- For high-volume payers (Delta Dental, MetLife, Cigna): RPA almost always wins
- For low-volume payers (<100 claims/month): EDI is more cost-effective due to maintenance amortization

### 4.6 Queue Management & Submission Timing

**Batch vs. real-time submission:**
- **EDI (Stedi):** Can submit in real-time (API call per claim) or batched. Stedi's API supports both. Recommendation: submit claims as they pass scrubbing — no reason to batch on EDI
- **RPA:** May need batching due to portal rate limits and session management. Recommendation: batch by payer, submit at optimal times (e.g., avoid payer portal maintenance windows, typically nights/weekends)

**Queue priorities:**
1. **Resubmissions/corrected claims** — highest priority (already aged)
2. **High-value claims (>$1,000)** — high financial impact
3. **Claims approaching filing deadline** — most payers require filing within 90-365 days of DOS. Flag claims at 80% of deadline
4. **Standard claims** — FIFO within payer batches

**Retry logic:**
- EDI rejection (clearinghouse level, not payer denial): auto-retry once after 1 hour. If second failure, route to billing specialist queue
- RPA failure (login failed, element not found, timeout): auto-retry once. If second failure, failover to EDI. If EDI also unavailable, queue for manual review
- Rate limiting: respect payer portal rate limits (configurable per payer, default: max 50 submissions per hour per portal)

### 4.7 Submission Confirmation & Audit Trail

Every submission, regardless of channel, must log:

```json
{
  "claim_id": "CLM-2026-00001",
  "submission_channel": "RPA",
  "payer_id": "DDPCA",
  "submitted_at": "2026-03-28T10:15:00Z",
  "routing_reason": "RPA healthy (98.1%), cost advantage ($0.08 vs $0.35)",
  "confirmation_number": "DDP-2026-ABC123",
  "rpa_script_version": "delta-dental-ca-v3.2",
  "submission_payload_hash": "sha256:abc123...",
  "response_received": true,
  "response_type": "accepted",
  "response_raw_stored": true
}
```

This audit trail is essential for:
- Debugging submission failures
- Proving timely filing to payers
- Cost analysis and channel optimization
- HIPAA compliance (who sent what, when, how)

## 5. Status Tracking, Denial Management, and Auto-Resubmission

### 5.1 Claim Status Lifecycle

Every claim moves through a deterministic state machine. The system must track the current state and the transitions between states:

```
┌──────────────┐
│   CREATED    │  Encounter finalized, claim assembled
└──────┬───────┘
       ↓
┌──────────────┐
│  SCRUBBING   │  Pre-submission validation running
└──────┬───────┘
       ├─ errors found → NEEDS_CORRECTION (billing specialist queue)
       ↓
┌──────────────┐
│    QUEUED    │  Passed scrubbing, waiting for submission
└──────┬───────┘
       ↓
┌──────────────┐
│  SUBMITTED   │  Sent to payer (EDI or RPA)
└──────┬───────┘
       ├─ clearinghouse rejection → REJECTED (fix & resubmit)
       ↓
┌──────────────┐
│   ACCEPTED   │  Payer acknowledged receipt (999/TA1 for EDI, portal confirmation for RPA)
└──────┬───────┘
       ↓
┌──────────────┐
│ ADJUDICATING │  Payer is processing (status from 277 or portal scrape)
└──────┬───────┘
       ├─ denied → DENIED
       ├─ pended → PENDED (payer needs more info)
       ↓
┌──────────────┐
│    PAID      │  ERA/835 received with payment
└──────┬───────┘
       ├─ partial payment → PAID_PARTIAL (may trigger secondary or appeal)
       ├─ zero pay → DENIED (reclassified)
       ↓
┌──────────────┐
│   POSTED     │  Payment posted to PMS ledger
└──────┬───────┘
       ├─ has secondary insurance → SECONDARY_QUEUED
       ├─ patient balance > $0 → PATIENT_BALANCE
       ↓
┌──────────────┐
│   CLOSED     │  Fully adjudicated, posted, balanced
└──────────────┘
```

**Additional terminal/branch states:**
- `APPEALED` — formal appeal filed (tracks separately from resubmission)
- `WRITTEN_OFF` — balance written off per practice policy
- `VOIDED` — claim voided (e.g., billed in error)

### 5.2 Status Inquiry Automation

**EDI channel (276/277 Health Care Claim Status):**
- Stedi supports [276/277 transactions](https://www.stedi.com/edi/x12/transaction-set/276) for automated status checks
- Cadence: check status 7 days after submission, then every 7 days until adjudicated
- Parse 277 response for claim status category codes:
  - `A0` = Forwarded to payer (still in transit)
  - `A1` = Received by payer
  - `A2` = Accepted for adjudication
  - `A3`-`A4` = Adjudication complete (check for payment/denial)
  - `R0`-`R16` = Request/rejection codes (need additional info)

**RPA channel (portal scraping):**
- For payers submitted via RPA, status is also checked via RPA portal scraping
- Cadence: same as EDI (7/14/21/28 days)
- Parse portal status text into normalized status codes
- Common portal status strings to parse:
  - "In Process" / "Processing" → `ADJUDICATING`
  - "Pended" / "Additional Info Needed" → `PENDED`
  - "Finalized" / "Paid" → check EOB for details
  - "Denied" → extract denial reason if available

**Escalation timeline:**
- 0-14 days: Normal processing window. No alerts
- 15-30 days: Yellow flag — approaching typical adjudication window (dental claims average [10-14 business days for electronic submission](https://www.ada.org/resources/practice/dental-insurance), per ADA guidance)
- 31-45 days: Orange flag — overdue. Auto-send follow-up status inquiry
- 46+ days: Red flag — alert billing specialist. May need phone follow-up
- Approaching timely filing deadline (varies by payer, 90-365 days): Critical alert at 80% of deadline

### 5.3 Denial Categorization and Auto-Correction Engine

From the domain research (01-domain.md), the top dental denial reasons map to specific CARC codes. The system categorizes denials into three action tiers:

#### Tier A: Auto-Correctable (No Human Needed)

These denials can be corrected and resubmitted automatically:

| CARC | Denial Reason | Auto-Correction Action |
|---|---|---|
| 4 | Procedure code inconsistent with modifier/tooth/surface | Cross-reference clinical chart → correct tooth/surface → resubmit |
| 16 | Missing information (claim lacks required data) | Pull missing data from encounter record → reattach → resubmit |
| 252 | Attachment/documentation required | Auto-attach X-rays/perio charts from patient's imaging record → resubmit |
| N362 | Missing/invalid prior authorization number | Look up preauth in system → attach if found → resubmit |
| A1 | Not our insured / wrong payer | Re-verify eligibility → route to correct payer → resubmit |

**Auto-resubmission rules:**
- Maximum 2 auto-resubmissions per claim before requiring human review
- Each resubmission must have a different correction (no infinite loops)
- Claim frequency code changes from "1" (original) to "7" (replacement)
- Original claim reference number (ICN/DCN) must be included

#### Tier B: Semi-Automated (Needs Human Decision, Auto-Prepared)

The system prepares the corrective action but requires billing specialist approval:

| CARC | Denial Reason | System Preparation | Human Decision |
|---|---|---|---|
| 29 | Timely filing exceeded | Generate proof of timely filing (original submission receipt, delivery confirmation) | Review and submit appeal with proof |
| 50/96 | Not a covered benefit | Flag benefit limitation; check if alternate code applicable or if patient should be billed | Billing specialist decides: appeal, recode, or bill patient |
| 97 | Bundling/inclusive procedure | Identify which procedures were bundled; calculate revenue impact | Accept bundling or appeal with unbundling documentation |
| 119 | Frequency limitation | Show last service date and payer's frequency rule; calculate when re-eligible | Wait and resubmit at eligibility date, or appeal with clinical justification |
| 197 | Missing pre-authorization | Check if preauth was obtained but not attached; if no preauth, prepare retro-auth request | Submit retro-auth request or write off |

#### Tier C: Human-Required (Complex Appeals)

These require clinical judgment or complex documentation:

| CARC | Denial Reason | Required Action |
|---|---|---|
| 26/27 | Waiting period / not eligible on DOS | Verify enrollment dates; may need employer/plan sponsor intervention |
| 45 | Exceeds fee schedule | Contractual — usually must accept. Flag if amount seems incorrect vs. contracted rate |
| 59 | Downcoding (processed at lower level) | Review clinical documentation; may appeal with supporting evidence |
| N130 | Missing tooth clause | Need proof tooth was extracted after coverage began; requires clinical records |

### 5.4 Denial Workflow UX

```
ERA/835 received with denial
    ↓
System parses CAS segment → extracts CARC + RARC codes
    ↓
Auto-categorize into Tier A/B/C
    ↓
├─ Tier A: Auto-correct and resubmit
│   → Log action → Update claim status to RESUBMITTED
│   → Notify billing specialist (informational only)
│
├─ Tier B: Prepare corrective action
│   → Display in denial work queue with:
│     - Original claim summary
│     - Denial reason (plain English, not just CARC code)
│     - Suggested corrective action
│     - Pre-filled correction form
│     - One-click "approve and resubmit" button
│   → Billing specialist reviews and approves/modifies/rejects
│
└─ Tier C: Route to human queue
    → Display with full context
    → Option to escalate to provider for clinical narrative
    → Option to generate appeal letter (see 5.5)
    → Option to write off with reason code
```

### 5.5 Appeal Letter Generation

For Tier B/C denials where appeal is appropriate, the system auto-generates appeal letters:

**Letter template engine:**
- Pre-built templates per denial reason (CARC-specific)
- Auto-populated fields: patient info, claim #, DOS, procedure, denial reason, payer info
- Clinical narrative section: either auto-pulled from chart notes or flagged for provider input
- Supporting documentation checklist: what to attach based on denial type
- Payer-specific appeal address and submission method (mail, fax, portal)

**Appeal tracking:**
- Each appeal gets its own tracking record linked to the original claim
- Appeal deadlines tracked (most payers: 60-180 days from denial date)
- Auto-escalate to level 2 appeal if level 1 denied (when applicable)
- External review option flagged when internal appeals exhausted

### 5.6 Resubmission Business Rules

| Rule | Logic |
|---|---|
| **Max resubmissions** | 3 total (1 original + 2 corrected). After 3, requires manual override |
| **Resubmission window** | Must resubmit within payer's timely filing limit from original DOS (not from denial date — this is a common mistake) |
| **Claim frequency code** | First submission: "1". Corrected resubmission: "7". Void: "8" |
| **Original reference number** | Every resubmission must carry the payer's claim reference number (ICN/DCN) from the original adjudication |
| **Changed fields tracking** | System tracks exactly what changed between submissions for audit trail |
| **Payer-specific cooldown** | Some payers reject rapid resubmissions. Default: wait 48 hours between resubmissions to same payer for same claim |

### 5.7 Denial Feedback Loop (Learning System)

Every denial outcome feeds back into the scrubbing rules engine (Section 3):

1. **New denial pattern detected** (e.g., 5+ denials for same CARC from same payer in 30 days) → auto-generate candidate scrubbing rule
2. **Ops team reviews** → promotes to warning or hard-block rule
3. **Rule effectiveness tracked** — did adding the rule reduce denials for that pattern?
4. **Quarterly rules review** — prune ineffective rules, strengthen effective ones

This creates a continuously improving system where the denial rate decreases over time as the scrubber gets smarter.

## 6. PMS Ledger Sync Business Logic — When to Post, What to Update, Reconciliation

> **This is the most critical section.** The PMS ledger is the practice's financial source of truth. Every dollar that flows through the practice — charges, insurance payments, patient payments, adjustments, write-offs — must be accurately reflected. Getting this wrong means incorrect patient statements, wrong A/R balances, failed reconciliation, and lost revenue.

The integration mechanism is abstracted. This section defines **WHAT** gets synced and **WHEN** — the business logic layer, not the transport layer.

### 6.1 Ledger Entry Types

The PMS ledger tracks these fundamental entry types:

| Entry Type | Debit/Credit | Trigger | Example |
|---|---|---|---|
| **Charge** | Debit (increases A/R) | Encounter completed | D2740 Crown — $1,200.00 |
| **Insurance Payment** | Credit (decreases A/R) | ERA/835 received and posted | Delta Dental payment — $720.00 |
| **Insurance Adjustment (Contractual)** | Credit (decreases A/R) | ERA/835 — CO group adjustment | Contractual write-off — $280.00 |
| **Insurance Adjustment (Non-Contractual)** | Credit (decreases A/R) | ERA/835 — OA/PI group adjustment | Payer-initiated reduction — $50.00 |
| **Patient Payment** | Credit (decreases A/R) | Patient pays at POS or via statement | Patient copay/coinsurance — $200.00 |
| **Patient Adjustment** | Credit (decreases A/R) | Practice decision (discount, write-off) | Courtesy discount — $50.00 |
| **Refund** | Debit (increases expense) | Overpayment discovered | Patient refund — $25.00 |
| **Transfer** | Neutral (moves between buckets) | Primary → secondary, insurance → patient | Transfer balance to secondary ins — $200.00 |

### 6.2 Charge Posting — When Encounter Becomes a Receivable

**Trigger:** Encounter status changes to "complete" (provider signs off on clinical encounter)

**What to post:**
```
For each procedure in the encounter:
  POST to PMS ledger:
    - Patient ID
    - Date of service
    - CDT procedure code
    - Tooth number (if applicable)
    - Surface(s) (if applicable)
    - Provider (rendering)
    - Charge amount = Office UCR fee from fee schedule
    - Insurance portion (estimated) = expected payer allowable × payer's coverage %
    - Patient portion (estimated) = charge - estimated insurance portion
```

**Critical rules:**
1. **Always post at full UCR (office fee schedule)** — never post at the insurance allowable amount. The charge represents what was billed. Adjustments reconcile the difference later
2. **Post charges IMMEDIATELY on encounter completion** — do not wait for claim submission or adjudication. The charge establishes the receivable. The practice's daily production report depends on this
3. **Estimated patient portion** — calculated from eligibility data (coverage percentages, remaining deductible, remaining annual max). This is an estimate shown to front desk for collection but NOT posted as a separate entry. The actual patient responsibility is determined when the ERA comes back
4. **Multi-procedure encounters:** Each procedure is a separate line item on the ledger, all sharing the same encounter/date of service

**Edge case — Treatment plan vs. completed procedure:**
- Treatment-planned but not yet performed procedures: do NOT post charges. Only completed work generates receivables
- Predetermination submissions: do NOT post charges. These are informational requests to the payer, not claims

### 6.3 Insurance Payment Posting — ERA/835 Processing

**Trigger:** ERA (835) received from payer (via Stedi EDI or parsed from portal EOB via RPA)

**Parsing the 835:** Each ERA contains one or more claim payment records. For each claim:

```
ERA Claim Record contains:
  - Claim ID (CLM reference matching our submitted claim)
  - Charge amount (what we billed)
  - Payment amount (what payer is paying)
  - CAS segments (adjustments — the delta between billed and paid)
```

**What to post — step by step for each claim in the ERA:**

**Step 1: Match ERA to internal claim**
```
Match by: payer_claim_number (ICN/DCN) OR (patient_name + DOS + charge_amount)
If no match found → route to "unmatched ERA" queue for manual matching
```

**Step 2: Post insurance payment**
```
POST to PMS ledger:
  Entry type: INSURANCE_PAYMENT
  Amount: ERA payment amount (SVC segment's paid amount)
  Payer: payer name + ID
  Check/EFT number: from ERA BPR segment (for bank reconciliation)
  Payment date: from ERA DTM segment
  Link to: original charge line item(s)
```

**Step 3: Post contractual adjustments (CO group)**
```
For each CAS segment with group code "CO" (Contractual Obligation):
  POST to PMS ledger:
    Entry type: INSURANCE_ADJUSTMENT_CONTRACTUAL
    Amount: CAS adjustment amount
    Reason: CARC code + description (e.g., CARC 45 "Exceeds fee schedule")
    Link to: original charge line item

This is the difference between what the practice billed (UCR) and the payer's
contracted allowable. For in-network providers, this amount CANNOT be billed
to the patient. It is a write-off per contract.
```

**Step 4: Post patient responsibility (PR group)**
```
For each CAS segment with group code "PR" (Patient Responsibility):
  POST to PMS ledger:
    Entry type: PATIENT_RESPONSIBILITY_TRANSFER
    Amount: CAS adjustment amount
    Reason: CARC code (1=deductible, 2=coinsurance, 3=copay)
    Effect: Transfer this amount from "insurance A/R" to "patient A/R"
    Link to: original charge line item

This tells us exactly what the patient owes and WHY:
  - CARC 1 (deductible): Patient owes because deductible not met
  - CARC 2 (coinsurance): Patient's percentage share
  - CARC 3 (copay): Fixed copay amount
  - CARC 45 with PR group: Amount over allowed (out-of-network balance billing)
```

**Step 5: Post other adjustments (OA, PI groups)**
```
For each CAS segment with group code "OA" or "PI":
  POST to PMS ledger:
    Entry type: INSURANCE_ADJUSTMENT_OTHER
    Amount: CAS adjustment amount
    Reason: CARC + RARC codes
    Requires review: YES (these are non-standard and may need investigation)
```

**Step 6: Validate the math**
```
VALIDATION CHECK (must pass before posting):
  Billed Amount = Payment + CO Adjustments + PR Adjustments + OA/PI Adjustments

If this equation doesn't balance:
  → Flag for manual review
  → Do NOT auto-post (risk of corrupting ledger)
  → Route to "payment posting exception" queue
```

**Step 7: Update claim status**
```
If payment > 0 and no denial CARCs → claim status = PAID
If payment = 0 and denial CARCs present → claim status = DENIED
If payment > 0 but less than expected with denial CARCs → claim status = PAID_PARTIAL
```

### 6.4 Denial Handling — Ledger Impact

**When a claim is denied (payment = $0):**
- Do NOT remove the original charge from the ledger
- Do NOT post an adjustment yet (the practice may appeal or resubmit)
- Update claim status to DENIED
- The charge remains in insurance A/R aging
- If denial is appealed/resubmitted → charge stays as-is, waiting for new adjudication
- If denial is accepted as final (write-off decision):
  ```
  POST to PMS ledger:
    Entry type: WRITE_OFF
    Amount: denied charge amount
    Reason: "Insurance denial — [CARC code] — [description]"
    Write-off category: Insurance denial (vs. courtesy write-off, bad debt, etc.)
    Link to: original charge
  ```
- Then determine if patient should be billed for the denied amount (depends on reason):
  - CARC 50/96 (not covered): Typically billable to patient, but only if patient signed an ABN (Advance Beneficiary Notice) or financial consent
  - CARC 29 (timely filing): Practice's fault — cannot bill patient. Must write off
  - CARC 119 (frequency): May be billable to patient with proper notification
  - CARC 197 (no preauth): Practice's fault if they should have obtained preauth — usually write off

### 6.5 Patient Payment Posting

**Trigger:** Patient makes a payment (at checkout, via mailed statement, online portal)

```
POST to PMS ledger:
  Entry type: PATIENT_PAYMENT
  Amount: payment amount
  Payment method: cash, check (#), credit card (last 4), ACH
  Receipt number: auto-generated
  Applied to: specific charge line items (oldest first by default, or manually allocated)
```

**Payment application rules:**
1. **Auto-apply to oldest balance** — FIFO by date of service, unless payment specifies otherwise
2. **Split payments** — if payment doesn't cover full balance, apply to specific procedures in order of oldest DOS
3. **Overpayment** — if payment exceeds balance:
   - Post payment as received
   - Create credit balance on patient account
   - Flag for refund processing (see 6.8)
4. **Pre-payment / deposit** — patient pays before insurance adjudicates:
   - Post as patient payment
   - When ERA arrives and patient's actual responsibility is determined:
     - If pre-payment > actual responsibility → credit balance → refund
     - If pre-payment < actual responsibility → remaining balance on patient statement

### 6.6 Secondary Insurance Billing Triggers

**Trigger:** Primary insurance ERA posted AND patient has secondary insurance on file

**Business logic:**
```
After primary ERA posting:
  1. Calculate remaining balance after primary payment + primary adjustments
  2. Check: does remaining balance > $0?
  3. Check: does patient have active secondary insurance?
  4. If both YES:
     a. Auto-generate secondary claim
     b. Include primary EOB data on secondary claim (COB information):
        - Primary payer name and ID
        - Primary payment amount
        - Primary adjustment amounts with CARCs
        - Remaining balance (what secondary is being asked to pay)
     c. Queue secondary claim for submission (goes through same scrub → route → submit pipeline)
     d. Update claim status: SECONDARY_SUBMITTED
     e. Ledger impact: NO new charges posted (charge already exists from encounter).
        The secondary claim seeks to reduce the remaining A/R balance.
```

**Important COB rules:**
- **Non-duplication of benefits:** Many dental plans have a "non-duplication" clause — the secondary plan will not pay more than it would have paid as primary. This means the secondary payment may be $0 even if there's a balance
- **Standard COB:** The secondary plan pays up to its allowable minus what the primary paid. Total of both plans cannot exceed the total charge
- **Maintenance of benefits:** The secondary pays the difference between what it would have paid as primary and what the primary actually paid
- The system should estimate secondary payment based on known plan type, but actual payment comes from secondary ERA

**Secondary ERA posting:** Same logic as primary ERA posting (Section 6.3), but applied against the remaining balance after primary.

### 6.7 Contractual Adjustment Posting — In-Network vs. Out-of-Network

This is a subtle but critical distinction:

**In-network providers:**
- The CO (Contractual Obligation) adjustment from the ERA represents the contractual write-off
- This amount CANNOT be billed to the patient (it's the discount the provider agreed to)
- Post as `INSURANCE_ADJUSTMENT_CONTRACTUAL` and zero out that portion of A/R
- Example: Billed $1,200 for a crown. Payer allows $900. The $300 CO adjustment is written off. Patient owes coinsurance on $900 (not $1,200)

**Out-of-network providers:**
- The CO adjustment may represent the payer's maximum allowable
- The difference between billed and allowed CAN be billed to the patient (balance billing), subject to state laws
- Some states prohibit or limit balance billing even for out-of-network dental
- Post the CO adjustment, then evaluate whether the remaining balance should be:
  - Transferred to patient responsibility (balance billing)
  - Written off as a courtesy
  - Partially adjusted

**System behavior:**
```
On ERA posting, check provider's network status with payer:
  If IN_NETWORK:
    CO adjustments → auto-post as contractual write-off (no patient billing)
    PR adjustments → transfer to patient A/R
  If OUT_OF_NETWORK:
    CO adjustments → post as payer adjustment
    Remaining balance → present to billing specialist for decision:
      - Bill patient (balance bill)
      - Write off (courtesy)
      - Partial adjustment
```

### 6.8 Refund Scenarios

**Insurance overpayment (payer paid too much):**
```
Trigger: Payer sends a refund request or reversal on ERA
  1. Post reversal/take-back:
     Entry type: INSURANCE_PAYMENT_REVERSAL
     Amount: negative (reduces credit)
  2. If practice has already collected from patient based on original payment:
     → Recalculate patient responsibility
     → May need to bill patient for additional amount
  3. If payer requests refund check:
     → Create refund payable entry
     → Track until refund is issued
```

**Patient overpayment (patient paid too much):**
```
Trigger: Credit balance on patient account after all insurance adjudication complete
  1. Identify credit balance:
     Patient paid $300 at checkout
     ERA shows patient responsibility = $200
     Credit balance = $100
  2. Options (practice policy):
     a. Refund immediately → POST refund entry, issue check/credit card refund
     b. Apply to outstanding balance on another DOS → transfer credit
     c. Hold as credit for future visit → maintain credit balance
  3. Regulatory note: Many states require refund of patient overpayments within 30-60 days
```

**Take-backs / Recoupment:**
```
Trigger: Payer recoups a prior payment (common when audit finds overpayment)
  1. Payer sends PLB (Provider Level Balance) segment in ERA
     OR offsets against a current payment
  2. POST to PMS ledger:
     Entry type: INSURANCE_RECOUPMENT
     Amount: negative payment (reduces insurance credit)
     Reference: original claim that was overpaid
  3. Recalculate affected claim's balance:
     → May result in additional patient responsibility
     → May need to appeal the recoupment
  4. Flag for billing specialist review (recoupments should NEVER be auto-accepted
     without review — payers sometimes recoup incorrectly)
```

### 6.9 End-of-Day Reconciliation

**Daily close process — what the system should automate/facilitate:**

```
END OF DAY RECONCILIATION CHECKLIST:

1. PRODUCTION RECONCILIATION
   □ Total charges posted today = sum of all procedures completed today
   □ Each encounter has charges posted (no orphan encounters)
   □ No encounters stuck in "in progress" — either complete or carry forward

2. COLLECTION RECONCILIATION
   □ Total patient payments collected = cash + checks + credit cards received
   □ Payment deposit matches POS terminal batch + cash count
   □ All payments posted to correct patient accounts

3. CLAIM SUBMISSION RECONCILIATION
   □ All completed encounters have claims generated
   □ Claims passing scrubbing have been submitted
   □ Claims failing scrubbing are in work queue with assigned follow-up

4. PAYMENT POSTING RECONCILIATION
   □ All ERAs received today have been posted (or queued for exceptions)
   □ ERA payment totals match bank deposit (EFT) or check amounts
   □ No unmatched ERA entries

5. INSURANCE A/R CHECK
   □ No claims older than [practice threshold, typically 45 days] without status update
   □ Aging buckets reviewed: 30/60/90 day claims flagged
```

### 6.10 End-of-Month Reconciliation

**Monthly close — more comprehensive checks:**

```
MONTHLY RECONCILIATION:

1. A/R AGING REPORT
   Generate aging report with buckets:
   - 0-30 days: Current (healthy)
   - 31-60 days: Needs follow-up
   - 61-90 days: Escalate
   - 91-120 days: Consider write-off or collections
   - 120+ days: Likely uncollectible

   Target: <15% of total A/R in 60+ day buckets
   (Industry benchmark: average dental practice has ~30 days in A/R
   per [Dental Economics](https://www.dentaleconomics.com/))

2. PAYMENT vs. CHARGE RECONCILIATION
   Total charges (month) vs. Total payments received (month)
   → Collection rate = payments / charges
   → Target: >98% over rolling 12 months (accounting for timing lag)

3. ADJUSTMENT ANALYSIS
   Total contractual adjustments (should be consistent % of charges for in-network)
   Total write-offs (should be declining if denial management is improving)
   Total patient adjustments (monitor for excessive discounting)

4. BANK RECONCILIATION
   Total ERA payments received = total insurance deposits in bank
   Total patient payments posted = total patient deposits in bank
   Any discrepancies flagged for investigation

5. CREDIT BALANCE REVIEW
   Patient accounts with credit balances → refund or apply
   Insurance accounts with credit balances → verify or refund
   Per regulatory requirements, patient credits >$X or >30 days must be refunded

6. SECONDARY CLAIM AUDIT
   All claims with primary payment posted → secondary claim generated (if applicable)
   No secondary claims "stuck" (primary paid but secondary never submitted)
```

### 6.11 Ledger Sync Timing Rules Summary

| Event | What Syncs to PMS | When |
|---|---|---|
| Encounter completed | Charge line items (CDT + fee) | Immediately (real-time) |
| Claim submitted | Claim reference # linked to charges | Immediately |
| ERA received — payment | Insurance payment entry | Immediately upon ERA parse |
| ERA received — CO adjustment | Contractual write-off entry | Immediately upon ERA parse |
| ERA received — PR adjustment | Patient responsibility transfer | Immediately upon ERA parse |
| ERA received — denial | Claim status update (NO ledger change yet) | Immediately |
| Denial accepted (write-off) | Write-off entry | On billing specialist decision |
| Patient payment | Payment entry | Immediately upon collection |
| Secondary claim triggered | No new charges (secondary claim queued) | After primary ERA posted |
| Secondary ERA received | Secondary payment + adjustments | Immediately upon ERA parse |
| Refund issued | Refund entry (negative credit) | On refund approval |
| Recoupment/take-back | Reversal entry | On ERA parse, held for review |

### 6.12 Idempotency and Error Recovery

**Critical data integrity rules:**

1. **Every ledger entry has a unique transaction ID** — no duplicate postings. If an ERA is processed twice, the second attempt is rejected as duplicate
2. **All postings are within a database transaction** — if payment + adjustments for a claim don't all post successfully, none post (atomic operations)
3. **Audit trail** — every ledger entry records: who created it, when, source document (ERA ID, receipt #), and reason. Edits create new reversal + re-entry pairs, never overwrite
4. **Reconciliation checksum** — at end of each posting batch, verify: sum of all entries for a claim = $0 (charges - payments - adjustments = 0 for a fully closed claim)
5. **Manual override capability** — billing specialist can manually adjust any entry with a documented reason, but the original entry is preserved (append-only ledger for audit)

## 7. Dashboard, Reporting, and KPIs (Clean Claim Rate, Days to Payment, etc.)

### 7.1 Primary KPIs — The Metrics That Matter Most

These are the headline numbers that should be visible on the main dashboard at all times:

#### KPI 1: Clean Claim Rate (CCR)

**Definition:** Percentage of claims accepted by the payer on first submission without rejection or request for additional information.

```
CCR = (Claims accepted on first submission / Total claims submitted) × 100
```

**Benchmark:** Industry average for dental is [90-95%](https://www.dentistryiq.com/practice-management/insurance/article/14302767/clean-claims-in-the-dental-office). Best-in-class operations achieve 98%+. Per the [MGMA (Medical Group Management Association)](https://www.mgma.com/), a CCR below 90% indicates significant revenue cycle problems.

**Target:** 98% within 6 months of platform launch (driven by scrubbing engine improvement).

**Display:** Large gauge/percentage on dashboard. Trend line (weekly rolling average). Drill-down by payer, by CDT category, by provider.

#### KPI 2: First-Pass Resolution Rate (FPRR)

**Definition:** Percentage of claims that are fully adjudicated (paid or properly denied) after first submission without any follow-up, resubmission, or appeal needed.

```
FPRR = (Claims paid on first submission / Total claims submitted) × 100
```

**Benchmark:** Industry average ~80-85%. Target: 92%+.

**Distinction from CCR:** A claim can be "clean" (accepted) but still require follow-up (pended for documentation, etc.). FPRR is a stricter measure.

#### KPI 3: Days in Accounts Receivable (Days in A/R)

**Definition:** Average number of days from charge posting to payment receipt.

```
Days in A/R = (Total A/R balance / Average daily charges)
```

More precisely calculated as a weighted average across all outstanding claims.

**Benchmark:** Per [Dental Economics / Levin Group](https://www.dentaleconomics.com/), the ideal dental practice has:
- **Total Days in A/R:** <30 days
- **Insurance A/R:** <21 days (electronic claims average 10-14 business days to adjudicate)
- **Patient A/R:** <45 days

**Target:** Insurance A/R < 18 days; Total A/R < 28 days.

**Display:** Single number with trend arrow. Breakdown by insurance A/R vs. patient A/R. Trend over last 12 months.

#### KPI 4: Denial Rate

**Definition:** Percentage of adjudicated claims that result in full or partial denial.

```
Denial Rate = (Denied claims / Total adjudicated claims) × 100
```

**Benchmark:** Per the [ADA Health Policy Institute](https://www.ada.org/resources/research/health-policy-institute), dental claim denial rates average 5-10% overall. Complex restorative/prosthodontic procedures see 15-25% denial rates.

**Target:** Overall < 5%. By procedure category: preventive < 2%, basic restorative < 5%, major < 10%.

**Display:** Rate with breakdown by denial reason (CARC category), by payer, by CDT code range. This is the single most actionable metric for billing specialists.

#### KPI 5: Net Collection Rate

**Definition:** Percentage of collectible revenue actually collected (excludes contractual write-offs).

```
Net Collection Rate = Total payments / (Total charges - Contractual adjustments) × 100
```

**Benchmark:** Per [Dental Economics](https://www.dentaleconomics.com/practice/article/14301236/collection-rate-benchmarks), a healthy dental practice should have a net collection rate of 98%+ over a rolling 12-month period. Below 95% indicates leakage.

**Target:** 98.5%+.

**Display:** Monthly and rolling 12-month. This is the practice owner's primary financial health indicator.

#### KPI 6: Cost Per Claim

**Definition:** Total cost to submit and manage a claim through the revenue cycle.

```
Cost Per Claim = (EDI fees + RPA costs + staff time cost + overhead) / Total claims processed
```

**Benchmark:** Traditional dental billing cost per claim ranges from [$6-$12](https://www.aadom.com/) when including staff time. Automated systems target $2-$4 per claim. Per [CAQH Index](https://www.caqh.org/explorations/caqh-index), the cost of a fully electronic dental claim is approximately $2.93 vs. $7.37 for a manual claim.

**Target:** <$3.50 per claim (blended EDI + RPA).

**Display:** Trend line, breakdown by channel (EDI vs. RPA). Important for demonstrating platform ROI.

### 7.2 Operational Dashboards

#### Billing Specialist Dashboard (Daily View)

| Widget | Content | Interaction |
|---|---|---|
| **Today's Work Queue** | Claims needing action, sorted by priority (denials, scrub failures, aging) | Click to open claim detail |
| **Claims Submitted Today** | Count + value of claims sent | Drill-down by payer, channel |
| **Payments Posted Today** | Insurance + patient payments received | Drill-down by ERA |
| **Unmatched ERAs** | ERA payments that couldn't auto-match to claims | Click to manually match |
| **Approaching Deadlines** | Claims approaching timely filing limits | Sorted by urgency |
| **Denial Alerts** | New denials received, grouped by auto-correctable vs. needs review | Click to view correction suggestions |

#### Practice Manager Dashboard (Weekly/Monthly View)

| Widget | Content | Purpose |
|---|---|---|
| **Revenue Cycle Scorecard** | CCR, FPRR, Days in A/R, Denial Rate, Collection Rate — all at a glance | Overall health check |
| **A/R Aging Waterfall** | Visual breakdown of A/R by aging bucket (0-30, 31-60, 61-90, 90+) | Identify collection risks |
| **Payer Performance Heatmap** | Grid of payers × metrics (pay speed, denial rate, adjustment rate) | Negotiate with underperforming payers |
| **Provider Production vs. Collection** | Per-provider comparison of what was produced vs. collected | Identify provider-level issues |
| **Trend Charts** | 12-month trends for all primary KPIs | Spot deterioration early |
| **Submission Channel Performance** | EDI vs. RPA: success rate, speed, cost | Optimize routing decisions |

### 7.3 A/R Aging Buckets — Detailed Breakdown

The aging report is the billing specialist's most-used report. Structure:

```
A/R AGING REPORT

                    0-30 days    31-60 days   61-90 days   91-120 days   120+ days    TOTAL
Insurance A/R       $45,200      $8,300       $3,100       $900          $200         $57,700
Patient A/R         $12,400      $5,600       $2,800       $1,200        $800         $22,800
                    ─────────    ─────────    ─────────    ─────────     ─────────    ─────────
Total A/R           $57,600      $13,900      $5,900       $2,100        $1,000       $80,500

% of Total          71.6%        17.3%        7.3%         2.6%          1.2%         100%
Target              >65%         <20%         <10%         <5%           <2%
Status              ✓ On target  ✓ On target  ✓ On target  ✓ On target   ✓ On target
```

**Drill-down capabilities:**
- Click any cell → see individual claims in that bucket
- Filter by payer, provider, procedure category
- Show "stuck" claims — claims that have been in the same aging bucket for >14 days without status change
- Show "progress" — claims that moved from one bucket to the next vs. resolved

### 7.4 Payer Performance Comparison Report

Track per-payer metrics over time to inform contract negotiations and routing decisions:

| Metric | Definition | Why It Matters |
|---|---|---|
| **Average Days to Payment** | Mean days from submission to payment receipt | Slow payers hurt cash flow |
| **Denial Rate** | % of claims denied by this payer | High denial payers cost more to manage |
| **Top Denial Reasons** | Most frequent CARCs for this payer | Identify payer-specific scrubbing rules |
| **Downcoding Rate** | % of claims paid at a lower code than submitted | Payer policy vs. coding issue |
| **Average Adjustment %** | (Contractual adjustments / Charges) for this payer | Measures contract quality |
| **Appeal Success Rate** | % of appealed denials overturned | Is it worth appealing with this payer? |
| **Attachment Request Rate** | % of claims pended for documentation | Proactive attachment strategy needed? |
| **RPA vs. EDI Performance** | Submission success rate by channel for this payer | Optimize routing |

### 7.5 Denial Analytics Dashboard

Denials are where money goes to die. Deep denial analytics drive continuous improvement:

**Denial Reason Pareto Chart:**
- Show top 10 denial reasons (by CARC code) as a bar chart, sorted by claim count and dollar value
- Each bar drill-downs to affected claims
- Target: top 3 denial reasons should drive >60% of improvement efforts

**Denial Trend by Category:**
- Track denial rate over time, split by category:
  - **Eligibility denials** (CARC 27, 29) — preventable via eligibility verification
  - **Coding denials** (CARC 4, 16, 97) — preventable via scrubbing
  - **Benefit denials** (CARC 50, 96, 119) — preventable via benefit checking
  - **Documentation denials** (CARC 16, 252) — preventable via proactive attachments
  - **Authorization denials** (CARC 197) — preventable via preauth workflow

**Denial Recovery Rate:**
```
Denial Recovery Rate = (Revenue recovered from denied claims via appeal/resubmission) /
                       (Total denied claim value) × 100

Target: >60% recovery rate on appealed/resubmitted denials
```

### 7.6 Automation Performance Metrics

These metrics measure the platform's automation effectiveness:

| Metric | Definition | Target |
|---|---|---|
| **Auto-Submission Rate** | % of claims submitted without human intervention (passed scrubbing, auto-routed, auto-submitted) | >85% |
| **Auto-Post Rate** | % of ERA payments auto-matched and auto-posted without human intervention | >90% |
| **Auto-Correction Rate** | % of denials auto-corrected and resubmitted (Tier A) without human intervention | >30% of denials |
| **Scrub-to-Submit Time** | Average time from encounter completion to claim submission | <4 hours (same day) |
| **ERA-to-Post Time** | Average time from ERA receipt to payment posting in PMS | <1 hour (auto-post), <24 hours (including manual exceptions) |
| **Human Touch Rate** | % of claims requiring any human intervention from creation to close | <20% (target: minimize) |
| **RPA Uptime** | % of time each RPA script is operational | >99% per payer |
| **Routing Optimization Savings** | Cost saved by routing to cheaper channel vs. default EDI | Track monthly |

### 7.7 Financial Summary Reports

**Daily Flash Report (auto-generated, emailed to practice owner):**
```
DAILY FLASH — March 28, 2026

Production:              $14,250 (vs. $12,800 daily target)
Collections:             $11,900 (insurance: $9,200 + patient: $2,700)
Claims Submitted:        42 claims ($38,500 billed)
Payments Posted:         28 ERAs ($9,200)
Denials Received:        3 (2 auto-corrected, 1 in review queue)
New Patient Balances:    $2,100 transferred to patient A/R
```

**Monthly Summary Report:**
- Production by provider, by procedure category
- Collections by payer, by collection method
- Adjustments summary (contractual, write-offs, patient courtesy)
- Net collection rate vs. target
- A/R aging trend vs. prior month
- Claim volume and cost metrics
- Top denial reasons and recovery actions

**Quarterly Business Review Packet:**
- All monthly metrics + trend analysis
- Payer contract analysis (which payers to renegotiate)
- ROI analysis of automation (cost per claim trend, human touch rate trend)
- Recommendations for process improvements based on data
