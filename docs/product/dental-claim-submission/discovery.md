# Dental Claim Submission — Discovery Document

## 1. What This Product Does

Submits dental insurance claims (837D) from practice management systems to payers — via EDI (Stedi) or RPA (payer portals) — with required attachments. Scope starts after eligibility verification and ends at payer acknowledgment (277CA accepted — claim confirmed in-process). Does not include claim status tracking or ERA/payment posting.

## 2. Business Context

### What We Have

- Production platform with HITL web app for human-in-the-loop corrections (practice staff — front desk/office manager — handle corrections)
- Generative RPA engine with near-zero marginal cost per payer portal. New RPA flows needed for claim submission but framework abstracts creation/maintenance.
- RPA workflows on 20+ top payer portals (eligibility) — same portals, different forms for claims
- Stedi integration for eligibility (EDI); strong partnership — sole EDI partner/clearinghouse, no other clearinghouse
- Stedi 837D support: 345 payers including Delta Dental (~20 state entities + DDIC 94276), Cigna, Guardian, MetLife, Humana, UHC Dental, Ameritas, Sun Life, Principal, many BCBS plans
- **Stedi gap: Aetna (60054) has no 837D support** — pure RPA path for Aetna dental claims
- Stedi 275 (attachments): only 28 dental payers supported — mostly Anthem BCBS state plans, Humana, UMR. RPA portal upload is the default attachment path; EDI 275 is an optimization where available.
- Channel partner with dental CRM, 11k practices, embedded app, API integration for eligibility triggers
- Partner owns PMS sync for eligibility; sends member ID, name, DOB, NPI, payer (free text) per request
- AI-powered payer mapping pipeline: partner's free-text payer names → our canonical payer records (clearinghouse payer IDs, aliases, alternative names)
- Provider data in our system today: **TIN and practice name only**. For claims, also need billing NPI, rendering NPI, taxonomy codes, service facility address. Onboarding gap — unclear if partner adds provider data or we manage independently.
- Live access to one dental practice's Open Dental instance (MySQL DB + API via Tailscale) — currently querying appointments, claim data exists but unexplored
- Claim submission is a separate RCM package from eligibility; partner flips the switch to activate practices
- Embedded app is a new tab in partner's CRM (iframe). Same UI as eligibility, more features unlocked for RCM.
- Notifications: webhooks to partner CRM (primary) for surfacing corrections needed. Email and other channels as fallback. Partner handles notification UX.
- Stedi knows full RCM is coming; relationship has been eligibility-focused but they've been told about ramp-up

### Current Practice Billing Workflow (what we're replacing)

**Claim origin**: Claims are created in the PMS from charted treatments in the vast majority of practices. Clearinghouse portals are a fallback for edge cases. [VERIFIED]

| Step | Who | Where | Manual? |
|------|-----|-------|---------|
| Treatment charting + CDT coding | Provider + assistant | PMS | Yes |
| Claim creation | Billing staff | PMS | Auto-generated from chart, requires review |
| Attachment collection (x-rays, charts, narratives) | Billing staff | PMS + imaging software | **Major pain point** — manual gathering |
| Claim scrubbing | Billing staff or clearinghouse | PMS or clearinghouse | Semi-auto — clearinghouse flags errors, human fixes |
| Submission to clearinghouse | Billing staff | PMS (batch or real-time) | One click if clean; manual rework if not |
| Tracking / follow-up | Billing staff | Clearinghouse portal + PMS | **Manual** — check status, call payers |

**Who does billing**: Office manager / front desk in most small practices (billing is one of many duties — ADA reports front-office teams spend **up to 35% of their time** on billing). Dedicated insurance coordinators exist in mid-size+ practices. ~15-25% of practices outsource billing (growing due to staffing shortages — 70%+ of dentists report admin recruitment is "extremely challenging"). [VERIFIED]

**Key pain points**: ~20% dental claim denial rate on first submission. Each rework costs $25-$117. **65% of denied claims are never resubmitted** = pure revenue loss. Attachment collection and payer-specific rules are the biggest manual burdens. [VERIFIED]

### PMS Landscape

- **Eaglesoft ~80%**, Dentrix ~10-20%, Open Dental ~1-5%, smattering of Denticon + one other
- Delivery order: **Open Dental integrated E2E first**, Eaglesoft one month later
- No formal PMS integration pattern established yet — only direct DB queries for appointments on one Open Dental instance

### What We Need

- PMS read/write integration for claim data (we own this, not partner). Write-back: whatever keeps their ledger up to date — exact fields TBD.
- 837D claim generation and submission (EDI via Stedi where supported + RPA for the rest, including Aetna)
- Attachment collection, formatting, and submission pipeline — three potential paths: direct upload, screen capture, or automatic pull from source system. AI-assisted. Bar: match or beat Vyne Trellis and DentalXChange automation.
- Payer-specific validation rules engine
- CDT code → required fields/attachments decision logic
- COB handling for primary/secondary claim sequencing
- Claim tracking and status visibility in both embedded app and PMS
- Auto-creation of claims from completed appointment sync (not manual trigger)

## 3. Domain Mechanics

### 837D Transaction Structure

Standard: ASC X12N 005010X224A2. Key hierarchy: [VERIFIED]

