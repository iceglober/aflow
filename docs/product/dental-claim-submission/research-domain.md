# Domain Research: Dental Claim Submission

Research date: 2026-04-01

Scope: After eligibility through payer acknowledgment. Excludes claim status tracking and ERA/payment posting.

---

## 1. 837D Transaction Structure

The 837D (ASC X12N 005010X224A2/A3) is the HIPAA-mandated electronic dental claim format.

### Envelope hierarchy

```
ISA  Interchange Control Header (sender/receiver IDs, control #, usage indicator P/T)
 GS  Functional Group Header (application sender/receiver, version 005010X224A2)
  ST  Transaction Set Header (transaction type = 837)
   BHT Beginning of Hierarchical Transaction (purpose, reference ID, creation date/time)
    ... loops ...
  SE  Transaction Set Trailer
 GE  Functional Group Trailer
IEA  Interchange Control Trailer
```

[VERIFIED via Stedi docs, UHC companion guide, Wisconsin Medicaid guide]

### Loop structure

| Loop | Name | Key Segments | Notes |
|------|------|-------------|-------|
| **1000A** | Submitter | NM1, PER | Entity submitting the file (clearinghouse or practice) |
| **1000B** | Receiver | NM1 | Payer receiving the file |
| **2000A** | Billing Provider HL | HL, PRV | Hierarchical level = 20 (billing) |
| **2010AA** | Billing Provider Name | NM1, N3, N4, REF | NPI (XX qualifier), Tax ID (EI/SY), address |
| **2010AB** | Pay-To Address | NM1, N3, N4 | Only if different from billing address |
| **2000B** | Subscriber HL | HL, SBR | Subscriber info, payer responsibility sequence |
| **2010BA** | Subscriber Name | NM1, N3, N4, DMG | Name, address, DOB, gender, member ID |
| **2010BB** | Payer Name | NM1, N3, N4, REF | Payer name and ID |
| **2000C** | Patient HL | HL, PAT | Only when patient != subscriber |
| **2010CA** | Patient Name | NM1, N3, N4, DMG | Patient demographics |
| **2300** | Claim | CLM, DTP, DN1, DN2, PWK, REF | Claim-level: amount, place of service, dates, attachments, prior auth |
| **2310A** | Referring Provider | NM1, REF | Referring dentist NPI |
| **2310B** | Rendering Provider | NM1, PRV, REF | If different from billing provider |
| **2310C** | Service Facility | NM1, N3, N4 | If different from billing provider location |
| **2320** | Other Subscriber (COB) | SBR, CAS, AMT, OI | Secondary/tertiary payer info, prior payment |
| **2330A** | Other Subscriber Name | NM1 | Other subscriber demographics |
| **2330B** | Other Payer Name | NM1, REF | Other payer ID |
| **2400** | Service Line | SV3, TOO, DTP, REF | Procedure code, tooth info, service date, line-level refs |

[VERIFIED via Stedi 837D API docs, CGS Medicare companion guide]

### Critical segments in Loop 2400 (Service Line)

| Segment | Element | Description |
|---------|---------|-------------|
| SV3-01 | Composite | CDT code (AD: prefix + D-code) |
| SV3-02 | Monetary | Line item charge amount |
| SV3-04 | Code | Oral cavity designation (area codes: 00-50) |
| TOO-01 | Code | Tooth code qualifier (JP = universal numbering) |
| TOO-02 | Code | Tooth number (1-32 permanent, A-T primary) |
| TOO-03 | Composite | Tooth surface codes (B, D, F, I, L, M, O) |
| DTP-03 | Date | Service date (CCYYMMDD) |

[VERIFIED via Stedi segment reference, Indiana Medicaid companion guide]

### Tooth surface codes

| Code | Surface |
|------|---------|
| B | Buccal |
| D | Distal |
| F | Facial (labial) |
| I | Incisal |
| L | Lingual |
| M | Mesial |
| O | Occlusal |

Multi-surface procedures concatenate codes: MOD = Mesial + Occlusal + Distal.

[VERIFIED via HL7 Terminology Authority, ADA Tooth Surface Codes]

---

## 2. CDT Code Categories and Required Claim Fields

### Category overview

