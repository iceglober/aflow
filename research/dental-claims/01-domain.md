# Dental Claims Domain

**Status:** COMPLETE
**Last updated:** 2026-03-28

---

## 1. The 837D Standard — Structure, Segments, Required Fields vs. Medical (837P)

### Overview

The HIPAA 837 transaction set is the standard electronic format for submitting healthcare claims. There are three variants:

| Variant | Use Case | Key Service Segment |
|---------|----------|-------------------|
| **837P** (Professional) | Physician/outpatient services | SV1 (Professional Service) |
| **837I** (Institutional) | Hospital/facility claims | SV2 (Institutional Service) |
| **837D** (Dental) | Dental services | SV3 (Dental Service) |

All three share the same envelope (ISA/GS/ST) and many common loops, but 837D has dental-specific segments and data requirements. The current implementation guide is the ASC X12 005010X224A2, maintained by the [X12 organization](https://x12.org/).

### High-Level Structure (Envelope → Claim)

```
ISA  — Interchange Control Header (sender/receiver IDs, date, control number)
  GS  — Functional Group Header (application sender/receiver, version)
    ST  — Transaction Set Header (transaction set ID = "837", version)
      BHT — Beginning of Hierarchical Transaction (purpose code, type, date)

      Loop 1000A — Submitter Name (NM1, PER)
      Loop 1000B — Receiver Name (NM1)

      HL — Hierarchical Level (Billing Provider)
        Loop 2010AA — Billing Provider (NM1, N3, N4, REF, PER)
        Loop 2010AB — Pay-to Address (if different)

        HL — Hierarchical Level (Subscriber)
          Loop 2000B — Subscriber info (SBR segment)
          Loop 2010BA — Subscriber Name (NM1, N3, N4, DMG)
          Loop 2010BB — Payer Name (NM1, N3, N4, REF)

          [Optional: HL — Patient level if patient ≠ subscriber]

          Loop 2300 — Claim Information
            CLM — Claim segment (claim ID, amount, facility code, etc.)
            DTP — Date segments (service date, etc.)
            REF — Reference IDs
            DN1 — Dental-specific: Orthodontic Treatment info ← 837D ONLY
            DN2 — Dental-specific: Tooth Status ← 837D ONLY

            Loop 2310A-E — Referring/Rendering/Service Facility providers
            Loop 2320 — Other Subscriber (COB/secondary insurance)

            Loop 2400 — Service Line Detail
              LX  — Line counter
              SV3 — Dental Service segment ← 837D ONLY (vs. SV1 in 837P)
              TOO — Tooth Information ← 837D ONLY
              DTP — Service date
              REF — Line-level references

    SE  — Transaction Set Trailer
  GE  — Functional Group Trailer
IEA — Interchange Control Trailer
```

### Key 837D-Specific Segments

**SV3 — Dental Service Line**: The core dental service segment. Contains:
- **Procedure code** (CDT code from the ADA, e.g., D0120 for periodic oral eval)
- **Charge amount**
- **Oral cavity designation** (area of the oral cavity — upper/lower, left/right quadrants)
- **Prosthesis, crown, or inlay code** (if applicable)
- **Diagnosis code pointer** (links to diagnosis on the claim header)

**TOO — Tooth Information**: Specifies:
- **Tooth number** (using the ADA Universal Numbering System, 1–32 for permanent, A–T for primary)
- **Tooth surface(s)** (M=Mesial, O=Occlusal, D=Distal, B=Buccal/Facial, L=Lingual — combined like "MOD" for a three-surface restoration)

**DN1 — Orthodontic Treatment**: Contains:
- Total months of orthodontic treatment
- Remaining months
- Whether treatment is ongoing (Y/N)
- Condition description

**DN2 — Tooth Status**: Reports the status of individual teeth (missing, impacted, etc.) — critical for orthodontic and prosthodontic claims.

### Key Differences: 837D vs. 837P

| Aspect | 837P (Professional) | 837D (Dental) |
|--------|-------------------|---------------|
| **Service segment** | SV1 | SV3 |
| **Code set** | CPT/HCPCS | CDT (ADA procedure codes) |
| **Tooth/surface data** | N/A | TOO segment (tooth #, surfaces) |
| **Orthodontic info** | N/A | DN1, DN2 segments |
| **Place of service** | POS code in CLM05 (e.g., 11=Office) | CLM05-1 uses facility code (dental office typically "11") |
| **Diagnosis codes** | ICD-10 required on most claims | ICD-10 on header, but many dental payers don't require it; CDT codes are primary |
| **Rendering provider NPI** | Always required | Required; dental claims also commonly carry the rendering provider's taxonomy code and license number |
| **Attachments** | PWK segment (rare) | PWK segment + attachment data frequently required (X-rays, perio charts, narratives) |
| **Claim frequency** | 1=Original, 7=Replacement, 8=Void | Same codes, but dental uses these more often for predeterminations |
| **Subscriber relationship** | Standard relationship codes | Same, but dental has higher rate of dependent claims (children) |

### CLM Segment — Claim-Level Detail

The CLM segment is shared across all 837 variants but carries dental-specific values:
- **CLM01**: Patient's claim/account number (from the practice)
- **CLM02**: Total claim charge amount
- **CLM05**: Place of service / facility type code composite
- **CLM06**: Provider/supplier signature indicator
- **CLM08**: Patient assignment of benefits (Y/N — whether payment goes to provider)
- **CLM09**: Release of information code
- **CLM11**: Related causes code (accident, employment, etc.)

### Required Fields for a Clean 837D Claim

At minimum, a valid 837D submission requires:
1. **Billing provider**: NPI, name, address, tax ID
2. **Subscriber/patient**: Name, DOB, gender, member ID, relationship to subscriber
3. **Payer**: Name, payer ID
4. **Claim header**: Claim ID, total charges, place of service, date(s) of service, provider signature indicator, assignment of benefits, release of information
5. **Service lines**: At least one SV3 segment with CDT code, charge amount, and (where applicable) tooth number and surface(s)
6. **Rendering provider**: NPI (if different from billing provider)

### Implementation Notes for Stedi Integration

Since the team uses Stedi for EDI, key considerations:
- Stedi provides 837D guide support — the X12 005010X224A2 implementation guide can be mapped directly
- Stedi handles ISA/GS envelope generation and control number management
- The encounter model should capture all SV3-level data: CDT code, tooth, surfaces, oral cavity, charge amount
- Validation should happen pre-submission: Stedi will reject structurally invalid EDI, but business rule validation (e.g., "surface codes required for restorative procedures") should happen in your app layer

## 2. ADA Procedure Codes (CDT), Tooth Numbering, Surfaces, and Coding Nuances

### CDT Code Structure

The **Code on Dental Procedures and Nomenclature (CDT)** is published annually by the [American Dental Association (ADA)](https://www.ada.org/resources/practice/dental-codes). CDT is the HIPAA-mandated code set for dental procedures — analogous to CPT for medical. CDT codes are updated every January 1.

**Format**: `Dxxxx` — the letter "D" followed by four digits.

| Code Range | Category | Examples |
|-----------|----------|----------|
| D0100–D0999 | **Diagnostic** | D0120 periodic oral eval, D0210 full-mouth X-rays, D0274 bitewings (4 films) |
| D1000–D1999 | **Preventive** | D1110 adult prophylaxis (cleaning), D1120 child prophylaxis, D1351 sealant |
| D2000–D2999 | **Restorative** | D2140 amalgam (1 surface, primary), D2391 resin composite (1 surface, posterior), D2740 crown — porcelain/ceramic |
| D3000–D3999 | **Endodontics** | D3310 root canal — anterior, D3330 root canal — molar |
| D4000–D4999 | **Periodontics** | D4341 scaling and root planing (per quadrant), D4910 periodontal maintenance |
| D5000–D5999 | **Prosthodontics (removable)** | D5110 complete denture — upper, D5213 partial denture — lower |
| D6000–D6999 | **Prosthodontics (fixed) / Implants** | D6010 implant body, D6058 abutment-supported crown — porcelain |
| D7000–D7999 | **Oral & Maxillofacial Surgery** | D7140 extraction — erupted tooth, D7210 surgical extraction, D7240 impacted tooth removal |
| D8000–D8999 | **Orthodontics** | D8080 comprehensive orthodontic — adolescent, D8090 comprehensive — adult |
| D9000–D9999 | **Adjunctive General Services** | D9110 palliative treatment, D9215 local anesthesia, D9310 consultation, D9986 missed appointment |

### Tooth Numbering — ADA Universal System

The ADA Universal Numbering System is required on 837D claims (mapped in the TOO segment):

**Permanent teeth (adults): Numbers 1–32**
```
        Upper Right → Upper Left
     1  2  3  4  5  6  7  8  9 10 11 12 13 14 15 16
    ─────────────────────────────────────────────────
     32 31 30 29 28 27 26 25 24 23 22 21 20 19 18 17
        Lower Right → Lower Left
```
- Tooth 1 = Upper right third molar (wisdom tooth)
- Tooth 8 = Upper right central incisor
- Tooth 9 = Upper left central incisor
- Tooth 14 = Upper left first premolar
- Tooth 17 = Lower left third molar
- Tooth 19 = Lower left first molar
- Tooth 30 = Lower right first molar
- Tooth 32 = Lower right third molar

**Primary teeth (pediatric): Letters A–T**
```
        Upper Right → Upper Left
     A  B  C  D  E  F  G  H  I  J
    ────────────────────────────────
     T  S  R  Q  P  O  N  M  L  K
        Lower Right → Lower Left
```

### Tooth Surfaces

Surfaces are coded as single letters and combined for multi-surface procedures:

| Code | Surface | Applies To |
|------|---------|-----------|
| **M** | Mesial | All teeth — toward midline |
| **D** | Distal | All teeth — away from midline |
| **O** | Occlusal | Premolars/molars — chewing surface |
| **I** | Incisal | Incisors/canines — biting edge |
| **B** | Buccal (Facial) | All teeth — cheek side |
| **L** | Lingual | All teeth — tongue side |
| **F** | Facial | Alternate for Buccal (some payers prefer F) |

**Common combinations** for restorative codes:
- **MO** = mesial-occlusal (2-surface filling)
- **MOD** = mesial-occlusal-distal (3-surface filling)
- **DOL** = distal-occlusal-lingual
- **MODBL** = 5-surface restoration

**Key rule**: The number of surfaces directly affects the procedure code and reimbursement. A D2391 (1-surface composite) pays less than D2393 (3-surface composite). Incorrect surface counts are a top rejection reason.

### Coding Nuances and Gotchas

**1. Surface requirements vary by procedure category:**
- Restorative (D2000s) — surfaces REQUIRED
- Crowns (D2700s) — surfaces typically NOT submitted (whole tooth)
- Endodontics (D3000s) — tooth required, surfaces NOT applicable
- Extractions (D7000s) — tooth required, surfaces NOT applicable
- Preventive (D1000s) — neither tooth nor surfaces (whole mouth)
- Sealants (D1351) — tooth required, surface = O by convention

**2. Quadrant vs. tooth-specific coding:**
- Periodontic procedures like D4341 (SRP) are billed **per quadrant**, not per tooth. The oral cavity designation (upper right, upper left, lower left, lower right) is submitted instead of individual tooth numbers.
- Quadrant codes: `10` = upper right, `20` = upper left, `30` = lower left, `40` = lower right. Arch codes: `01` = upper arch, `02` = lower arch.

**3. Date-sensitive code changes:**
- CDT codes change annually. A procedure performed in December billed in January must use the CDT code valid at the **date of service**, not the submission date.
- The ADA publishes code changes effective January 1 each year. Practices and clearinghouses must update code tables annually.

**4. Code-to-code bundling:**
- Payers commonly bundle certain procedures. Example: D0220 (periapical X-ray) is often considered inclusive with D3310 (root canal) — the X-ray won't pay separately on the same date of service.
- D9215 (local anesthesia) is bundled into most operative procedures by almost all payers.

**5. Prosthetic replacement rules:**
- Most plans limit crown/bridge/denture replacement to once per 5–10 years per tooth. Claims must include the **prior placement date** if replacing existing prosthetics (DTP segment with qualifier 441).
- Missing tooth clause: Many plans exclude coverage for teeth that were missing before the patient enrolled. The DN2 (tooth status) segment is used to report this.

**6. Age-based code restrictions:**
- D1120 (child prophylaxis) vs. D1110 (adult prophylaxis) — some payers flip at age 14, others at 13 or 16. Submitting the wrong one for the patient's age triggers a denial.
- Sealants (D1351) are typically only covered for patients under 16 and only on permanent molars (teeth 1, 2, 3, 14, 15, 16, 17, 18, 19, 30, 31, 32).

**7. Narrative requirements:**
- Certain codes require a written narrative (submitted as NTE segment or attachment). Examples: D2950 (core buildup), D7240 (impacted tooth), D4341 (SRP — some payers require perio charting).

### ADA Claim Form (Paper Equivalent)

The electronic 837D maps to the **ADA Dental Claim Form (J400/J430/J431)**. This is relevant because many PMS systems expose a "claim form" view to office staff. Key fields map as:

| Form Box | 837D Mapping | Description |
|----------|-------------|-------------|
| Box 1 | SV3 header info | Type of transaction (statement of actual services, predetermination, etc.) |
| Box 6 | CLM + DTP | Date of service |
| Box 24 | SV3-01 | Procedure code |
| Box 25 | TOO-02 | Tooth number(s) |
| Box 26 | TOO-03 | Tooth surface(s) |
| Box 29 | SV3-02 | Procedure charge |
| Box 31 | CLM02 | Total fee |
| Box 35 | DN2 / Remarks | Missing teeth / remarks |
| Box 38 | CLM05 | Place of treatment |
| Box 49 | NM1 (2010AA) | Billing NPI |
| Box 54 | NM1 (2310B) | Rendering NPI |

## 3. Claim Lifecycle — Submission → Adjudication → Payment/Denial → Appeal

### End-to-End Flow

```
┌─────────────┐    ┌──────────────┐    ┌──────────────┐    ┌─────────────┐
│  1. CAPTURE  │───▶│ 2. SUBMIT    │───▶│ 3. ADJUDICATE│───▶│ 4. PAYMENT  │
│  (Encounter) │    │  (837D EDI)  │    │  (Payer)     │    │  (835 ERA)  │
└─────────────┘    └──────────────┘    └──────────────┘    └─────────────┘
                         │                    │                    │
                         ▼                    ▼                    ▼
                   ┌──────────┐        ┌──────────────┐    ┌─────────────┐
                   │ 277CA    │        │ 277 Status   │    │ Post to PMS │
                   │ Ack/Reject│       │ Response     │    │ Ledger      │
                   └──────────┘        └──────────────┘    └─────────────┘
```

### Phase 1: Encounter Capture

**What happens**: Patient receives dental services. The practice records:
- Patient demographics and insurance information
- Procedures performed (CDT codes, teeth, surfaces)
- Rendering provider
- Diagnosis (if applicable)
- Fees charged (from the practice's fee schedule)

**System implication**: The encounter model should capture all data needed to generate an 837D. This is the "claim creation" step in the PMS — a claim record is created with status "Ready to Submit" or "Pending."

**Timing**: Most dental practices batch-submit claims at end of day or next business day. Some submit in real-time after each patient visit.

### Phase 2: Claim Submission (837D)

**What happens**: The 837D EDI transaction is generated and transmitted to the payer (or clearinghouse that routes to the payer).

**Transmission path**:
```
Practice/Platform → Clearinghouse → Payer
                    (e.g., Stedi,    (e.g., Delta Dental,
                     Availity,        MetLife, Cigna,
                     Tesia)           BCBS, Aetna, Guardian)
```

**Key responses received**:

1. **999 — Implementation Acknowledgment** (within minutes)
   - Confirms the EDI file was received and is syntactically valid
   - Rejects if the file structure is broken (bad segments, missing required elements)
   - Does NOT mean the claim is accepted — only that the file was parseable

2. **277CA — Claim Acknowledgment** (minutes to hours)
   - Payer-level acknowledgment that each individual claim was received
   - Reports acceptance or rejection at the claim level
   - Rejection reasons here are typically data-quality issues: invalid member ID, invalid NPI, invalid CDT code
   - Status codes: A1 (Accepted), A2 (Accepted with errors), A3-A8 (Rejected with specific reasons)

3. **TA1 — Interchange Acknowledgment** (optional, some payers)
   - Confirms ISA/IEA envelope was valid

**Claim status after submission**: "Submitted" or "Pending" in PMS.

### Phase 3: Adjudication

**What happens**: The payer processes the claim through their adjudication engine. This involves:

1. **Eligibility verification**: Is the patient covered on the date of service?
2. **Benefit check**: Is the procedure covered under the plan?
3. **Frequency limitations**: Has this procedure been done too recently? (e.g., prophylaxis every 6 months, bitewings every 12 months, crowns every 5–10 years)
4. **Maximum benefit check**: Has the patient's annual maximum been reached? (Most dental plans have annual maximums of $1,000–$2,500, per [NADP 2023 Dental Benefits Report](https://www.nadp.org/))
5. **Waiting period check**: Is the patient past any waiting period for this procedure category?
6. **Fee schedule application**: The payer applies their contracted fee schedule (usually a UCR — Usual, Customary, and Reasonable — schedule or a negotiated PPO fee)
7. **Deductible application**: Has the patient met their annual deductible? (typically $25–$100 per person)
8. **Coinsurance calculation**: Apply the plan's coinsurance rate (e.g., 100% preventive, 80% basic, 50% major)
9. **Coordination of Benefits**: If secondary coverage exists, determine primary/secondary responsibility

**Adjudication timeline**:
- Electronic claims: Typically 14–30 days for dental payers, though some process in as few as 5–7 business days
- Paper claims: 30–45 days
- HIPAA requires payers to adjudicate "clean claims" within 30 days (electronic) or 45 days (paper), though state prompt-pay laws may impose shorter timelines

**Possible outcomes**:
- **Paid** — claim is approved and payment is issued
- **Partially paid** — some lines paid, some denied; or paid at reduced amount
- **Denied** — entire claim denied (no payment)
- **Pended/Suspended** — payer needs more information (attachments, narratives, coordination of benefits info)

### Phase 4: Remittance and Payment (835 ERA)

**What happens**: The payer issues:

1. **835 ERA (Electronic Remittance Advice)**: The electronic explanation of payment/denial. Contains:
   - **CLP segment**: Claim-level payment info (claim ID, status, total paid, patient responsibility)
   - **SVC segment**: Service-line-level detail (which procedures were paid, at what amount)
   - **CAS segment**: Claim Adjustment Segment — explains every dollar of difference between billed amount and paid amount using **CARC (Claim Adjustment Reason Codes)** and **RARC (Remittance Advice Remark Codes)**
   - **PLB segment**: Provider-level adjustments (recoupments, interest, etc.)

2. **Payment**: Either via:
   - **EFT (Electronic Funds Transfer)** — direct deposit to provider's bank account, mapped via CCD+ or CTX banking format
   - **Virtual credit card** — increasingly common, practice must process through card terminal
   - **Paper check** — mailed with an EOB (Explanation of Benefits)

**CAS Segment — Adjustment Groups**:
| Group Code | Meaning | Example |
|-----------|---------|---------|
| **CO** | Contractual Obligation | Provider write-off per contract (can't bill patient) |
| **PR** | Patient Responsibility | Deductible, coinsurance, amount over maximum |
| **OA** | Other Adjustment | COB adjustment, pre-payment review |
| **PI** | Payer Initiated | Payer-specific reduction |
| **CR** | Correction/Reversal | Reversal of prior payment |

**Key CARCs in dental**:
- CARC 1: Deductible amount
- CARC 2: Coinsurance amount
- CARC 3: Co-pay amount
- CARC 45: Charges exceed fee schedule/maximum allowable
- CARC 50: Non-covered service (not a plan benefit)
- CARC 96: Non-covered charge (different from 50 — used for specific exclusions)
- CARC 29: Timely filing limit exceeded
- CARC 197: Precertification/authorization not obtained

### Phase 5: Patient Billing

After ERA posting, any remaining patient responsibility is billed to the patient:
- **Deductible**: Patient owes their unmet deductible amount
- **Coinsurance**: Patient's share (e.g., 20% of basic, 50% of major)
- **Non-covered services**: Full amount if procedure not covered
- **Amount over annual maximum**: If plan maxed out, patient owes the excess
- **Amount over UCR**: If provider is out-of-network and charges exceed UCR

### Phase 6: Appeal (if denied or underpaid)

**What happens**: If a claim is denied or underpaid, the practice can file an appeal.

**Appeal mechanisms**:
1. **Corrected claim**: Resubmit the 837D with corrected data (CLM05-3 frequency code = "7" for replacement claim). Used when the original had data errors.
2. **Written appeal**: Submit documentation supporting medical necessity (narratives, X-rays, perio charts, clinical photos). Some payers accept electronic attachments, others require portal upload or fax.
3. **Peer-to-peer review**: Dentist calls payer's dental director to discuss clinical necessity.

**Appeal timelines**: Most payers allow 60–180 days from the date on the EOB to file an appeal. Some state laws extend this.

**Secondary claim filing**: After the primary payer adjudicates, secondary claims can be filed (see Section 6).

### 277 — Claim Status Request/Response

Between submission and payment, the practice can check claim status:
- **276**: Claim Status Request (outbound from practice)
- **277**: Claim Status Response (inbound from payer)

Status categories:
- **A0–A8**: Acknowledgment/acceptance statuses
- **P0–P4**: Pending statuses (under review, waiting for info)
- **F0–F4**: Finalized statuses (paid, denied, adjusted)
- **R0–R16**: Request for additional information

**For the platform**: Automating 276/277 polling gives real-time claim status without waiting for the 835. Stedi supports this. Consider polling every 24–48 hours for outstanding claims.

## 4. Common Rejection & Denial Reasons (Top 10–15 with Root Causes)

It is important to distinguish **rejections** from **denials**:
- **Rejection**: The claim never entered adjudication. It was bounced back at the clearinghouse or payer front-end due to data/formatting errors. Rejections can be corrected and resubmitted without appeal.
- **Denial**: The claim was adjudicated and the payer determined it should not be paid (in whole or part). Denials require appeal or corrected claim resubmission.

According to the [ADA Health Policy Institute](https://www.ada.org/resources/research/health-policy-institute), dental claim denial rates range from 5–10% on average, though rates vary significantly by payer and procedure type. Complex restorative and prosthodontic procedures see denial rates of 15–25%.

### Top Rejections (Pre-Adjudication)

| # | Rejection Reason | Root Cause | Prevention Strategy |
|---|-----------------|------------|-------------------|
| 1 | **Invalid/missing subscriber ID** | Typo in member ID, wrong ID used, ID not active on date of service | Verify eligibility (270/271) before submission; validate member ID format per payer |
| 2 | **Invalid/missing NPI** | Wrong NPI, billing vs. rendering NPI mismatch, NPI not credentialed with payer | Maintain provider directory; verify NPI enrollment with each payer |
| 3 | **Invalid CDT code** | Using deleted/outdated code, code not effective on date of service, typo | Annual CDT code table refresh; validate code against date of service |
| 4 | **Missing/invalid tooth number or surface** | Restorative code submitted without surfaces, invalid tooth # (e.g., tooth 33), surface submitted for procedure that doesn't take surfaces | Build code-to-validation rules: which codes require tooth, which require surfaces |
| 5 | **Duplicate claim** | Same provider, same patient, same date, same procedure submitted twice | Deduplicate before submission; track claim IDs to prevent re-sends |
| 6 | **Invalid payer ID** | Wrong payer ID for the specific plan/network, using general payer ID instead of plan-specific | Maintain payer ID directory; some payers have different IDs for PPO vs. HMO vs. Medicaid |

### Top Denials (Post-Adjudication)

| # | Denial Reason (CARC) | Root Cause | Prevention Strategy |
|---|---------------------|------------|-------------------|
| 7 | **Frequency limitation exceeded (CARC 119)** | Prophylaxis, bitewings, exams, fluoride treatments submitted too frequently per plan rules. E.g., prophy every 6 months but submitted at 5 months | Check benefit frequency rules via 270/271 eligibility response; track prior service dates per patient |
| 8 | **Annual maximum exceeded (CARC 119 + RARC N362)** | Plan's annual benefit cap ($1,000–$2,500 typical) has been reached | Track estimated remaining benefits; alert staff when patient is nearing maximum |
| 9 | **Missing pre-authorization/predetermination (CARC 197)** | Procedures over a threshold (e.g., crowns, bridges, implants, orthodontics) require prior authorization that wasn't obtained | Maintain payer-specific preauth requirements matrix; auto-flag procedures that commonly need preauth |
| 10 | **Not a covered benefit (CARC 50/96)** | Procedure is excluded from the plan (e.g., implants, cosmetic procedures, adult orthodontics) | Check plan benefits during eligibility verification; flag excluded procedures before scheduling |
| 11 | **Waiting period not met (CARC 26/27)** | Patient is within the plan's waiting period for a procedure category (e.g., 12-month wait for major services on new plans) | Track patient enrollment date; check waiting periods from benefit information |
| 12 | **Timely filing exceeded (CARC 29)** | Claim submitted after the payer's filing deadline. Typically 90 days–1 year from date of service, varies by payer and state law | Submit claims promptly; set internal deadlines well before payer limits; flag aging unbilled encounters |
| 13 | **Patient not eligible on date of service (CARC 27)** | Patient's coverage had terminated or hadn't started on the service date | Run real-time eligibility (270/271) on day of service, not just at scheduling |
| 14 | **Bundling/inclusive procedure (CARC 97)** | A submitted procedure is considered part of another procedure on the same claim (e.g., X-ray included with root canal, anesthesia included with extraction) | Maintain bundling rules per payer; auto-flag likely bundled combinations |
| 15 | **Documentation/attachment required (CARC 16/252)** | Payer requires X-rays, narratives, perio charts, or clinical photos to support the procedure, and they weren't submitted with the claim | Identify payer attachment requirements; submit attachments proactively with initial claim (see Section 5) |

### Denial Prevention — Data-Driven Approach

A well-built system can prevent 60–80% of denials by:

1. **Pre-submission eligibility verification**: Run 270/271 before every encounter. The response (271) contains benefit details including:
   - Coverage status (active/inactive)
   - Annual maximum and remaining balance
   - Deductible status
   - Frequency limitations (e.g., last prophylaxis date)
   - Waiting period information

2. **Payer-specific rule engine**: Maintain a rules table per payer covering:
   - Preauthorization requirements by CDT code
   - Frequency limitations by CDT code
   - Age restrictions by CDT code
   - Bundling rules
   - Attachment requirements
   - Filing deadlines

3. **Pre-submission claim scrubbing**: Before generating the 837D, validate:
   - All required fields are populated
   - CDT codes are valid for the date of service
   - Tooth/surface data is appropriate for the procedure category
   - No duplicate claims exist
   - Provider NPIs are valid and credentialed

4. **Automated tracking**: Monitor the 277CA/277 responses and 835 ERAs to:
   - Auto-identify denials that can be corrected and resubmitted
   - Track denial patterns by payer, CDT code, and reason code
   - Alert staff to aging claims approaching filing deadlines

## 5. Attachments, Pre-Authorization, and Predetermination Workflows

### Dental Claim Attachments

Dental claims have a much higher attachment rate than medical claims. According to the [ADA](https://www.ada.org/resources/practice/dental-claim-attachments), approximately 30–35% of dental claims require some form of supporting documentation.

#### Types of Attachments

| Attachment Type | Common Use Cases | Format |
|----------------|-----------------|--------|
| **Periapical X-rays** | Root canals (D3000s), extractions (D7000s), implants (D6000s) | DICOM, JPEG, PNG, PDF |
| **Bitewing X-rays** | Restorative procedures when supporting evidence needed | DICOM, JPEG |
| **Panoramic X-ray (panorex)** | Impacted teeth, orthodontics, full-mouth treatments | DICOM, JPEG |
| **Full-mouth X-ray series** | Comprehensive treatment plans, perio justification | DICOM, JPEG |
| **Periodontal charting** | SRP (D4341/D4342), perio maintenance (D4910), osseous surgery (D4260/D4261) | PDF, structured data |
| **Intraoral photographs** | Crown buildup justification, cosmetic necessity, pre/post documentation | JPEG, PNG |
| **Narrative / clinical notes** | Medical necessity explanations, treatment rationale, supporting documentation | Free text (NTE segment) or PDF |
| **Diagnostic models** | Orthodontic treatment plans, prosthodontic cases | Physical or 3D digital scans |
| **EOB from primary payer** | Secondary claim submissions (COB) | PDF, 835 data |

#### Electronic Attachment Standards

The dental industry has been moving toward electronic attachments, with multiple mechanisms:

**1. NEA FastAttach / DentalXChange**
- The most widely used dental attachment platform, now part of [Vyne Dental (formerly NEA)](https://vfrm.com/)
- Attachments are uploaded to NEA's server and referenced by a unique attachment control number
- The 837D claim includes a **PWK segment** (Paperwork) pointing to the attachment:
  - PWK01: Report type code (e.g., DG = Diagnostic Report, OB = Operative Note, RB = Radiology Films)
  - PWK02: Report transmission code (EL = Electronic, BM = By Mail, FX = By Fax)
  - PWK06: Attachment control number (links to the uploaded attachment)

**2. HIPAA Attachment Standard (275 Transaction)**
- HIPAA mandated an electronic attachment standard (the 275 transaction), but implementation has been repeatedly delayed
- The [CMS final rule on electronic attachments](https://www.cms.gov/newsroom/fact-sheets/adoption-standard-health-care-attachments-transactions-and-operating-rules) was published in January 2024, mandating the HL7 C-CDA standard for clinical attachments
- Full enforcement is expected by 2026–2027, with a transition period
- Until then, the PWK segment + external attachment repository (NEA, etc.) remains the practical approach

**3. Payer Portal Upload**
- Many payers accept attachments via their web portals (especially for appeals)
- This is where the **RPA engine** is valuable — automate the portal-based attachment upload process
- Common portals: Delta Dental, MetLife, Cigna, Guardian, BCBS variants

**4. Fax (Legacy)**
- Some payers and some claim situations still require fax
- The fax must reference the claim number and patient information
- Consider an e-fax integration for practices still dealing with fax-based payers

#### Attachment Workflow for the Platform

```
1. Encounter captured → system checks: "Does this CDT code + payer combination require an attachment?"
2. If yes → prompt for attachment upload (X-ray, narrative, perio chart)
3. Attachment uploaded → sent to NEA/attachment repository → control number returned
4. 837D generated with PWK segment referencing the attachment control number
5. Claim + attachment submitted together
```

**Key consideration**: Proactively submitting attachments with the initial claim can reduce denial rates by 15–20% for attachment-dependent procedures, because it avoids the "pended for documentation" cycle that adds 30–60 days to payment.

### Pre-Authorization (Prior Authorization)

Pre-authorization is a **prospective** approval by the payer before the service is performed. The payer agrees to cover the procedure (subject to eligibility at time of service).

#### Procedures Commonly Requiring Pre-Authorization

| CDT Code Range | Procedure Category | Preauth Required? |
|---------------|-------------------|-------------------|
| D2740–D2799 | Crowns | Often (varies by payer; Delta Dental almost always) |
| D3310–D3330 | Root canals | Sometimes (molar root canals more often than anterior) |
| D4240–D4249 | Gingival flap procedures | Often |
| D4260–D4261 | Osseous surgery | Almost always |
| D5000–D5899 | Dentures (complete & partial) | Almost always |
| D6000–D6199 | Implants | Almost always (many plans exclude implants entirely) |
| D6200–D6999 | Fixed bridges | Almost always |
| D7210–D7250 | Surgical extractions / impactions | Sometimes |
| D8000–D8999 | Orthodontics | Always |
| D9940 | Occlusal guards | Often |

#### Pre-Authorization Flow

```
1. Dentist determines treatment plan
2. Practice submits pre-authorization request:
   - Via 837D with CLM05-3 (claim frequency code) = "1" and
     special transaction type in BHT06 = "18" (Request)
   - Or via payer portal (common for dental)
   - Or via phone/fax (legacy)
3. Payer reviews request (may request attachments — X-rays, narratives)
4. Payer responds with:
   - APPROVED: Authorization number issued (REF segment, qualifier G1)
   - MODIFIED: Approved for a different (typically lesser) procedure
   - DENIED: Procedure not authorized (with reason)
5. Authorization number is included on the actual claim when service is performed
   (REF segment with qualifier G1 in Loop 2300)
```

**Timing**: Pre-authorizations typically take 7–14 business days. Many dental payers process them within 5 business days for electronic submissions.

**Important caveat**: Pre-authorization is NOT a guarantee of payment. The payer can still deny at adjudication if:
- The patient wasn't eligible on the date of service
- The procedure performed differs from what was authorized
- The authorization expired (typically valid 60–90 days)

### Predetermination (Pre-Treatment Estimate)

A predetermination is a **non-binding estimate** of benefits — the payer tells the practice how much they would pay for a proposed treatment plan.

#### Predetermination vs. Pre-Authorization

| Aspect | Pre-Authorization | Predetermination |
|--------|------------------|-----------------|
| **Binding?** | Yes (with caveats) | No — advisory only |
| **Required?** | Often required for major procedures | Rarely required; practice-initiated |
| **Purpose** | Payer approves the treatment | Estimate for patient cost transparency |
| **837D indicator** | BHT06 = "18" (Request), CLM frequency = "1" | BHT06 = "13" (Request for Predetermination) |
| **Response** | Authorization number | Estimated benefit amounts per procedure |

#### When to Use Predeterminations

Predeterminations are valuable for:
- **Large treatment plans** (multiple crowns, bridge work, implant cases) where patient cost exposure is significant
- **Patient education**: Showing the patient their estimated out-of-pocket before committing to treatment
- **Out-of-network situations**: Understanding the payer's UCR fee schedule
- **Dual coverage**: Getting both primary and secondary estimates

#### Predetermination Flow

```
1. Treatment plan created in PMS
2. 837D generated as predetermination (BHT06 = "13")
3. Submitted to payer
4. Payer returns predetermination response (835-like response or proprietary format)
5. Practice reviews estimated benefits and communicates patient cost
6. Patient accepts treatment → services performed → actual claim submitted
7. Actual claim references predetermination number (if available)
```

**Platform implication**: Supporting predeterminations in the workflow adds significant value for practices. The estimated amounts from predeterminations should be stored and presented to the practice as "expected insurance payment" — but flagged as non-binding estimates.

## 6. Coordination of Benefits (COB) and Secondary Claims in Dental

### Overview

Coordination of Benefits applies when a patient has dental coverage under more than one plan. This is common in dental — approximately 10–15% of dental patients have dual coverage, often through:
- **Spouse's plan + own employer plan**
- **Two working parents** covering a child on both plans
- **Retiree plan + Medicare** (for patients 65+ with dental benefits)

COB rules determine which plan pays first (primary) and which pays second (secondary), and how much each pays.

### Determining Primary vs. Secondary (Order of Benefit Determination)

The [NAIC (National Association of Insurance Commissioners)](https://content.naic.org/cipr-topics/coordination-benefits) model rules establish the order:

1. **Subscriber vs. Dependent**: The plan where the patient is the subscriber (employee) is primary. The plan where the patient is a dependent is secondary.

2. **Birthday Rule** (for dependent children): When a child is covered under both parents' plans, the parent whose birthday falls **earlier in the calendar year** (month/day, not year of birth) has the primary plan. This is the most common rule in dental.

3. **Gender Rule** (legacy, rare): Some older plans make the father's plan primary for children. This has largely been replaced by the Birthday Rule but still exists in a few plans.

4. **Active vs. COBRA/Retiree**: Active employee coverage is primary over COBRA or retiree coverage.

5. **Longer-covered rule**: If none of the above apply, the plan that has covered the patient longer is primary.

### How Secondary Payment Works

There are three common COB payment methodologies:

#### Method 1: Traditional / Non-Duplication of Benefits (most common in dental)

The secondary payer pays the **lesser of**:
- What it would have paid as primary
- The remaining balance after the primary paid

**Example**: Crown billed at $1,200
| Step | Amount |
|------|--------|
| Billed amount | $1,200 |
| Primary allowed amount | $900 |
| Primary pays (50% major) | $450 |
| Primary patient responsibility | $450 |
| Secondary allowed amount | $850 |
| Secondary would pay as primary (50% of $850) | $425 |
| Secondary pays lesser of [$425] and [$450 remaining] | $425 |
| **Patient owes** | **$25** |

#### Method 2: Maintenance of Benefits (MOB)

The secondary pays up to its allowed amount minus what the primary paid. The total of both payments cannot exceed the secondary's allowed amount.

**Example**: Same crown at $1,200
| Step | Amount |
|------|--------|
| Primary pays | $450 |
| Secondary allowed amount | $850 |
| Secondary pays: $850 - $450 | $400 |
| **Patient owes** | **$350** ($1,200 - $450 - $400) |

#### Method 3: Standard COB (supplemental)

The secondary pays whatever the primary didn't cover, up to 100% of the secondary's allowed amount. This is the most generous method.

**Example**: Same crown at $1,200
| Step | Amount |
|------|--------|
| Primary pays | $450 |
| Secondary allowed: $850; remaining balance: $750 | |
| Secondary pays lesser of [$850] and [$750 remaining] | $750 |
| **Provider receives** total: $1,200 | **Patient owes $0** |

### 837D COB Data Requirements

When submitting a secondary claim, the 837D must include information about the primary payer's adjudication:

**Loop 2320 — Other Subscriber Information**:
- SBR segment: Other subscriber's payer info, COB sequence (primary indicator)
- OI segment: Other insurance coverage information
- CAS segment: Primary payer's adjustments (from the primary 835)
- AMT segment: Primary payer's paid amount
- DMG segment: Other subscriber's demographics

**Loop 2330A-G — Other Payer Information**:
- NM1: Primary payer name
- REF: Primary payer's claim control number (from 835 CLP segment)
- DTP: Primary payer's adjudication date

**Key fields to include from the primary ERA (835)**:
- Primary payer's allowed amount
- Primary payer's paid amount
- Primary payer's adjustment reason codes and amounts
- Primary payer's claim control number
- Adjudication date

### Secondary Claim Submission Workflow

```
1. Primary claim submitted (837D) and adjudicated
2. Primary ERA (835) received and posted to PMS ledger.
3. System automatically generates secondary claim:
   a. Same service lines as primary claim
   b. Add Loop 2320/2330 with primary payer adjudication data
   c. Include primary payer's paid amount, allowed amount, and adjustments
4. Secondary claim submitted (837D) to secondary payer
5. Secondary ERA (835) received and posted
6. Remaining patient balance calculated and billed to patient
```

### Automation Opportunities

For the platform, COB automation is a significant value-add:

1. **Auto-detect dual coverage**: During eligibility (270/271), both primary and secondary coverage can be identified. Flag encounters with COB.

2. **Auto-generate secondary claims**: When primary ERA (835) is received:
   - Parse primary payment/adjustment data
   - Map CLP/CAS/SVC segments into Loop 2320/2330
   - Generate secondary 837D automatically
   - Submit without manual intervention

3. **Track COB lifecycle**: Maintain state machine for COB claims:
   ```
   Primary Submitted → Primary Adjudicated → Secondary Generated →
   Secondary Submitted → Secondary Adjudicated → Patient Billed
   ```

4. **Handle COB denials**: Common secondary denial: "COB information missing or incomplete." Ensure all required Loop 2320 data is populated from the primary 835.

### Special COB Scenarios in Dental

**1. Orthodontic COB**: Orthodontic treatment (D8000s) spans years and involves monthly payments. Each monthly claim goes through primary then secondary. Track the ongoing authorization and remaining benefits on both plans.

**2. Child aging out**: Dependents age out of parents' plans (typically at 26 under ACA, but dental plans may have different age limits). When a child ages out of one plan, the COB situation changes.

**3. Divorced parents**: Court orders may specify which parent's plan is primary for the child. The "birthday rule" may not apply if there's a Qualified Medical Child Support Order (QMCSO).

**4. Medicare + dental**: Medicare generally does not cover dental, but some Medicare Advantage plans include dental benefits. When a patient has Medicare Advantage dental + a retiree dental plan, COB rules between the two can be complex.

## 7. PMS Ledger Entries — Charges, Payments, Adjustments, Write-Offs and Claim Lifecycle Mapping

### Overview

The PMS (Practice Management System) ledger is the financial source of truth for the dental practice. Every claim event in the lifecycle must map to a ledger entry to keep the practice's A/R (accounts receivable) accurate. If claim events don't sync to the PMS ledger, the practice's books go out of balance — the most common complaint practices have about billing platforms.

The platform's PMS integration layer is abstracted, but the **business logic** of what entries to create (and when) is universal across PMS systems (Dentrix, Eaglesoft, Open Dental, Curve, etc.).

### Ledger Entry Types

| Entry Type | Debit/Credit | Effect on A/R | Typical Source |
|-----------|-------------|--------------|----------------|
| **Charge** | Debit (increases A/R) | +A/R | Encounter/procedure completion |
| **Insurance Payment** | Credit (decreases A/R) | -A/R | ERA (835) posting |
| **Patient Payment** | Credit (decreases A/R) | -A/R | Patient payment at checkout or later |
| **Contractual Adjustment (Write-Off)** | Credit (decreases A/R) | -A/R | ERA (835) — CO adjustment group |
| **Insurance Adjustment** | Credit or Debit | ±A/R | ERA (835) — various adjustment groups |
| **Patient Adjustment** | Credit (decreases A/R) | -A/R | Manual write-off, courtesy discount |
| **Refund** | Debit (increases A/R or cash outflow) | +A/R or -Cash | Overpayment refund to patient or insurance |
| **Transfer** | Net zero | Moves between buckets | Transfer from insurance balance to patient balance |

### Claim Lifecycle → Ledger Entry Mapping

Below is the complete mapping of each claim lifecycle event to the PMS ledger entries it should trigger:

---

#### Event 1: Encounter / Procedure Completion

**Trigger**: Dentist completes procedures and the encounter is finalized in the system.

**Ledger entries created**:

| Entry | Amount | Category | Notes |
|-------|--------|----------|-------|
| **Charge — procedure 1** | Practice fee schedule amount (e.g., $180 for D0210) | Charge | One charge line per CDT code |
| **Charge — procedure 2** | Practice fee schedule amount (e.g., $95 for D1110) | Charge | |
| ... | ... | ... | One line per procedure |

**A/R impact**: A/R increases by total charges. The charges are allocated to the **insurance portion** (estimated) and **patient portion** (estimated copay/coinsurance, if known from eligibility check).

**PMS state**: Claim status = "Ready to Submit" or "Pending"

**Key business rule**: Charges should be posted at the **practice's full fee schedule rate**, NOT the insurance contracted rate. The difference between practice fee and insurance allowed amount is handled later as a contractual adjustment. This is important for practice reporting and UCR compliance.

---

#### Event 2: Claim Submission (837D Sent)

**Trigger**: 837D is transmitted to the clearinghouse/payer.

**Ledger entries created**: **None** — no financial entries. Only a status update.

**PMS state**: Claim status = "Submitted." The claim now has a submission date, control number, and payer reference.

**Key business rule**: No A/R change at submission. The charges from Event 1 remain outstanding.

---

#### Event 3: Claim Acknowledgment (277CA Received)

**Trigger**: Clearinghouse/payer acknowledges receipt.

**Ledger entries created**: **None** — status update only.

**PMS state**:
- If accepted (A1/A2): Claim status = "Accepted / In Process"
- If rejected (A3–A8): Claim status = "Rejected" — needs correction and resubmission

**Key business rule for rejections**: A rejected claim should NOT trigger charge reversal. The charges remain on the ledger. The claim is corrected and resubmitted. If the claim cannot be resubmitted (e.g., timely filing expired), then a manual write-off (see Event 8) is needed.

---

#### Event 4: ERA Received — Full Payment (835)

**Trigger**: The payer adjudicates and pays the claim in full (all lines paid at expected amounts).

**Ledger entries created** (one set per service line from SVC segment):

| Entry | Amount | Category | Source (835 segment) |
|-------|--------|----------|---------------------|
| **Insurance Payment** | Payer's paid amount per line | Payment | SVC03 (paid amount) |
| **Contractual Adjustment (Write-Off)** | Difference between charge and allowed amount | Adjustment — CO | CAS segment, Group CO, CARC 45 |
| **Patient Responsibility — Deductible** | Deductible portion (if any) | Transfer to Patient Balance | CAS segment, Group PR, CARC 1 |
| **Patient Responsibility — Coinsurance** | Coinsurance portion | Transfer to Patient Balance | CAS segment, Group PR, CARC 2 |
| **Patient Responsibility — Copay** | Copay amount (if any) | Transfer to Patient Balance | CAS segment, Group PR, CARC 3 |

**Example**: D2740 (Crown) billed at $1,200

| Entry | Amount | Running A/R |
|-------|--------|------------|
| Original charge | +$1,200 | $1,200 |
| Insurance payment | -$600 | $600 |
| Contractual write-off (CO-45) | -$300 | $300 |
| Patient coinsurance (PR-2) | $0 (transfer) | $300 (now patient balance) |

After posting: Insurance A/R = $0, Patient A/R = $300 (patient's 50% coinsurance on the $600 allowed amount... wait, let's recalculate):

Corrected example:
- Billed: $1,200
- Payer allowed: $900 (contracted rate)
- Contractual write-off: $1,200 - $900 = $300 (CO-45)
- Payer pays 50% of allowed: $450 (major restorative at 50%)
- Patient coinsurance: $450 (PR-2)

| Entry | Amount | Insurance A/R | Patient A/R |
|-------|--------|--------------|-------------|
| Charge | +$1,200 | $1,200 | $0 |
| Insurance payment | -$450 | $750 | $0 |
| Contractual write-off | -$300 | $450 | $0 |
| Transfer to patient (coinsurance) | -$450 ins / +$450 pt | $0 | $450 |

**PMS state**: Claim status = "Paid" or "Closed." Patient statement generated for $450.

---

#### Event 5: ERA Received — Partial Payment / Partial Denial

**Trigger**: Some lines paid, some denied, or lines paid at reduced amounts.

**Ledger entries created**: Same structure as Event 4, but with additional entries for denied lines:

For **paid lines**: Same as Event 4 (payment + write-off + patient responsibility).

For **denied lines**:

| Entry | Amount | Category | Source |
|-------|--------|----------|--------|
| **Denial Adjustment** | Full charge amount | Adjustment — CO or OA | CAS segment with denial CARC (e.g., 50, 96, 119) |
| **OR: Transfer to Patient** | Full charge amount | Transfer | If the denial means the patient is responsible (non-covered service) |

**Key business rule**: The decision of whether a denial becomes a write-off or transfers to patient balance depends on the denial reason and the practice's policy:
- **CO (Contractual Obligation) denial**: Provider cannot bill the patient (contractual write-off)
- **PR (Patient Responsibility) denial**: Patient is responsible (transfer to patient balance)
- **OA (Other Adjustment) denial**: Varies — may require manual review

**PMS state**: Claim status = "Partially Paid" or "Denied Lines — Review Required"

---

#### Event 6: ERA Received — Full Denial

**Trigger**: Entire claim denied.

**Ledger entries created**:

| Scenario | Entry | Amount |
|----------|-------|--------|
| **Appealable denial** | No financial entry yet — claim flagged for appeal | $0 change |
| **Non-appealable, contractual (CO)** | Contractual write-off per line | Full charge per line |
| **Non-appealable, patient responsible (PR)** | Transfer to patient balance per line | Full charge per line |

**Key business rule**: Do NOT auto-write-off denials. The system should flag denials for review by billing staff. Many denials are correctable or appealable. Auto-posting denial write-offs loses revenue.

**Recommended workflow**:
```
Denial received → Auto-categorize by CARC code →
  If correctable (data error): Queue for correction and resubmission
  If appealable (clinical necessity): Queue for appeal with attachment workflow
  If final (non-covered, filing limit): Post write-off or transfer to patient
```

**PMS state**: Claim status = "Denied — Pending Review"

---

#### Event 7: Secondary ERA Received (COB)

**Trigger**: Secondary payer adjudicates and pays.

**Ledger entries created**: Same structure as Event 4, but applied to the **remaining insurance balance** after primary payment.

| Entry | Amount | Category |
|-------|--------|----------|
| **Secondary insurance payment** | Secondary paid amount | Payment |
| **Secondary contractual write-off** | Secondary adjustment (CO) | Adjustment |
| **Remaining patient responsibility** | Whatever's left | Transfer to patient balance |

**Example** (continuing crown example):

After primary: Insurance A/R = $0, Patient A/R = $450

Secondary claim submitted for the $450 patient responsibility:
- Secondary allowed: $850, already paid by primary: $450
- Secondary pays (Method 1): min($425, $450) = $425

| Entry | Amount | Patient A/R |
|-------|--------|-------------|
| Starting patient balance | | $450 |
| Secondary payment | -$425 | $25 |
| **Patient owes** | | **$25** |

**PMS state**: Secondary claim = "Paid." Patient balance = $25.

---

#### Event 8: Write-Off (Manual or Automated)

**Trigger**: Practice decides to write off an amount — either from a denied claim, uncollectible patient balance, or courtesy adjustment.

**Ledger entries created**:

| Entry | Amount | Category | Use Case |
|-------|--------|----------|----------|
| **Contractual write-off** | Adjustment amount | Adjustment — Contractual | In-network fee schedule difference (auto from ERA) |
| **Denial write-off** | Full charge or partial | Adjustment — Denial | Non-appealable denial, final |
| **Bad debt write-off** | Outstanding patient balance | Adjustment — Bad Debt | Uncollectible patient balance (after collection efforts) |
| **Courtesy adjustment** | Discount amount | Adjustment — Courtesy | Staff discount, hardship, professional courtesy |
| **Small balance write-off** | Small remaining amount | Adjustment — Small Balance | E.g., practice writes off balances under $5 |

**Key business rule**: Write-off categories must be tracked separately for accounting and tax purposes. Contractual write-offs are different from bad debt write-offs in financial reporting.

---

#### Event 9: Refund

**Trigger**: Practice discovers an overpayment by insurance or patient.

**Ledger entries created**:

| Entry | Amount | Category | Use Case |
|-------|--------|----------|----------|
| **Insurance refund** | Refund amount (debit) | Refund | Payer overpaid; often recouped via PLB segment on a subsequent 835 |
| **Patient refund** | Refund amount (debit) | Refund | Patient overpaid (e.g., paid copay at time of service but insurance covered more than expected) |

**Insurance recoupment via PLB**: Payers often recoup overpayments by deducting from future payments. The PLB (Provider Level Balance) segment on a subsequent 835 shows:
- PLB03: Adjustment reason code (e.g., WO = Overpayment Recovery)
- PLB04: Amount being recouped
- This reduces the net payment on that 835 — the platform must handle this to avoid misposting

---

#### Event 10: Claim Correction / Replacement

**Trigger**: Original claim had errors; a corrected claim is submitted.

**Ledger entries**:

| Scenario | Entries |
|----------|---------|
| **Void original + resubmit** | Reverse original charge lines, re-post corrected charges, submit new 837D with frequency code "8" (void) followed by "1" (original) |
| **Replacement claim** | Submit 837D with frequency code "7" (replacement) referencing original claim. No ledger change until new ERA is received |

**Preferred approach**: Submit replacement claim (frequency code 7). Don't touch the ledger until the replacement ERA comes back. The new ERA will have the corrected payment, and the original ERA's entries get reversed and re-posted.

---

### Complete Lifecycle State Machine

```
ENCOUNTER_CREATED
  └──▶ Charges posted to PMS
       └──▶ CLAIM_READY

CLAIM_READY
  └──▶ 837D submitted
       └──▶ CLAIM_SUBMITTED

CLAIM_SUBMITTED
  ├──▶ 277CA: Accepted → CLAIM_ACCEPTED
  └──▶ 277CA: Rejected → CLAIM_REJECTED
       └──▶ Correct & resubmit → CLAIM_SUBMITTED

CLAIM_ACCEPTED
  ├──▶ 835: Paid (full) → CLAIM_PAID
  │    └──▶ Post payment + adjustments + patient balance
  │         └──▶ If COB: → SECONDARY_READY
  │              └──▶ Submit secondary 837D → SECONDARY_SUBMITTED
  │                   └──▶ Secondary 835 → SECONDARY_PAID
  │                        └──▶ Post secondary payment → CLAIM_CLOSED
  │
  ├──▶ 835: Partial pay → CLAIM_PARTIAL
  │    └──▶ Post paid lines, flag denied lines for review
  │         ├──▶ Appeal denied lines → APPEAL_SUBMITTED
  │         └──▶ Write off denied lines → CLAIM_CLOSED
  │
  ├──▶ 835: Full denial → CLAIM_DENIED
  │    ├──▶ Correctable → Resubmit → CLAIM_SUBMITTED
  │    ├──▶ Appealable → APPEAL_SUBMITTED
  │    └──▶ Final → Write off or transfer to patient → CLAIM_CLOSED
  │
  └──▶ 277: Pended/Suspended → CLAIM_PENDED
       └──▶ Submit requested info (attachment, COB data)
            └──▶ CLAIM_ACCEPTED (re-enters adjudication)

APPEAL_SUBMITTED
  ├──▶ Appeal approved → Post payment → CLAIM_PAID
  └──▶ Appeal denied → Write off or transfer → CLAIM_CLOSED

CLAIM_CLOSED
  └──▶ Patient balance remaining?
       ├──▶ Yes → Patient statement generated
       └──▶ No → Done
```

### Ledger Reconciliation Rules

For the platform to keep the PMS ledger in sync, these invariants must always hold:

1. **Charge = Payment + Adjustments + Outstanding Balance**
   - For every service line: `Charge Amount = Insurance Paid + Contractual Write-Off + Patient Paid + Patient Balance + Other Adjustments`

2. **Insurance A/R = Charges − Insurance Payments − Contractual Write-Offs − Transfers to Patient**
   - After ERA posting, insurance A/R for that claim should be $0

3. **Patient A/R = Patient Responsibility Amounts − Patient Payments − Patient Write-Offs**
   - After all insurance processing, whatever remains is patient responsibility

4. **Total Practice Revenue = Total Payments (insurance + patient) + Write-Offs + Outstanding A/R**
   - This should balance at all times

5. **PLB adjustments don't change individual claim balances** — they affect the aggregate payment for a remittance batch. Track PLB adjustments at the provider/payment level, not the claim level.

### PMS Integration Recommendations

1. **Post charges at encounter time** — don't wait for claim submission. The practice needs to see charges immediately.

2. **Auto-post ERAs** — parse 835 and create payment/adjustment entries automatically. Flag exceptions (unexpected denials, zero-pays, negative adjustments) for manual review.

3. **Maintain claim-to-ledger linkage** — every ledger entry should trace back to a claim event (ERA transaction, claim submission, etc.) for audit purposes.

4. **Support batch and individual posting** — ERAs often contain multiple claims in one remittance. The system should handle both batch posting and individual claim posting.

5. **Handle payment reversals gracefully** — if a payer reverses a payment (via PLB or separate adjustment ERA), the system must reverse the original posting and re-process.

6. **Patient statement generation** — after all insurance processing is complete, automatically generate patient statements for remaining balances. Include EOB-style detail showing what insurance paid and why the patient owes the remainder.

7. **Aging reports** — support standard A/R aging buckets (0–30, 31–60, 61–90, 91–120, 120+ days) split by insurance A/R and patient A/R. This is the #1 financial report practices use.