```
ISA/GS/ST envelope
  Loop 1000A/B  Submitter/Receiver
  Loop 2000A    Billing Provider (HL03=20)
    Loop 2010AA   Billing Provider Name (NM101=85, NPI in NM109)
  Loop 2000B    Subscriber (HL03=22)
    SBR           Subscriber Information
    Loop 2010BA   Subscriber Name (NM101=IL)
    Loop 2010BB   Payer Name (NM101=PR, payer ID in NM109)
  Loop 2000C    Patient (HL03=23) — only if patient != subscriber
  Loop 2300     Claim Information
    CLM           Claim segment (PCN, total charge, place of service, frequency code)
    DN1           Orthodontic treatment (situational)
    DN2           Tooth status — missing teeth (repeatable)
    DTP           Dates (service, appliance placement, prior prosthesis)
    REF*G1        Prior authorization number
    REF*G3        Predetermination number
    PWK           Attachment reference (report type + control number)
    HI            Diagnosis codes (situational for dental; REQUIRED for Medicare Jul 2025+)
    Loop 2320     COB — Other Subscriber (for secondary claims)
    Loop 2400     Service Lines (repeatable)
      SV3           Dental Service (CDT code, charge, oral cavity, procedure count)
      TOO           Tooth Information (tooth number + surface codes)
      DTP*472       Service date
```

### Key Differences from 837P (Professional)

| Aspect | 837P | 837D |
|--------|------|------|
| Service line segment | SV1 | SV3 |
| Procedure codes | CPT/HCPCS | CDT (D-codes) |
| Implementation guide | 005010X222A1 | 005010X224A2 |
| Tooth/surface fields | None | TOO segment, SV3 oral cavity |
| Orthodontic segments | None | DN1, DN2 |
| Prosthesis tracking | None | SV3 prosthesis code + DTP prior placement date |
| Diagnosis codes | Required (ICD-10) | Situational (except Medicare) |

[VERIFIED]

### SV3 Segment (Dental Service Line)

```
SV3*AD:D7140*55*11**1~
     |  |     |  |   |
     |  |     |  |   Procedure count (units)
     |  |     |  Oral cavity designation
     |  |     Line item charge
     |  CDT code
     Qualifier (always "AD")
```

[VERIFIED]

### TOO Segment (Tooth Information)

```
TOO*JP*12*L:O~
    |   |  |
    |   |  Surface codes (colon-delimited: M/O/I/D/B/F/L)
    |   Tooth number (1-32 permanent, A-T primary)
    Qualifier (JP = Universal National Tooth Number)
```

[VERIFIED]

### CLM Frequency Codes

| Code | Meaning |
|------|---------|
| 1 | Original submission |
| 6 | Corrected claim |
| 7 | Replacement of prior claim |
| 8 | Void/cancel prior claim |

[VERIFIED]

### Reference Codes

**Oral Cavity Designations**: 00=Entire, 01=Maxillary, 02=Mandibular, 10=UR Quadrant, 20=UL Quadrant, 30=LL Quadrant, 40=LR Quadrant [VERIFIED]

**Tooth Surfaces**: M=Mesial, O=Occlusal, I=Incisal, D=Distal, B=Buccal, F=Facial, L=Lingual [VERIFIED]

### Claim Attachments

**Three submission methods in practice**: [VERIFIED]

| Method | PWK02 Code | Mechanism |
|--------|-----------|-----------|
| Electronic (X12 275) | EL | 275 transaction via clearinghouse |
| Electronic (PDF/esMD) | FT | PDF transmission |
| Fax | FX | Fax to payer |
| Mail | BM | Paper mail |

**PWK segment** (Loop 2300 or 2400):
```
PWK*DG*EL***AC*ATT-CTRL-12345~
    |   |     |   |
    |   |     |   Attachment control number
    |   |     Qualifier (always AC)
    |   Transmission code
    Report type (DG=Diagnostic, OB=Operative, RB=Radiology, 03=Narrative)
```

Only the FIRST PWK iteration per claim/line level is considered for adjudication. [VERIFIED]

**CMS Electronic Attachments Final Rule**: [VERIFIED]
- Effective date: **May 26, 2026**
- Compliance deadline: **May 26, 2028**
- Adopts X12 version **6020** (not 5010) for 275 and 277 transactions
- 6020 contains Binary Data Segment for encoded clinical data
- LOINC codes for document type identification: [UNVERIFIED — rule adopts HL7 C-CDA and X12 standards; LOINC requirement needs confirmation]
- Industry readiness: early-stage. Estimated $1.4-2.84B hospital implementation costs. Clearinghouses and vendors still developing workflows.
- Confirm Stedi is tracking 6020 adoption

### Pre-Authorization vs Pre-Determination

| | Pre-Authorization | Pre-Determination |
|--|-------------------|-------------------|
| Transaction | 278 (Services Review) | 837D (same as claim) |
| Binding? | Yes | No (informational) |
| Validity | Typically 60-90 days | Varies |
| 837D flag | N/A | CLM19 = `PB`, omit service dates |
| Claim linkage | REF*G1*[auth-number] | REF*G3*[predet-number] |

[VERIFIED]

## 4. Rules & Requirements

### CDT Code → Required Fields Matrix

| Code Range | Category | Tooth # | Surface | Oral Cavity | Prosthesis Date |
|------------|----------|---------|---------|-------------|-----------------|
| D0100-D0999 | Diagnostic | Some | No | Some | No |
| D1000-D1999 | Preventive | Some | No | No | No |
| D2000-D2999 | Restorative | **Yes** | **Yes** | No | No |
| D3000-D3999 | Endodontics | **Yes** | No | No | No |
| D4000-D4999 | Periodontics | No | No | **Yes** (quadrant) | No |
| D5000-D5899 | Prostho-Removable | No | No | **Yes** (arch) | **Yes** |
| D6000-D6999 | Implants/Fixed Prostho | **Yes** | No | No | **Yes** |
| D7000-D7999 | Oral Surgery | **Yes** | No | No | No |
| D8000-D8999 | Orthodontics | No | No | No | No (DN1 required) |