| Range | Category | Tooth # | Surface | Oral Cavity Area | Typical Attachments |
|-------|----------|---------|---------|-------------------|---------------------|
| D0100-D0999 | Diagnostic | Varies | No | Varies | Rarely |
| D1000-D1999 | Preventive | Per-tooth codes only | No | No (most) | Rarely |
| D2000-D2999 | Restorative | Yes | Yes | No | X-rays for crowns |
| D3000-D3999 | Endodontics | Yes | No | No | Pre/post x-rays |
| D4000-D4999 | Periodontics | By quadrant or tooth | No | Yes (quadrant) | Perio charting, x-rays, narrative |
| D5000-D5899 | Prosthodontics removable | No (arch-based) | No | Yes (arch) | Sometimes |
| D5900-D5999 | Maxillofacial prosthetics | Varies | No | Varies | Often |
| D6000-D6199 | Implant services | Yes | No | No | X-rays, narrative |
| D6200-D6999 | Prosthodontics fixed | Yes (abutment/pontic) | No | No | X-rays |
| D7000-D7999 | Oral surgery | Yes (extractions) | No | Varies | X-rays, operative notes |
| D8000-D8999 | Orthodontics | No | No | No | Ceph/pan x-rays, photos |
| D9000-D9999 | Adjunctive general | Varies | No | Varies | Varies |

[UNVERIFIED -- synthesized from multiple payer guides and ADA references; ADA publishes an authoritative Appendix 3 table mapping every CDT code to tooth/surface/oral-cavity requirements. That PDF is behind ADA paywall.]

### High-volume codes and field requirements

| Code | Description | Tooth # | Surface | Quadrant | Notes |
|------|-------------|---------|---------|----------|-------|
| D0120 | Periodic oral exam | No | No | No | Frequency-limited |
| D0140 | Limited oral exam | No | No | No | Problem-focused |
| D0150 | Comprehensive oral exam | No | No | No | New patient |
| D0210 | FMX (full mouth x-rays) | No | No | No | 14-22 images |
| D0220 | Periapical first image | Yes | No | No | |
| D0230 | Periapical additional | Yes | No | No | |
| D0272 | Bitewings - two images | No | No | No | |
| D0274 | Bitewings - four images | No | No | No | |
| D0330 | Panoramic | No | No | No | |
| D1110 | Prophylaxis adult | No | No | No | Age-gated (14+ typically) |
| D1120 | Prophylaxis child | No | No | No | Under 14 |
| D1206 | Fluoride varnish | No | No | No | Age-limited |
| D1351 | Sealant | Yes | No | No | Per-tooth |
| D2140 | Amalgam - one surface | Yes | Yes | No | |
| D2150 | Amalgam - two surfaces | Yes | Yes | No | |
| D2330 | Resin composite - one surface, anterior | Yes | Yes | No | |
| D2391 | Resin composite - one surface, posterior | Yes | Yes | No | |
| D2750 | Crown - porcelain/ceramic | Yes | No | No | Attachment usually required |
| D2950 | Core buildup | Yes | No | No | Often bundled with crown |
| D3310 | Root canal - anterior | Yes | No | No | Pre/post x-rays |
| D3320 | Root canal - premolar | Yes | No | No | |
| D3330 | Root canal - molar | Yes | No | No | |
| D4341 | SRP - 4+ teeth/quadrant | No | No | Yes | Perio charting required |
| D4342 | SRP - 1-3 teeth/quadrant | No | No | Yes | |
| D4910 | Periodontal maintenance | No | No | No | Must follow active perio |
| D7140 | Extraction - erupted | Yes | No | No | |
| D7210 | Surgical extraction | Yes | No | No | X-ray, narrative |

[VERIFIED -- code descriptions from ADA CDT, field requirements from multiple payer companion guides]

### ICD-10 diagnosis codes on dental claims

ICD-10 codes are **required** when:
- Billing to medical plans (crossover claims)
- Medicare Part B dental services (KX modifier required since July 2025)
- Medical necessity justification for oral surgery

Common dental ICD-10 codes:

| Code | Description | Use case |
|------|-------------|----------|
| K02.x | Dental caries | Restorative procedures |
| K04.x | Diseases of pulp | Endodontic procedures |
| K05.x | Gingivitis/periodontitis | Periodontic procedures |
| K08.x | Other disorders of teeth | Extractions, missing teeth |
| M26.x | Dentofacial anomalies | Orthodontic/surgical |
| Z01.20 | Dental exam, no abnormal findings | Routine preventive |
| Z01.21 | Dental exam, abnormal findings | Preventive with findings |
| S02.x | Fracture of skull/facial bones | Trauma |

[VERIFIED via ADA, CMS KX modifier requirement confirmed effective July 2025]

---

## 3. Payer-Specific Routing and Quirks

### Delta Dental state routing

Delta Dental is a federation of ~39 independent companies. Each has its own payer ID.

| Entity | Payer ID | Notes |
|--------|----------|-------|
| DDIC (universal fallback) | 94276 | Works for most Delta plans but may delay routing |
| Delta Dental of CA | DDCA1 | Separate from DeltaCare |
| DeltaCare USA (DHMO) | DDCA3 | Different payer ID than PPO |
| Delta Dental of CO | 84056 | |
| Delta Dental of VA | 54084 | |
| Delta Dental of OR | CDOR1 | Alpha payer ID |
| Delta Dental of IL | Various | Separate IDs for PPO vs DeltaCare |
| Northeast Delta Dental | Various | Covers NH, ME, VT |

**Key quirk**: Using the generic 94276 payer ID works but can cause slower routing. Best practice is to use the state-specific payer ID. Delta provides a lookup tool at deltadental.com.

[VERIFIED via Delta Dental lookup tool, Patterson Support documentation]

### BCBS alpha prefix routing

BCBS uses a 3-character alpha or alphanumeric prefix at the start of member IDs to route claims to the correct BCBS plan (there are 36+ independent BCBS companies).

| Rule | Detail |
|------|--------|
| Prefix position | First 3 chars of member ID |
| Purpose | Identifies the "home plan" for BlueCard routing |
| R-prefix | Federal Employee Program (FEP) -- no 3-char prefix system, use FEP payer ID |
| No prefix on card | Check back of card for filing instructions |
| Lookup | Clearinghouse prefix-to-plan mapping tables or BCBS prefix lookup tools |

**Key quirk**: Must resolve prefix to correct BCBS plan payer ID before submission. Submitting to wrong BCBS entity = rejection or misrouted claim. Alpha-prefix tables change; clearinghouses typically maintain current mappings.

[VERIFIED via BCBS Texas BlueCard documentation, multiple RCM guides]

### Aetna

| Item | Detail |
|------|--------|
| Standard payer ID | 60054 |
| DMO encounters | 68246 |
| Medicare dental | 18014 |
| Duplicate detection | Rejects exact duplicates within 180 days |
| Attachment vendors | Change Healthcare, DentalXChange, NEA, Tesia |
| Secondary claims | EOB from primary not always required upfront; Aetna requests if needed |

[VERIFIED via Aetna dental electronic claims FAQ]

### UnitedHealthcare Dental

| Item | Detail |
|------|--------|
| Companion guide | Based on 005010X224A2 |
| Smart edits | Pre-adjudication edits that reject claims with data issues before payer processing |

[VERIFIED via UHC companion guide]

### General payer ID lookup

Stedi maintains a payer network directory. For each payer, the `tradingPartnerServiceId` maps to the correct payer ID. Clearinghouses (Stedi, Trizetto/Cognizant, Change Healthcare) each maintain their own payer ID mappings.

[VERIFIED via Stedi documentation]

---

## 4. Attachment Requirements

### When attachments are needed

| Procedure Category | Attachment Type | When Required |
|--------------------|----------------|---------------|
| Crowns (D2750 etc.) | Pre-op x-ray | Most payers for initial or replacement |
| Root canals (D3310-D3330) | Pre- and post-op x-rays | Most payers |
| SRP (D4341/D4342) | Perio charting (6-point), x-rays showing bone loss, narrative | Almost always |
| Surgical extractions (D7210+) | X-ray, operative narrative | Usually |
| Implants (D6000s) | X-rays, treatment narrative | Almost always |
| Orthodontics (D8000s) | Ceph x-ray, pan x-ray, photos | Initial placement |
| Any claim > threshold | Varies | Some payers auto-request for claims over dollar threshold |
| Preventive/diagnostic | None | Rarely needed |
| Basic restorative | Rarely | Anterior composites sometimes |