The ADA publishes an annual "Guide to Dental Procedures Reported with Area of Oral Cavity and Tooth Anatomy" — the definitive CDT-to-field mapping. [VERIFIED]

### Attachment Requirements by Procedure

| CDT Code | Procedure | X-ray | Narrative | Perio Chart | Photos | Pre-Auth? |
|----------|-----------|-------|-----------|-------------|--------|-----------|
| D2740-D2799 | Crowns | **PA x-ray** | **Yes** | No | Optional | Recommended |
| D2950 | Core buildup | **PA x-ray** | **Yes** | No | No | With crown |
| D3310-D3330 | Root canal | **Pre+post PA** | Yes | No | No | Often |
| D4341/D4342 | SRP | **FMX/pano** | **Yes** | **Yes** | No | Recommended |
| D4210-D4267 | Surgical perio | **FMX/pano** | **Yes** | **Yes** | Optional | **Yes** |
| D5110-D5214 | Dentures/partials | **Pano** | Yes | No | No | **Yes** |
| D6010 | Implant placement | **Post-op PA** | Yes | No | Optional | **Yes** |
| D6058-D6066 | Implant crowns | **PA x-ray** | Yes | No | Optional | **Yes** |
| D6740-D6792 | Bridge retainers | **PA** | Yes | No | No | **Yes** |
| D7210-D7241 | Surgical extractions | **PA/pano** | Yes | No | No | Recommended |
| D8070-D8090 | Orthodontics | **Pano+ceph** | Yes | No | **Yes** | **Mandatory** |

[VERIFIED]

### Frequency Limitations

| CDT Code | Procedure | Typical Limit | Period | Engineering Note |
|----------|-----------|---------------|--------|------------------|
| D0120 | Periodic eval | 2x/year | Calendar year or rolling 6mo | |
| D0150 | Comprehensive eval | 1x/3-5yr | Rolling | New patient only |
| D0210 | FMX | 1x/3-5yr | Rolling | **Pano+BWX may remap to FMX** |
| D0274 | Bitewings (4) | 1-2x/year | Calendar year | |
| D0330 | Panoramic | 1x/3-5yr | Rolling | Combined with BWX = FMX |
| D1110 | Adult prophy | 2x/year | Calendar year or rolling 6mo | |
| D1120 | Child prophy | 2x/year | Calendar year | Age cutoff varies 13-16 |
| D2750 | Crown | 1x/5-10yr per tooth | Rolling | Replacement clause |
| D4341/D4342 | SRP | 1x/24mo per quadrant | Rolling 24mo | |
| D5110-D5140 | Dentures | 1x/5-7yr | Rolling | Replacement clause |
| D6010 | Implant | 1x/lifetime per site | Lifetime | |
| D8070-D8090 | Orthodontics | 1x/lifetime | Lifetime | |

**Critical**: D0330 (pano) + D0274 (BWX) on same visit → many payers remap to D0210 (FMX) and apply the 3-5yr frequency limit. [VERIFIED]

### Bundling Rules (Code Pairs That Conflict)

| Code A | Code B | Rule |
|--------|--------|------|
| D2950 (core buildup) | D2740-D2799 (crown) | Many payers deny D2950 as "included in crown" |
| D3120 (pulp cap) | Restoration (D2140-D2394) | Pulp cap considered part of restoration |
| D0330 (pano) + D0274 (BWX) | D0210 (FMX) | Combination remaps to FMX, triggers frequency limit |
| D1110 (prophy) | D4341 (SRP) | Cannot clean and deep clean same day |
| D1110 (prophy) | D4910 (perio maint) | Mutually exclusive same DOS |
| D7952 (bone graft) | D6010 (implant) | Must be different DOS |
| D9310 (consultation) | D0150 (comp eval) | Often bundled; one eval per visit |
| D2940 (sedative fill) | D2740-D2799 (crown) | Payers deduct sedative fill from crown fee or deny as inclusive [VERIFIED] |
| D4355 (full mouth debridement) | D1110 (prophy) | Mutually exclusive same DOS — no clinical reason for both [VERIFIED] |
| D4355 (full mouth debridement) | D0180 (comp perio eval) | Cannot bill both same date; debridement exists because eval can't yet be done [VERIFIED] |
| D0220 (PA first image) x2+ | Should be D0220 + D0230 | Second+ images must use D0230 (each additional), not duplicate D0220 [VERIFIED] |
| D4263 (bone graft) x3+ same quad | D4263 x1 + D4264 x2 | Multiple first-site codes recode to first + additional per quadrant [VERIFIED] |
| D7140/D7210 (extraction) | D9215 (local anesthesia) | Anesthesia included in extraction; separate billing denied as unbundling [VERIFIED] |
| D7140/D7210 (extraction) | D7910 (suture of wound) | Suturing included in extraction; separate billing denied [VERIFIED] |
| D9930 (treatment of complications) | Original procedure code | Complication treatment bundled into originating procedure [VERIFIED] |
| D0150 (comp eval) | D0180 (comp perio eval) | Mutually exclusive — one comprehensive eval type per visit. D0180 supersedes D0150 when periodontal disease is present. [VERIFIED] |
| D2940 (sedative fill) | D3310-D3330 (endo/RCT) | Sedative fill denied when endo billed same tooth [VERIFIED] |