[VERIFIED via Aetna claim documentation guidelines reference, DentalClaimSupport]

### Attachment quality requirements

Payers reject attachments that are:
- Not diagnostic quality (blurry, dark, improperly exposed x-rays)
- Not properly labeled (missing patient name, date, tooth number)
- Wrong format or resolution
- Not properly mounted (for x-ray series)

[VERIFIED via DentalClaimSupport]

### Attachment submission methods

| Method | Mechanism | Key Detail |
|--------|-----------|------------|
| **NEA FastAttach** | Electronic repository | Most widely used. Creates NEA# referenced in claim. |
| **DentalXChange** | Electronic repository | NEA# field or primary comments field for batch claims |
| **Tesia** | Electronic repository | Supported by Aetna |
| **275 transaction** | X12 unsolicited attachment | Stedi supports for subset of dental payers |
| **PWK segment** | Inline reference in 837D | Points to attachment stored with vendor |
| **Mail/fax** | Physical | Fallback; delays processing significantly |

[VERIFIED via DentalXChange help docs, NEA/Vyne Dental, Stedi docs]

### PWK segment structure (Loop 2300)

| Element | Field | Values for Dental |
|---------|-------|-------------------|
| PWK01 | Report Type Code | DG (Diagnostic report), OZ (Support data for claim), RB (Radiology films), 03 (Report justifying treatment beyond utilization guidelines) |
| PWK02 | Report Transmission Code | EL (Electronic via esMD/275), BM (By mail), FX (By fax), FT (File transfer) |
| PWK05 | ID Code Qualifier | AC (Attachment Control Number) |
| PWK06 | Attachment Control Number | Unique ID matching the attachment in repository (max 50 chars) |

If PWK05 is present, PWK06 is required (and vice versa).

[VERIFIED via CGS Medicare PWK segment guide, Stedi PWK reference]

---

## 5. Coordination of Benefits (COB)

### Determination order (who is primary)

| Scenario | Primary | Secondary | Rule |
|----------|---------|-----------|------|
| Employee's own plan vs. spouse's plan | Employee's plan | Spouse's plan | Subscriber > Dependent |
| Active employer vs. COBRA/retiree | Active employer | COBRA/retiree | Active employment wins |
| Two jobs, one subscriber | Earlier enrollment | Later enrollment | Longest-held plan |
| Child, married parents | Parent with earlier birthday in calendar year | Other parent | Birthday Rule (month/day only, not year) |
| Child, divorced parents, shared custody | Birthday Rule | Birthday Rule | Same as married |
| Child, divorced parents, sole custody | Custodial parent's plan | Non-custodial's plan | Custody determines |
| Medical plan vs. dental plan | Medical (for overlapping procedures) | Dental | Medical takes priority for crossover procedures |
| Medicaid | Any private plan | Medicaid | Medicaid is always payer of last resort |
| Medicare (pre-65 retiree) | Retiree plan | Medicare | Retiree plan primary until 65 |
| Medicare (post-65) | Medicare | Retiree plan | Medicare becomes primary at 65 |

[VERIFIED via ADA COB guidance, DentalClaimSupport 10-rule guide]

### COB in the 837D

- **SBR segment** (Loop 2000B): `paymentResponsibilityLevelCode` = P (primary), S (secondary), T (tertiary)
- **Loop 2320**: Other Subscriber Information -- includes prior payer's adjudication data
- **CAS segment** (Loop 2320): Claim adjustment from primary payer
- **AMT segment** (Loop 2320): Prior payer paid amount
- Secondary claims must include primary payer's EOB data (amounts paid, adjustments, allowed amounts)

**COB method types**:
- **Traditional COB**: Patient can receive up to 100% of expenses from combined plans
- **Nonduplication COB**: If primary paid >= what secondary would have paid as primary, secondary pays $0. Common in self-funded dental plans.

[VERIFIED via ADA COB guidance, Minnesota Medicaid 837D COB guide]

### Medicare dental requirements

| Item | Detail |
|------|--------|
| Original Medicare (A/B) | Does NOT cover routine dental. Only covers procedures "inextricably linked" to covered medical treatment |
| Covered scenarios | Pre-transplant dental clearance, cardiac valve replacement, head/neck cancer (2024+), ESRD dialysis (2025+) |
| KX modifier | Required since July 2025 to indicate medical necessity documentation exists |
| ICD-10 | Required on 837D since July 2025 for Medicare dental claims |
| Cost sharing | 20% coinsurance after Part B deductible |
| Medicare Advantage dental | Varies by plan; many MA plans offer supplemental dental benefits. Use MA plan's payer ID. |

[VERIFIED via CMS.gov Medicare dental coverage page, ADA news on 2025 policy]

---

## 6. Frequency Limitations, Bundling, and Downcoding

### Common frequency limitations

| Procedure | Typical Limit | Variation |
|-----------|--------------|-----------|
| D0120 Periodic exam | 2x per 12 months | Some plans: 2x per benefit year |
| D0150 Comprehensive exam | 1x per 36 months | New patient or established returning |
| D0210 FMX | 1x per 36-60 months | |
| D0272/D0274 Bitewings | 1-2x per 12 months | |
| D0330 Panoramic | 1x per 36-60 months | Some plans combine with FMX limit |
| D1110 Prophylaxis adult | 2x per 12 months | |
| D1120 Prophylaxis child | 2x per 12 months | |
| D1206 Fluoride | 1-2x per 12 months | Age-limited (typically under 16-19) |
| D1351 Sealant | 1x per tooth per 36 months | Permanent molars only, age-limited |
| D2750 Crown | 1x per tooth per 60-84 months | 5-7 year replacement rule |
| D4910 Perio maintenance | 2-4x per 12 months | Must follow active perio therapy |
| D7140 Extraction | 1x per tooth (lifetime) | Obvious -- tooth is gone |

**Key gotcha**: Frequency windows can be calendar year vs. rolling 12 months vs. benefit year. The system must know which method each plan uses.

[VERIFIED via eAssist, DentalClaimSupport, multiple payer guides]

### Bundling rules

Payers bundle (combine) procedures and pay for only the primary procedure. The system should flag these before submission.

| Bundled Combination | What Payer Does |
|---------------------|-----------------|
| D2950 (core buildup) + D2750 (crown) | Some payers bundle buildup into crown fee |
| D2949 (pins) separate from D2950 (core buildup) | Pins included in buildup code since CDT update |
| Multiple periapical x-rays (D0220 + D0230s) same visit | May recode as D0210 (FMX) and apply FMX frequency limit |
| D0330 (pan) + D0272/D0274 (bitewings) | May recode as D0210 (FMX) |
| Adhesives/bases/liners + restoration | Included in restoration fee |
| Suture removal + extraction | Included in extraction fee |
| Occlusal adjustment + prosthetic delivery | Included in prosthetic post-delivery care |
| Intraoperative x-rays + root canal | Included in endodontic fee |
| D4341 (SRP) + D4355 (full-mouth debridement) same date | Payers deny one or both |

[VERIFIED via ADA bundling guidance, Arceum, outsourcestrategies.com]

### Downcoding patterns

| Submitted | Downcoded To | Reason |
|-----------|-------------|--------|
| D1110 (adult prophy) | D1120 (child prophy) | Patient under 14 (plan defines child by age) |
| D4341 (SRP 4+ teeth) | D4342 (SRP 1-3 teeth) | Fewer teeth treated than threshold |
| D4263 (bone graft, first site) x multiple | D4264 (additional site) for subsequent | Only first site gets D4263 rate |
| D2392 (posterior composite, 2 surface) | D2150 (amalgam, 2 surface) | LEAT: Least Expensive Alternative Treatment |
| Complex crown code | Less expensive crown code | LEAT provision in plan |

**LEAT (Least Expensive Alternative Treatment)**: Many plans pay based on the least costly clinically acceptable option. The claim is not rejected -- it is paid at the lower rate. The practice bills the patient the difference.

[VERIFIED via ADA downcoding guidance]

---

## 7. Pre-Authorization Requirements

### Procedures commonly requiring pre-authorization

| Category | Procedures | Pre-Auth Type |
|----------|-----------|---------------|
| Major restorative | Crowns, inlays, onlays | Predetermination (voluntary in PPO, required in DHMO) |
| Fixed prosthodontics | Bridges | Predetermination or prior auth |
| Removable prosthodontics | Dentures, partials | Predetermination or prior auth |
| Endodontics | Root canals | Some payers require, most don't |
| Periodontics | Surgical perio, osseous surgery | Often required |
| Implants | All implant services | Almost always required |
| Oral surgery | Complex extractions, jaw surgery | Often required |
| Orthodontics | All orthodontic treatment | Almost always required |