### Alternate Benefit / LEAT (Least Expensive Alternative Treatment)

When a plan has this clause: dentist submits actual code (e.g., D2392 posterior composite), payer pays based on cheaper alternative (e.g., D2150 amalgam). Claim is **NOT rejected** — paid at alternate fee. Patient pays the difference. [VERIFIED]

### Downcoding Rules

| Submitted | Downcoded To | Trigger |
|-----------|-------------|---------|
| D4341 (SRP 4+ teeth) | D4342 (1-3 teeth) | Fewer than 4 teeth documented |
| D2750 (PFM high noble) | D2751 (PFM base metal) | Alternate benefit clause |
| D2391-D2394 (posterior composite) | D2140-D2161 (amalgam) | Alternate benefit on posterior |
| D0150 (comprehensive eval) | D0120 (periodic) | Not a new patient |
| D7210 (surgical extraction) | D7140 (simple extraction) | No documentation of flap elevation, bone removal, or sectioning [VERIFIED] |
| D0210 (FMX) | Individual PA/BW codes | Fewer images than required for complete series [VERIFIED] |
| D2740 (porcelain/ceramic crown) | D2750 (PFM) | Alternate benefit: common PPO practice — plan covers PFM, not all-ceramic, especially for posterior teeth [VERIFIED] |
| D4910 (perio maintenance) | D1110 (prophy) | No prior D4341/D4342 SRP on record; reclassified as routine cleaning [VERIFIED] |

### Timely Filing Requirements

| Payer | Filing Deadline | Notes |
|-------|----------------|-------|
| Delta Dental | 12 months from DOS | [VERIFIED] |
| Aetna | 90 days (in-network) | Plan-specific exceptions [VERIFIED] |
| Cigna | 90 days (participating) | 180 days non-par [VERIFIED] |
| UHC | 90 days (standard) | [VERIFIED] |
| BCBS FEP | 2 years | [VERIFIED] |
| MetLife | 12 months (commonly) | Plan-variable; some plans cite 90 days for "clean claim" — confirm per certificate [PARTIALLY VERIFIED] |
| Guardian | 12 months | [VERIFIED] |
| Principal Financial | 12 months (36 months for ortho) | [VERIFIED] |
| Ameritas | 90 days | Short deadline, same tier as Aetna/Cigna/UHC [VERIFIED] |
| Medicare Part B | 12 months | [VERIFIED] |

For secondary claims, clock may restart from primary payer's EOB date — varies by payer.

### Pre-Authorization Requirements

| CDT Range | Category | Pre-Auth Required? |
|-----------|----------|--------------------|
| D0-D1 | Diagnostic/Preventive | No |
| D2140-D2394 | Basic restorations | No |
| D2510-D2664 | Inlays/onlays | **Yes** |
| D2710-D2799 | Crowns | **Recommended** |
| D3310-D3330 | Root canals | **Often** |
| D4341-D4342 | SRP | **Recommended** |
| D4210-D4285 | Surgical perio | **Yes** |
| D5110-D5899 | Dentures/partials | **Yes** |
| D6010-D6199 | Implants | **Yes** |
| D6205-D6792 | Bridges | **Yes** |
| D8010-D8999 | Orthodontics | **Mandatory** |

Delta Dental penalty: up to 50% reduction if pre-auth required but not obtained, and patient cannot be billed for the penalty. [VERIFIED]

### COB Rules

**Primary/secondary determination order**: [VERIFIED]
1. Subscriber's own plan > plan where patient is dependent
2. Active employee plan > COBRA/retiree
3. Dependent children: **Birthday Rule** (earlier MM/DD = primary, NOT age-based)
4. Same birthday: plan that covered parent longest = primary
5. Divorce decree may override birthday rule

**COB calculation methods**:
| Method | How Secondary Pays |
|--------|--------------------|
| Traditional/Standard | Up to 100% of allowed (picks up remainder) |
| Non-Duplication | If primary >= secondary's allowed, secondary pays $0 |
| Maintenance of Benefits | Reduces by primary payment, then applies own terms |

**Secondary claims require**: Loop 2320 with primary payer adjudication data (AMT, CAS segments), Loop 2330A/B for other subscriber/payer names, line-level SVD/CAS with per-line adjudication from primary. Primary must adjudicate first.

### Medicare Dental (January 2025+)

New mandatory requirement effective **January 1, 2025**: ICD-10 diagnosis codes on 837D **and** KX modifier for medical-linked dental procedures. The KX modifier certifies medical necessity and coordinated care between medical and dental providers. Most dental workflows have never required diagnosis codes on 837D — special handling needed. [VERIFIED]

**Common Medicare dental diagnosis codes**:
- Z01.818 — Dental infection eradication before cardiac valve surgery
- Z76.82 — Dental infection eradication before organ/stem cell transplant
- K00-K14 — Oral cavity disease codes
- Z01.20 — Routine dental exams with normal findings

Applies to ALL dental claims seeking Medicare reimbursement for medical-linked procedures, not just specific CDT codes.

## 5. Data Contracts

### PMS → Our System (Read)