[VERIFIED via ADA pre-authorization guidance, Delta Dental NJ prior auth chart]

### Pre-auth vs. predetermination

| Term | Meaning | Binding? |
|------|---------|----------|
| Pre-authorization (prior auth) | Payer must approve before treatment or claim will be denied | Yes -- required for payment |
| Predetermination (pre-treatment estimate) | Voluntary estimate of benefits; payer states what they would pay | No -- advisory only, not a guarantee |

- **DPPO/indemnity plans**: Mostly predetermination (voluntary)
- **DHMO/managed care plans**: Mostly prior authorization (mandatory)
- **Medicare/Medicaid**: Prior authorization for specific services

Pre-auth approvals typically expire in **60-90 days**. Expired pre-auths require resubmission.

In the 837D, prior auth numbers go in **Loop 2300, REF segment** (REF qualifier G1) or `claimInformation.claimSupplementalInformation.priorAuthorizationNumber` in Stedi JSON.

[VERIFIED via ADA, SuperDial guide, DentalClaimSupport]

---

## 8. Timely Filing Deadlines

| Payer | Filing Window | Notes |
|-------|--------------|-------|
| Delta Dental | 12 months | From date of service |
| Cigna | 90 days (participating) / 180-365 days (non-par) | Strict enforcement |
| UnitedHealthcare | 90 days | 30-day preferred timeline |
| Aetna | 120 days (commercial) / 180 days-1 year (employer-sponsored, MA) | Plan-dependent |
| MetLife | 12 months | Standard commercial |
| BCBS | Varies by plan (90 days - 12 months) | Check specific BCBS entity |
| Medicare | 12 months (1 calendar year after DOS) | Strictly enforced |
| Medicaid | Varies by state (90 days - 12 months) | State-specific |

**Key considerations**:
- Clock starts on **date of service**, not date claim is created
- For secondary claims, some payers start the clock from primary payer's EOB date
- CARC 4 and CARC 29 are the denial codes for timely filing failures
- CARC 29 is often non-appealable

[VERIFIED via PracticeSol timely filing list, MedaceHealth, bellmedex.com -- specific windows cross-referenced across multiple sources]

---

## 9. Failure Taxonomy

### Layer 1: Pre-submission validation (before wire)

Caught by your system or clearinghouse before the claim leaves.

| Error Type | Examples | Detection |
|------------|----------|-----------|
| Missing required fields | No NPI, no subscriber ID, no tooth # on tooth-specific procedure | Schema validation |
| Invalid code combinations | Surface code on procedure that doesn't take surfaces | CDT rule engine |
| Invalid payer ID | Payer not in clearinghouse network | Payer directory lookup |
| Frequency violation | Prophy already submitted this period | History check (if available) |
| Invalid tooth/surface | Tooth 33, surface "X" | Range validation |
| Character violations | Reserved delimiters (~, *, :, ^) in data fields | String sanitization |
| Duplicate claim | Same patient/provider/DOS/procedure | Dedup check |

### Layer 2: Clearinghouse rejections (999 / 277CA)

Returned by clearinghouse or payer front-end before adjudication.

| Transaction | What It Reports | Granularity |
|------------|----------------|-------------|
| **TA1** | Interchange-level accept/reject | Entire file |
| **999** | Functional group/transaction set accept/reject | Per transaction set; segment/element-level errors |
| **277CA** | Claim-level accept/reject | Per claim; status category + status code + entity code |

277CA rejection code structure: `CATEGORY:STATUS:ENTITY`
- Category: A1 (accepted), A2 (accepted with errors), R3 (rejected for errors)
- Status: Specific field/reason (e.g., "missing subscriber ID")
- Entity: Which entity has the error (payer, billing provider, subscriber, etc.)

[VERIFIED via CMS acknowledgment transactions guide, AllZoneMS EDI rejections guide]

### Layer 3: Payer adjudication denials (835 ERA with CARC/RARC)

Returned after payer processes the claim. These come back on the 835 (ERA).

| CARC | Meaning | Common Dental Cause | Frequency |
|------|---------|---------------------|-----------|
| **16** | Missing/incomplete information | Missing NPI, tooth #, DOB, subscriber ID mismatch | Most common |
| **4** | Procedure code inconsistent with modifier/info | Timely filing issue or payer mismatch | Common |
| **27** | Expenses after coverage terminated | Patient coverage lapsed, dependent aged off | Common |
| **29** | Timely filing limit expired | Claim submitted too late; often non-appealable | Common |
| **50** | Non-covered: not medically necessary | Perio, implants, ortho without clinical justification | Common |
| **96** | Non-covered charge | Procedure excluded from plan (cosmetic, whitening) | Common |
| **97** | Benefit included in another service | Bundling: component procedure rolled into primary | Common |
| **18** | Duplicate claim/service | Same claim submitted twice | Moderate |
| **39** | Services denied at time of initial claim | Prior auth required but not obtained | Moderate |
| **119** | Benefit maximum reached | Annual max exhausted | Moderate |
| **197** | Precertification/auth/notification absent | Pre-auth not on file | Moderate |
| **252** | Attachment/documentation required | X-rays, perio charting, narrative needed to adjudicate | Moderate |
| **253** | Sequencing error | Prerequisite treatment not completed first | Less common |

**RARC codes** (Remittance Advice Remark Codes) supplement CARCs with additional detail. Common dental RARCs:
- N362: Missing tooth number
- N517: Missing rendering provider info
- N657: Incomplete or invalid diagnosis code
- MA130: Claim was previously denied/adjusted

[VERIFIED via Arceum top 10 dental denial codes, X12 CARC reference, Delta Dental CARC/RARC mapping]

---

## 10. Stedi-Specific Implementation Notes

| Item | Detail |
|------|--------|
| JSON endpoint | POST `/healthcare/dental-claims` -- accepts JSON, Stedi converts to X12 837D |
| Raw X12 endpoint | POST `/healthcare/dental-claims/raw-x12` -- accepts pre-built X12 |
| Testing | Set `ISA15 = "T"` (test mode). Stedi validates but does not send to payer; returns synthetic 277CA |
| Validation | Auto-validates against 837D spec + payer-specific rules before transmission |
| Response | Returns submission status + claim metadata for tracking |
| Payer lookup | `tradingPartnerServiceId` from Stedi payer network directory |
| Patient control # | Max 17 chars, X12 basic character set, case-insensitive matching, must be unique per claim |
| Line item tracking | `providerControlNumber` on service line becomes `lineItemControlNumber` in 277CA and 835 responses |
| COB (secondary) | Set `subscriber.paymentResponsibilityLevelCode = "S"` and populate `claimInformation.otherSubscriberInformation[]` with primary ERA data |
| Attachments (275) | Supported for subset of dental payers; contact Stedi for payer-specific availability |
| Character restrictions | Reserved delimiters `~`, `*`, `:`, `^` cannot appear in JSON field values |

[VERIFIED via Stedi dental claims API docs, Stedi blog post on dental claims GA]

---

## 11. Key Domain Risks for Implementation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Payer ID mismatch (especially Delta Dental, BCBS) | Claim rejected or misrouted | Maintain payer ID mapping table; resolve BCBS prefix before submission |
| Tooth/surface/quadrant fields wrong for CDT code | CARC 16 rejection | Build CDT-to-field-requirements rule engine |
| Attachment not submitted when payer expects one | CARC 252 -- claim pends indefinitely | Pre-check attachment requirements by payer + procedure |
| Frequency limitation not checked pre-submission | Claim denied, wasted submission | Track claim history per patient/procedure where possible |
| COB order wrong | Claim denied by secondary for wrong sequencing | Implement birthday rule and COB determination logic |
| Timely filing window missed | CARC 29 -- non-appealable denial | Monitor claim age; alert on approaching deadlines |
| LEAT downcoding not communicated to practice | Patient balance billing confusion | Flag LEAT-eligible procedures; calculate expected payment |
| Medicare KX modifier missing | Claim rejected | Auto-add KX when payer is Medicare and service is dental |
| Pre-auth expired before claim submission | CARC 39/197 denial | Track pre-auth expiry dates; alert before lapse |
| Bundling not flagged | Unexpected CARC 97 denial or reduced payment | Build bundling rule engine for known combinations |