| Field | Purpose | Notes |
|-------|---------|-------|
| Patient demographics | Subscriber/patient identity | DOB, gender, address, name |
| Subscriber ID | Payer identification | May need alpha prefix per payer |
| Group/plan number | Plan identification | |
| CDT procedure codes | Service lines | With date of service |
| Tooth numbers | Per service line | 1-32 (permanent), A-T (primary) |
| Tooth surfaces | Restorative codes | M/O/I/D/B/F/L |
| Quadrant/arch | Perio/prostho codes | Oral cavity designation |
| Provider NPI | Billing + rendering | Type 1 (individual) vs Type 2 (org) |
| Provider taxonomy | Specialty code | Must be 1223... series for dental |
| Charge amounts | Per line + total | Total must = sum of lines |
| Diagnosis codes | HI segment | Only for Medicare dental currently |
| Prior auth numbers | REF*G1 | If pre-auth was obtained |
| Prosthesis dates | Prior placement | For replacement crowns/bridges/dentures |
| Missing teeth | DN2 segments | Tooth number + status code |
| Orthodontic data | DN1 segment | Months of treatment, appliance date |
| Clinical attachments | X-rays, narratives, charts | File format matters (JPEG/TIFF preferred) |

### Our System → Payer (Write via EDI/RPA)

| Data | Format | Channel |
|------|--------|---------|
| 837D claim transaction | X12 005010X224A2 | Stedi (EDI) or payer portal (RPA) |
| Attachments | JPEG/TIFF (not PDF for some payers) | X12 275 (where available), portal upload (RPA), NEA# reference |
| Pre-determination | 837D with CLM19=PB, no service dates | Same channels |

### Our System → PMS (Write back)

| Data | Purpose | When |
|------|---------|------|
| Claim submission status | Track lifecycle | On submission |
| Payer claim control number | For corrections/replacements (REF in Loop 2300) | From 277CA acknowledgment |
| Attachment control number | PWK06 reference | On attachment submission |

### Stedi API Specifics

| Item | Detail |
|------|--------|
| Idempotency | Idempotency-Key header deduplicates within 24h — always send |
| PCN length | Max 20 chars (recommend 17) |
| Payer ID | NM109 in Loop 2010BB, must exist in Stedi payer network |
| Implementation guide | ST03 = 005010X224A2 (hardcode) |
| Reserved chars | Auto-strip ~, *, :, ^ from all string fields |
| 275 support | Sparse — confirm payer-by-payer availability with Stedi |

## 6. Failure Taxonomy

### Pre-Submission Validation (Auto-fixable)

| Failure | Resolution | HITL? |
|---------|-----------|-------|
| Total charges != sum of lines | Auto-recalculate | No |
| PCN > 20 chars | Truncate to 17 | No |
| Reserved X12 chars in data | Strip ~, *, :, ^ | No |
| Invalid segment order | Reorder per 005010X224A2 | No |
| Duplicate line item control numbers | Regenerate | No |
| Future DOB or placeholder date | Reject to correction queue | Yes |

### Clearinghouse Rejections (Pre-Payer)

| Failure | Resolution | HITL? |
|---------|-----------|-------|
| Subscriber ID not found | Verify against eligibility response | Maybe |
| Invalid/missing NPI | Lookup in NPPES; validate Type 1 vs Type 2 | No |
| Incorrect payer ID routing | Fix from payer directory | No |
| CDT code requires tooth # but missing | Cross-reference ADA Appendix 3 | No |
| CDT code should NOT have tooth # but does | Strip tooth/surface data | No |
| Invalid tooth+surface combination (e.g., occlusal on anterior) | Validate surface against tooth type | No |
| Duplicate claim (same PCN) | Deduplicate; use freq code 7 for corrections | No |
| Missing subscriber address (when subscriber=patient) | Pull from PMS | Yes |
| Charge amount rounding mismatch | Auto-recalculate, tolerance +/- $0.01 | No |

### Payer Rejections

| CARC | Meaning | Resolution | HITL? |
|------|---------|-----------|-------|
| 16 | Missing/invalid info | Read paired RARC for specifics, fix, resubmit | Yes |
| 18 | Duplicate claim | Deduplicate; if corrected, use freq code 7 | No |
| 4 | Procedure/modifier inconsistency | Verify payer routing and claim data | Yes |
| 252 | Attachment required | Gather docs, resubmit with PWK reference | Yes |
| 253 | Sequencing incorrect | Appeal with chart notes or prior EOBs | Yes |
| 29 | Timely filing expired | Limited recourse; appeal with proof of timely submission | Yes |
| 289 (Delta proprietary) | COB required | Submit primary EOB data | Yes |

### Attachment Failures

| Failure | Resolution | HITL? |
|---------|-----------|-------|
| Wrong file format (PDF when JPEG/TIFF required) | Convert before submission | No |
| File too large (UHC: 2MB limit) | Compress/resize images | No |
| NEA reference format wrong (must be `NEA#` + number, no spaces) | Validate format: `/^NEA#\d+$/` | No |
| Attachment ID mismatch (PWK06 != upload reference) | Validate match before submission | No |
| PWK segment missing for procedure that requires attachment | Auto-add PWK based on CDT rules | No |
| Attachment uploaded but claim sent without reference | Ensure atomic send | No |

### COB Failures

| Failure | Resolution | HITL? |
|---------|-----------|-------|
| Wrong primary/secondary ordering | Apply COB rules (birthday rule, subscriber rule) | Yes |
| Missing primary EOB on secondary claim | Queue until primary adjudicates | No |
| Submitted secondary before primary adjudicated | Queue secondary until primary 835 received | No |
| Birthday rule misapplied | Compare MM/DD only, ignore year | No |

### PMS Data Quality Issues

| Bad Data Pattern | Resolution | HITL? |
|------------------|-----------|-------|
| NPI Type 1/Type 2 confusion | Billing=Type 2 (org) or Type 1 (solo); rendering=always Type 1 | No |
| Missing rendering provider in group practice | Always populate rendering loop | No |
| Wrong taxonomy (should be 1223... for dental) | Validate taxonomy prefix | No |
| Subscriber ID missing alpha prefix | Apply payer-specific formatting | No |
| Provider not credentialed with payer (denial 208) | Maintain provider-payer enrollment matrix | Yes |
| Stale group number after plan change | Cross-reference with latest eligibility | Maybe |

## 7. Integration Inventory

| System | Direction | Format | Status | Owner |
|--------|-----------|--------|--------|-------|
| Open Dental | Read + Write | REST API (primary) + MySQL direct (fallback) via Tailscale | **Prototype** (have live access to one practice, querying appointments) | Us |
| Eaglesoft | Read + Write | Direct SQL Server queries (undocumented schema) + file-based claim export | **Needed** (month after Open Dental) | Us |
| Dentrix | Read + Write | TBD | **Future** | Us |
| Stedi | Write (837D claims) | X12 005010X224A2 / JSON API | **Available** — 345 dental payers, no enrollment required. Gap: Aetna. | Us |
| Stedi | Write (275 attachments) | X12 275 | **Sparse** — 28 dental payers only (Anthem BCBS, Humana, UMR) | Us |
| Payer portals (20+) | Write (claims + attachments) | RPA / portal upload | **Needed** — new RPA flows, same portals as eligibility | Us |
| Partner CRM | Read (triggers) | API | **Live** (eligibility). Claim activation = separate RCM package, partner flips switch. | Partner |
| Partner PMS sync | Read (patient data) | API | **Live** (eligibility only — member ID, name, DOB, payer) | Partner |

### Open Dental Integration Detail

**REST API** (requires eConnector on-prem, API key via Open Dental HQ): [VERIFIED]

| Domain | Endpoints | Sufficient? |
|--------|-----------|-------------|
| Claims | GET, POST, PUT (status/split), DELETE | **Yes** — full claim data, can set status to Sent |
| ClaimProcs | GET, PUT | **Partial** — read line items, update payments; no POST |
| ProcedureLogs | GET, POST, PUT, DELETE | **Yes** — full procedure data with teeth/surfaces |
| InsPlans / InsSubs / PatPlans | Full CRUD | **Yes** |
| Carriers | GET, POST, PUT | **Yes** — includes ElectID (payer ID) |
| Documents | GET, POST (base64/URL/SFTP), PUT, DELETE | **Yes** — image upload + retrieval |

**Key tables** (MySQL, for direct DB fallback): [VERIFIED]
- `claim` → `claimproc` → `procedurelog` → `procedurecode` (claim → line items → procedures → CDT codes)
- `insplan` → `carrier` (plan → payer with ElectID)
- `inssub` → `patplan` (subscriber → patient coverage)
- `document` (patient images/attachments)

**Image storage**: A-to-Z folder on filesystem (`{server}/OpenDentImages/{LastName}{FirstName}{PatNum}/`), formats: JPG, PNG, PDF, TIF. Up to 30 attachment files, 7 MB total per claim. Legacy installs may use DB blobs (`document.RawBase64`). [VERIFIED]

**Claim status flow**: `U (Unsent) → W (Waiting) → S (Sent) → R (Received)`. `PUT /claims/{ClaimNum}/Status` sets to Sent and auto-creates `etrans` record. [VERIFIED]

**Recommendation**: Use REST API as primary path. Direct MySQL only for bulk reads or tables without API endpoints (e.g., `claimattach`). [VERIFIED]

### Eaglesoft Integration Detail

**Database**: Microsoft SQL Server (migrated from Paradox ~v17). Schema is **proprietary and undocumented**. Patterson can change it between versions without notice. [VERIFIED]

**No public REST API, no FHIR, limited HL7** (imaging bridges only). No plugin SDK. No self-service developer program. [VERIFIED]

**How third parties integrate today**: [PARTIALLY VERIFIED]
- Direct SQL Server queries against reverse-engineered schema (most common — used by RevenueWell, Weave, Lighthouse 360)
- Claim file export (837 files to a pickup folder → clearinghouse)
- Imaging bridges (launch external apps with patient context via command-line args)
- Patterson Fuse middleware (announced but adoption unclear)

**Patterson partner program**: Invite-only, requires NDA + certification + Patterson approval. Not self-service. Patterson tends to acquire/bundle rather than enable open integrations. [UNVERIFIED — widely reported by dental software vendors]

**Risks**: Schema changes between versions break integrations silently. No real-time events/webhooks — must poll DB. Patterson support may decline assistance if direct DB access detected. Multi-location practices have separate databases. [UNVERIFIED]

**Stark contrast to Open Dental**: Open Dental is open-source with documented schema and public REST API. Eaglesoft is closed, undocumented, and gated.

## 8. Competitive Landscape

| Competitor | What They Do | Why We Can't/Don't Use Them | Our Alternative |
|------------|-------------|----------------------------|-----------------|
| **DentalXChange** | Major dental clearinghouse (107K+ providers, 71M claims/yr). ClaimConnect for claims, separate attachment service. Open Dental has deep integration; others via file upload. | Direct competitor to our claim submission pipeline | Stedi (EDI) + our RPA framework |
| **NEA/FastAttach** | Dominant attachment submission platform | Competitor; also terminated integration with DentalXChange | Direct 275 via Stedi where available; portal upload via RPA elsewhere |
| **Vyne Dental / Vyne Trellis** | Integrated claim + attachment services. Image Sync auto-pulls from Eaglesoft/Dexis. FastKapture for mobile photo capture. 800+ attachment payer connections. Flat monthly fee, unlimited claims. | Competitor to our full pipeline | Same as above |
| **Tesia** | Electronic attachment vendor | Competitor | Same as above |
| **TriZetto (Cognizant)** | Enterprise clearinghouse | Competitor at clearinghouse layer | Stedi + RPA |

### Competitive Gaps We Can Exploit

| Gap | Details |
|-----|---------|
| **Attachment selection is still manual** | Both Vyne and DXC require a human to decide WHICH images/documents to attach. No AI suggests "attach the BWX from 3/15 for D2740." [VERIFIED] |
| **No narrative generation from incumbents** | Staff manually types treatment narratives (5-10 min each). Neither Vyne nor DXC drafts narratives from clinical notes. However, dental AI startups (Denti.ai, Overjet, Videa.ai) generate claim-ready narratives from clinical data in ~30 seconds — emerging competitive pressure. [VERIFIED] |
| **No denial prediction** | Pre-submission checks are rule-based (missing fields). Neither predicts denial likelihood from payer history or procedure patterns. [UNVERIFIED] |
| **No appeal automation** | When claims are denied, neither auto-generates appeal letters. [UNVERIFIED] |
| **Limited cross-PMS support + manual matching** | Vyne Image Sync auto-syncs images FROM Eaglesoft/Dexis but users still manually select which synced images to attach to each claim — no auto-matching. DXC deep integration is Open Dental-only. Others get degraded experience. [VERIFIED] |
| **DXC attachment reliability** | DentalXChange attachments sometimes drop; not real-time delivery to payers. [VERIFIED] |

## 9. Payer-Specific Quirks

### Delta Dental

- **39 independent companies**, each with unique payer ID. Universal fallback: 94276. Wrong payer ID = claim denied. [VERIFIED]
- **Attachment payer ID override**: Always use 94276 for attachment routing, even when claim goes to state-specific payer ID. [VERIFIED]
- DeltaCare (DHMO) vs DPPO route to different endpoints. Detect plan type from eligibility. [VERIFIED]

### Aetna

- **No Stedi 837D support** — Aetna (60054) and all Aetna sub-plans (Better Health, DMO, Medicare, Voluntary) are RPA-only for claim submission. This is a top-3 dental payer. [CONFIRMED from Stedi payer export]
- **COB duplicate trap**: If COB data sent electronically, also mailing paper EOB causes duplicate rejection. Pick one channel. [VERIFIED]
- Publishes procedure-specific [Claim Documentation Guidelines](https://www.aetnadental.com/professionals/pdf/claim-documentation-guidelines.pdf). [VERIFIED]

### UnitedHealthcare

- **2MB attachment limit**. Larger files silently dropped. [VERIFIED]
- **GEHA transition** (effective January 1, 2025): GEHA claims now route through UHC infrastructure. Payer ID changed to **39026** for all electronic claims. Paper claims: P.O. Box 21191, Eagan, MN 55121. [VERIFIED]

### Cigna

- DHMO (Prepaid) claims CAN be submitted via EDI using payer ID **62308** (supports indemnity, DPPO, and DHMO). Portal submission is a fallback, not required. Detect plan type for correct payer ID. [VERIFIED — corrected from prior claim that DHMO required portal]

### MetLife

- Multiple payer IDs: 61109 (claims), 65978 (ERA). Wrong ID for wrong transaction type = routing failure. [VERIFIED]
- Timely filing: commercial plans typically 12 months; MetLife Federal Dental Plan specifies 90 days. Verify per plan certificate. [VERIFIED]

### Guardian

- Payer IDs: `64246` (primary), `GI813` (Managed DentalGuard plans). Use correct ID per plan type. [VERIFIED]
- X-ray claims cannot be faxed — must be electronic or mail. Fax only for non-radiograph claims. [VERIFIED]
- Electronic submission via DentalXChange, Change Healthcare, or Tesia clearinghouses. [VERIFIED]

### Principal Financial

- Payer ID: `61271`. [VERIFIED]
- **Claims submitted with SSN instead of Privacy ID will be rejected.** Must use Privacy ID only. [VERIFIED]
- Ortho has a 36-month filing window (vs 12 months standard). [VERIFIED]
- Uses NEA and Tesia for electronic attachments. [VERIFIED]

### Ameritas

- **Two payer IDs**: `47009` (Ameritas), `72630` (Ameritas of New York). Wrong payer ID = rejection. [VERIFIED]
- Narrative remark field: max 250 characters. Truncation beyond that. [VERIFIED]
- TIN must match IRS records exactly; TIN changes require explicit notification or claims reject. [VERIFIED]
- **90-day timely filing** — short deadline, same tier as Aetna/Cigna/UHC. [VERIFIED]

### BCBS State Plans

- **Each state plan has a different payer ID.** Filing to wrong state plan = immediate rejection. No central routing. [VERIFIED]
- **California split**: Two separate payers — `BS001` (Blue Shield) vs `BC001` (Anthem Blue Cross). Wrong one = rejection. [VERIFIED]
- **New York (Excellus)**: Payer ID varies by provider zip code (3 possible IDs by county). [VERIFIED]
- **Alpha prefix**: Use the 3-letter prefix on member ID to determine which state plan to route to. [VERIFIED]
- Taxonomy code required on all BCBS dental claims or claim rejects. [VERIFIED]

## 10. Open Questions

### Resolved

- ~~PMS vendors and order~~ → Eaglesoft ~80%, Dentrix ~10-20%, Open Dental ~1-5%. Open Dental first, Eaglesoft one month later.
- ~~PMS data access model~~ → Open Dental: REST API (primary) + MySQL direct (fallback). Eaglesoft: direct SQL Server against undocumented schema + file-based claim export. No public API.
- ~~Stedi 275 payer coverage~~ → 28 dental payers only (Anthem BCBS, Humana, UMR). RPA portal upload is the default.
- ~~Who handles HITL corrections~~ → Practice staff (front desk / office manager), in our app.
- ~~Claim trigger~~ → Auto-kick-off from completed appointment sync, not manual.
- ~~Current dental billing workflows~~ → Claims created in PMS from charted treatments. ~20% denied on first submission, 65% of denials never resubmitted. Attachment collection and payer-specific rules are biggest manual burdens. See Business Context section.
- ~~Vyne Trellis / DentalXChange capabilities~~ → Automation bar is electronic submission + bundled attachments + pre-submission field validation + auto-pull images from 1-2 PMS systems. Intelligence layer (which attachment, narrative gen, denial prediction) is absent from both. See Competitive Landscape section.
- ~~Open Dental claim data~~ → REST API covers claims, claimprocs, procedures, insurance, documents with full CRUD. Images in A-to-Z filesystem folder (JPG/PNG/PDF/TIF). See Integration Inventory section.
- ~~Eaglesoft data access~~ → Direct SQL Server queries against undocumented proprietary schema. No public API. Patterson partner program is invite-only. See Integration Inventory section.
- ~~CDT code-to-field mapping source~~ → We have a CSV of all CDT codes from ADA. New versions purchasable quarterly.
- ~~Attachment storage (Open Dental)~~ → A-to-Z folder on filesystem, JPG/PNG/PDF/TIF. Up to 30 files, 7MB total per claim. Some practices use separate imaging software (Dexis, Schick) bridged into PMS.
- ~~Pre-authorization workflow ownership~~ → Out of scope (future). Practices handle pre-auths via PMS today. 278 transaction is separate from 837D claim submission.
- ~~Narrative generation~~ → Auto-generate from clinical notes in PMS. AI-assisted, not practice-provided. Competitors (Denti.ai, Overjet, Videa.ai) generate in ~30 seconds from clinical data.
- ~~Provider credentialing data~~ → No dedicated credentialing data source. Somewhat implicit from which payer portals a provider has access to. Provider-payer enrollment status is not a hard prerequisite for submission — handle denial 208 reactively via HITL.
- ~~Patterson partner program~~ → No — cost-prohibitive. Lean into current legal environment around information blocking (21st Century Cures Act). Direct SQL against Eaglesoft schema is the path.

### Open

1. **Stedi 6020 migration timeline**: CMS compliance deadline is May 2028. Is Stedi tracking this? When will they support 6020 for 275/277? `[USER]` (ask Stedi)

2. **RPA claim submission — portal form mapping**: Same portals as eligibility, but different forms. Need to map claim submission UX on each portal for new RPA flows. `[ENGINEERING]`

3. **COB detection**: How do we know if a patient has dual coverage? From eligibility response? From PMS? This determines whether we can auto-sequence primary/secondary. `[ENGINEERING]`

4. **Claim correction flow**: When a claim is rejected and corrected, we need the original payer claim control number (from 277CA) to submit a replacement (freq code 7). How do we capture and store this across the EDI and RPA paths? `[ENGINEERING]`

5. **PMS write-back specifics**: What exactly needs to be written back to keep the practice ledger up to date? Open Dental API supports claim status updates (`PUT /claims/{id}/Status`) and payment posting. Eaglesoft write-back path is unclear given undocumented schema. `[ENGINEERING]`

6. **Eaglesoft schema reverse-engineering**: Need to validate key claim/insurance/procedure tables against a live Eaglesoft instance. Patterson's undocumented schema is the biggest integration risk. `[ENGINEERING]`

7. **Eaglesoft attachment storage**: Where does Eaglesoft store images? Same filesystem pattern as Open Dental, or database blobs? Separate imaging bridge? `[ENGINEERING]`

8. **Provider data onboarding**: For claim submission, we need billing NPI, rendering NPI, taxonomy codes, service facility address — today we only have TIN and practice name. Does the partner add provider data during practice activation, or do we manage it independently? Partner may not want us managing provider data. `[USER]` (partner conversation needed, TBD)

13. **COB from eligibility response**: Do our existing eligibility responses (270/271) already contain secondary coverage info? If yes, we can auto-detect dual coverage without additional PMS reads. `[ENGINEERING]` (check existing eligibility data)

---

*Generated 2026-04-01. Updated 2026-04-01 with stakeholder interviews (2 sessions), Stedi payer network analysis, billing workflow research, competitive analysis (Vyne Trellis/DentalXChange), Open Dental schema research, and Eaglesoft integration research. Sources verified via web search where possible. Tags: [VERIFIED] = confirmed via web search, [UNVERIFIED] = from training data, not independently confirmed, [PARTIALLY VERIFIED] = some claims confirmed, others not.*
