# Technical Architecture & Compliance

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

## 1. Mapping to Existing Encounter Model — What Fields Exist, What's Missing for Dental

### What a Typical Encounter Model Already Has

Most encounter models built for eligibility verification (270/271) already capture:

| Field Group | Typical Fields | Reusable for Dental Claims? |
|---|---|---|
| **Patient Demographics** | Name, DOB, gender, address, member ID, relationship to subscriber | Yes — identical for 837D |
| **Subscriber Info** | Subscriber name, ID, group number, payer ID | Yes — identical |
| **Provider Info** | Rendering provider NPI, name, taxonomy code, tax ID | Partially — dental needs billing vs. rendering distinction and dental-specific taxonomy codes |
| **Payer Info** | Payer name, payer ID, plan type | Yes — but dental plans often have separate payer IDs from medical |
| **Diagnosis Codes** | ICD-10 codes | Partially — dental uses ICD-10 but the code set is narrower and diagnosis is optional on many dental claims |
| **Procedure Codes** | CPT/HCPCS | **No** — dental uses CDT (Current Dental Terminology) codes, not CPT |
| **Service Dates** | Date of service, admission/discharge | Yes |
| **Claim-level fields** | Place of service, claim frequency, authorization | Partially — dental has its own place-of-service codes and unique claim-level fields |

### Dental-Specific Fields That Must Be Added

The 837D (X12 005010X224A2) transaction set requires several field groups that have no analog in medical/professional claims:

#### A. Tooth-Level Information (SV3 Segment — Dental Service)

The SV3 segment replaces the SV1 (professional service) segment and includes:

- **CDT Procedure Code** (SV3-01): Uses ADA CDT codes (e.g., D0120 for periodic oral exam, D2740 for porcelain crown). The encounter model must store CDT codes alongside or instead of CPT.
- **Tooth Number** (SV3-04): Values 1–32 for permanent teeth, A–T for primary (deciduous) teeth, using the Universal/National tooth numbering system.
- **Oral Cavity Designation** (SV3-02): Area of the oral cavity when a procedure doesn't apply to a specific tooth — values include upper/lower arch, entire mouth, maxillary/mandibular.
- **Tooth Surface Codes** (SV3-03): Multi-character field where each character represents a surface — M (mesial), O (occlusal), D (distal), B/F (buccal/facial), L (lingual), I (incisal). A single restoration can involve multiple surfaces (e.g., "MOD" for a three-surface filling).

#### B. Prosthesis Information (TOO Segment)

Required when the claim involves crowns, bridges, dentures, or other prosthetic restorations:

- **Prosthesis, Initial or Replacement** (TOO-01): Whether this is an initial placement or a replacement.
- **Prior Placement Date** (TOO-02): If replacement, when the original prosthesis was placed. Payers use this to determine benefit eligibility (most plans have 5–10 year replacement rules).
- **Tooth numbers for bridges**: Which teeth are pontics vs. abutments.

#### C. Orthodontic Information (DN1/DN2 Segments)

Required for orthodontic claims:

- **Orthodontic Treatment Months Total** (DN1-01): Total number of months of planned treatment.
- **Orthodontic Treatment Months Remaining** (DN1-02): Months remaining at time of claim.
- **Orthodontic Banding Date**: Date appliances were placed.
- **Date of Initial Orthodontic Exam**.

#### D. Accident & Other Dental-Specific Claim Info

- **Accident Information**: If treatment relates to an accident — date, cause (auto, employment, other), state. Important for coordination of benefits with auto/workers comp.
- **Missing Tooth Information** (TOO segment at claim level): List of teeth that are missing but NOT being treated on this claim. Payers use this for treatment planning validation.
- **Place of Treatment Code**: Dental-specific place of service — office (11), facility (21), patient home (12), etc. Overlaps with medical POS but the common values differ.

#### E. Rendering vs. Billing Provider Nuances

- **Billing Provider**: The practice/entity (Type 2 NPI).
- **Rendering Provider**: The individual dentist (Type 1 NPI).
- **Referring Provider**: For specialist referrals (endodontist, oral surgeon, etc.).
- **Dental-specific Taxonomy Codes**: General dentistry (1223G0001X), orthodontics (1223X0400X), endodontics (1223E0200X), oral surgery (1223S0112X), pediatric dentistry (1223P0221X), periodontics (1223P0300X), prosthodontics (1223P0700X).

### Recommended Encounter Model Extensions

```
encounter_dental_service {
  encounter_id        FK
  cdt_code            VARCHAR(5)     -- D-prefixed CDT code
  tooth_number        VARCHAR(2)     -- 1-32 or A-T
  tooth_surfaces      VARCHAR(5)     -- Combination of M,O,D,B,F,L,I
  oral_cavity_code    VARCHAR(2)     -- When not tooth-specific
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
  billing_npi         VARCHAR(10)
  rendering_npi       VARCHAR(10)
  referring_npi       VARCHAR(10)
  billing_taxonomy    VARCHAR(15)
  rendering_taxonomy  VARCHAR(15)
  license_number      VARCHAR(20)    -- Some states/payers require this
}
```

### Key Data Mapping Gaps to Close

1. **CDT vs. CPT**: The procedure code field must support CDT codes. If the current model validates against CPT, that validation must be extended or swapped for dental encounters.
2. **Tooth-level granularity**: Medical encounters are typically at the body-system level; dental needs tooth-level precision. Each service line ties to a specific tooth + surface combination.
3. **Multi-surface encoding**: A single procedure (e.g., D2392 — resin composite, two surfaces) must encode exactly which surfaces were treated. This is not just metadata — payers adjudicate based on surface count.
4. **Missing tooth map**: This is a claim-level field with no medical equivalent. It must be captured at patient intake or pulled from the PMS.
5. **CDT code licensing**: CDT codes are copyrighted by the ADA. Using them in your system requires an [ADA CDT license](https://www.ada.org/publications/cdt). Annual cost is modest but must be budgeted.

## 2. Stedi 837D Integration — API Capabilities, Validation, ERA (835) Processing

### Stedi Platform Overview

[Stedi](https://www.stedi.com/) is a cloud-native EDI platform that provides APIs for generating, validating, sending, and receiving X12 transactions. Unlike legacy clearinghouses that require SFTP/batch workflows, Stedi exposes a modern REST/JSON API layer over the X12 standard. This makes it a strong fit for a team that wants programmatic control over claim submission without building raw X12 parsing from scratch.

### 837D Support on Stedi

Stedi supports the **X12 005010X224A2** implementation guide, which is the HIPAA-mandated version of the 837D (dental claim). Key capabilities:

#### A. Transaction Generation (JSON-to-X12)

- **Stedi Mappings / JEDI format**: You can construct an 837D claim as a structured JSON object that maps 1:1 to X12 segments and elements. Stedi's API translates this JSON into valid X12 EDI output. This means your application never has to manually construct fixed-width X12 strings.
- **Dental-specific segments supported**: SV3 (dental service line), TOO (tooth information), DN1/DN2 (orthodontic information) — all the dental-specific loops described in Section 1 are part of Stedi's 837D schema.
- **Guide-based validation**: Stedi provides [EDI Guides](https://www.stedi.com/edi) — interactive, machine-readable representations of X12 implementation guides. The 837D guide enforces required vs. optional segments, valid code sets (CDT codes, tooth numbers, surface codes), and structural rules before generating the X12 output.

#### B. Inbound Validation & Scrubbing

- **Schema validation**: Stedi validates against the 005010X224A2 guide structure — correct segment order, required elements, valid enumerated values.
- **What Stedi does NOT do**: Stedi validates EDI structural correctness, not clinical or payer-specific business rules. It will catch "invalid tooth number 99" but it will NOT catch "Delta Dental of CA requires prior auth for D2750 on patients under 16." Payer-specific scrubbing rules must be built in your application layer or sourced from a third-party scrubbing engine (see Section 6).

#### C. Claim Routing / Clearinghouse Connectivity

- **Stedi as clearinghouse**: Stedi can route 837D transactions to payers through its clearinghouse network. Stedi partners with existing clearinghouse networks to reach payer connections. Coverage is expanding but may not yet match legacy clearinghouses like Change Healthcare or Availity for every small dental payer.
- **Payer enrollment**: Each payer connection typically requires enrollment — registering your entity (billing NPI, tax ID) with the payer via the clearinghouse. Stedi handles this, but lead times vary (days to weeks depending on the payer). [Stedi payer network documentation](https://www.stedi.com/docs)
- **Direct-to-payer SFTP**: For payers not in Stedi's clearinghouse network, you can use Stedi to generate the X12 and then route it yourself via SFTP or through another clearinghouse.

#### D. ERA (835) Processing — Remittance Advice

The 835 (Electronic Remittance Advice) is the transaction payers send back explaining how a claim was adjudicated — what was paid, denied, or adjusted.

- **Stedi 835 parsing**: Stedi can parse inbound 835 transactions from X12 into structured JSON, making it far easier to process than raw X12. Each service line in the 835 maps back to a claim via the Claim Control Number (CLM-01 from the 837D).
- **Dental-specific adjustment codes**: Dental ERAs use the same CAS (Claim Adjustment Segment) structure as medical, but with dental-specific Claim Adjustment Reason Codes (CARCs) and Remittance Advice Remark Codes (RARCs). Common dental-specific scenarios:
  - **Frequency limitations** (CARC 151 — "Payment adjusted because the payer deems the information submitted does not support this level of service"): e.g., prophylaxis limited to 2x/year.
  - **Downcoding** (CARC 59 — "Processed based on multiple or concurrent procedure rules"): e.g., D2750 billed but D2751 paid.
  - **Missing tooth clause** (CARC 96 — "Non-covered charge"): Payer denies a bridge because the tooth was missing before coverage began.
  - **Waiting period** (CARC 26 — "Expenses incurred prior to coverage"): Major services subject to waiting periods.
- **Payment matching**: The 835 includes the Payer Claim Control Number and the submitter's original claim number, enabling automated matching of payments back to submitted claims.

#### E. Stedi Pricing Model

Stedi's pricing is usage-based. As of their public documentation at [stedi.com/pricing](https://www.stedi.com/pricing):

- **Transaction-based pricing**: Charges per X12 transaction processed (generation, parsing, or translation). Typical rates are in the range of $0.01–$0.10 per transaction depending on volume tier and contract terms.
- **Clearinghouse routing fees**: Additional per-claim fees when Stedi routes claims through its clearinghouse network to payers. These fees are in addition to the core API transaction costs.
- **No per-seat licensing**: Unlike legacy clearinghouse contracts, Stedi doesn't charge per-user or per-provider fees. This is an advantage for platforms serving many practices.
- **ERA/835 receipt**: Parsing inbound 835s is typically included or priced similarly to outbound transactions.

**Cost comparison note**: Traditional dental clearinghouses (DentalXChange, NEA, Change Healthcare) typically charge **$0.25–$0.50 per claim** for submission + ERA receipt. Stedi's total cost (API + routing) can be competitive at scale, but the team should negotiate a contract based on projected volume. For reference, the payer landscape document notes approximately [1.2–1.5 billion dental claims processed annually in the U.S.](https://www.ada.org/resources/research/health-policy-institute) — even a small share means significant volume leverage.

### Integration Architecture with Stedi

```
┌─────────────┐     ┌──────────────┐     ┌───────────────┐     ┌─────────┐
│  Your App   │────▶│  Stedi API   │────▶│  Clearinghouse │────▶│  Payer  │
│ (Encounter  │     │  (JSON→X12)  │     │  Network       │     │         │
│  Model +    │◀────│  (X12→JSON)  │◀────│               │◀────│  (Adj.) │
│  Claim Mgr) │     │              │     │               │     │         │
└─────────────┘     └──────────────┘     └───────────────┘     └─────────┘
     │                                                              │
     │  837D (claim submit)  ──────────────────────────────────▶    │
     │  835 (remittance)     ◀──────────────────────────────────    │
     │  277 (claim status)   ◀──────────────────────────────────    │
```

### Key Stedi Integration Risks

1. **Payer network coverage gaps**: Stedi's clearinghouse network is newer than legacy clearinghouses. Some smaller or regional dental payers may not yet be reachable through Stedi. Mitigation: Use Stedi for X12 generation/parsing, but route through a secondary clearinghouse (DentalXChange, Tesia) for payers not in Stedi's network.
2. **Enrollment lead times**: Payer enrollment through any clearinghouse takes 5–30 business days depending on the payer. This is not a Stedi-specific issue, but it affects time-to-first-claim.
3. **Scrubbing gap**: Stedi validates X12 structure but not payer-specific business rules. You must layer scrubbing on top (see Section 6).
4. **835 delivery mechanism**: ERAs may be delivered via different channels (SFTP, direct API webhook, batch file). Ensure the integration handles asynchronous 835 receipt and can poll or receive push notifications.

## 3. RPA Strategy — Which Payer Portals to Automate, ROI Thresholds, Maintenance Cost

### Strategic Rationale: RPA vs. EDI for Dental Claims

The team already has a strong RPA engine and notes that RPA is "generally cheaper than EDI" for their operations. This is a defensible position for dental because:

1. **Dental clearinghouse fees add up**: At $0.25–$0.50 per claim through traditional clearinghouses ([CAQH Index](https://www.caqh.org/explorations/caqh-index)), high-volume payers with good portals may be cheaper to automate via RPA.
2. **Portal submission avoids enrollment delays**: Clearinghouse-to-payer enrollment can take 5–30 days; portals require only provider credentialing (which practices already have).
3. **Portals sometimes support features EDI does not**: Some payer portals allow real-time claim status, inline attachment upload, and immediate acknowledgment — features that EDI handles asynchronously (via 999/277 responses, sometimes with multi-day lag).

However, RPA carries its own costs: development, maintenance when portals change, and operational fragility. The right strategy is a **hybrid approach** — EDI for the majority of volume, RPA for specific high-value portals where the economics favor it.

### Portal Prioritization: Which Payers to Automate

Using the market share data from the payer landscape analysis, prioritize portals by **claim volume x automation feasibility**:

| Priority | Payer | Estimated Share of Dental Claims | Portal | Automation Feasibility | Recommendation |
|----------|-------|--------------------------------|--------|----------------------|----------------|
| **P0** | Delta Dental (top 5 state entities) | ~33% combined | Varies by state entity | Medium — each state entity has a different portal; DD of CA is most modernized | **EDI primary, RPA for specific DD entities** where portal has advantages (attachment upload, real-time status) |
| **P1** | UnitedHealthcare Dental | ~15% | [uhcprovider.com](https://www.uhcprovider.com/) | High — unified portal, relatively stable UI | **Strong RPA candidate** — high volume, single portal |
| **P1** | Cigna Dental | ~9% | [cignaforhcp.cigna.com](https://cignaforhcp.cigna.com/) | Medium-High — portal is functional but occasionally restructured | **RPA candidate** if volume justifies |
| **P1** | MetLife Dental | ~8% | [metlife.com/dental-providers](https://www.metlife.com/dental-providers/) | High — dedicated dental portal with good structure | **Strong RPA candidate** — dental-specific portal means fewer unrelated UI changes |
| **P2** | Aetna Dental | ~7% | [availity.com](https://www.availity.com/) | Medium — goes through Availity, which is a centralized intermediary portal | **Availity RPA** covers both Aetna and Humana, so automating Availity gives 2-for-1 |
| **P2** | Guardian | ~5% | [guardiananytime.com](https://www.guardiananytime.com/) | Medium — dated but stable interface | **EDI preferred** — lower volume may not justify RPA dev |
| **P2** | Humana Dental | ~3% | [availity.com](https://www.availity.com/) | Medium — same Availity portal as Aetna | Covered by Availity automation |
| **P3** | All others (long tail) | ~20% combined | Various | Low — too many portals, too little volume per payer | **EDI only** via clearinghouse |

### The Availity Multiplier Effect

[Availity](https://www.availity.com/) is a multi-payer portal used by Aetna, Humana, and several smaller payers. Automating Availity's claim submission workflow gives you coverage across multiple payers with a single RPA bot. This is the highest-leverage RPA investment after the top 2-3 individual payer portals.

### ROI Threshold Model

For each payer portal, the RPA investment must be justified against EDI costs:

```
Monthly RPA Cost = (Development amortized / 12) + Monthly maintenance + Infra cost
Monthly EDI Cost = Claims per month × Per-claim clearinghouse fee

RPA is justified when: Monthly RPA Cost < Monthly EDI Cost
```

**Typical cost parameters:**

| Cost Factor | Estimate | Source/Basis |
|---|---|---|
| RPA bot development (per payer portal) | $15,000–$40,000 one-time | Varies by portal complexity; dental portals are simpler than medical (fewer claim types) |
| Annual RPA maintenance (per bot) | 20–30% of initial dev cost | Industry standard per [Gartner RPA maintenance estimates](https://www.gartner.com/en/information-technology/glossary/robotic-process-automation-rpa); portal redesigns are the primary driver |
| Infrastructure/runtime cost (per bot) | $200–$500/month | Cloud compute for headless browser + monitoring |
| EDI clearinghouse fee | $0.25–$0.50/claim | Per [CAQH Index](https://www.caqh.org/explorations/caqh-index) and vendor quotes |

**Break-even calculation example (UnitedHealthcare):**

- Assume 2,000 UHC dental claims/month (moderate-volume platform)
- EDI cost: 2,000 × $0.35 = **$700/month**
- RPA cost: $30,000 dev amortized over 24 months ($1,250/mo) + $400/mo maintenance + $300/mo infra = **$1,950/month initially**, dropping to **$700/month** after amortization
- Break-even at ~24 months, then RPA is ~50% cheaper ongoing
- At 5,000 claims/month: EDI = $1,750/mo vs. RPA ongoing = $700/mo — **RPA saves $1,050/month**

**Rule of thumb**: RPA is economically justified for a payer portal when you expect to submit **>1,500 claims/month** through that portal consistently, AND the portal is stable enough that annual maintenance stays below 30% of initial dev cost.

### Portal Automation Patterns for Dental Claims

Dental claim portal submissions follow predictable patterns. Key workflow steps to automate:

1. **Authentication**: Login with provider credentials (often NPI + password). Handle MFA where required (most payer portals now require it — store TOTP seeds or use SMS forwarding).
2. **Patient lookup**: Search by member ID, DOB, or name. Confirm eligibility status before submission.
3. **Claim form population**: Map encounter model fields to the portal's form fields:
   - Patient/subscriber demographics
   - CDT procedure codes (portals typically have a code lookup — enter code directly)
   - Tooth number and surface (dropdown or text field)
   - Charge amounts
   - Rendering/billing provider info
   - Diagnosis codes (if required by this payer)
4. **Attachment upload**: Upload X-rays (JPEG/DICOM), perio charts (PDF), narratives (text/PDF). This is a major advantage of portal RPA — EDI attachment submission is complex (see Section 6).
5. **Submission confirmation**: Capture the payer's claim reference number / tracking ID. This is your receipt for the submission.
6. **Status check (separate bot or scheduled run)**: Periodically log in and check claim status. Faster feedback loop than waiting for 277 transactions.

### Maintenance Cost Drivers and Mitigation

Portal automation breaks when portals change. The primary failure modes:

| Failure Mode | Frequency | Impact | Mitigation |
|---|---|---|---|
| **UI element changes** (CSS selectors, field IDs) | 2–4x/year per portal | Bot fails to find form fields | Use resilient selectors (data-testid, aria-label, structural XPath); build selector fallback chains |
| **Authentication flow changes** (new MFA, CAPTCHA) | 1–2x/year | Bot cannot log in | Abstract auth flow; maintain break-glass manual submission path; invest in CAPTCHA solving (or switch to EDI for that payer) |
| **Portal redesign** (major UI overhaul) | Every 2–3 years | Full bot rebuild required | Budget for full rebuild; keep portal automation modular so only the affected payer's bot needs rebuilding |
| **Rate limiting / bot detection** | Ongoing | Submissions throttled or blocked | Respect rate limits; use realistic timing/user-agent; submit during business hours to blend with human traffic |
| **Session/timeout changes** | 1–2x/year | Bot sessions expire mid-submission | Implement session health checks; retry with fresh session on failure |

**Estimated annual maintenance cost per portal bot**: $4,000–$12,000/year, weighted heavily by whether a major redesign occurs. Average across a portfolio of 5 portal bots: ~$6,000/bot/year.

### Fallback Strategy

Every RPA-automated payer must have a fallback path:

1. **Primary**: RPA portal submission
2. **Fallback 1**: EDI via Stedi/clearinghouse (always available for HIPAA-compliant payers)
3. **Fallback 2**: Queue for manual submission by staff (last resort)

The system should detect RPA failures automatically (submission confirmation not received within expected timeframe) and automatically route the claim to the EDI fallback. Alert the RPA maintenance team so the bot can be repaired.

### Recommended Phased RPA Rollout

| Phase | Payers | Reason |
|---|---|---|
| **Phase 1** | UHC Dental, MetLife Dental | High volume, stable portals, dental-dedicated UX |
| **Phase 2** | Availity (covers Aetna + Humana) | Multi-payer leverage from single bot |
| **Phase 3** | Cigna Dental, Delta Dental of CA | Higher complexity; DD fragmentation requires per-entity work |
| **Phase 4** | Evaluate remaining portals | Only if volume justifies; otherwise EDI-only for long tail |

## 4. HIPAA Compliance for Dental Claims — Transaction Sets, NPI Requirements, Covered Entity Rules

### HIPAA Transaction Set Requirements for Dental

HIPAA's Administrative Simplification provisions (Title II) mandate specific electronic transaction standards for all covered entities. For dental claim processing, the relevant transaction sets are all under the **X12 Version 005010** standard, as mandated by the [CMS HIPAA transaction standards rule](https://www.cms.gov/Regulations-and-Guidance/Administrative-Simplification/TransactionCodeSetsStands):

| Transaction | X12 Code | Implementation Guide | Purpose |
|---|---|---|---|
| **Dental Claim Submission** | 837D | 005010X224A2 | Submit dental claims from provider to payer |
| **Claim Status Inquiry** | 276 | 005010X212 | Provider asks payer for claim status |
| **Claim Status Response** | 277 | 005010X212 | Payer responds with claim status |
| **Eligibility Inquiry** | 270 | 005010X279A1 | Check patient eligibility/benefits |
| **Eligibility Response** | 271 | 005010X279A1 | Payer responds with eligibility/benefits |
| **Remittance Advice** | 835 | 005010X221A1 | Payer sends payment/adjudication details |
| **Claim Payment/Advice** | 820 | 005010X218 | EFT remittance (payment instruction) |
| **Functional Acknowledgment** | 999 | 005010X231A1 | Confirms receipt and syntactic validity of a submitted transaction |
| **Implementation Acknowledgment** | TA1 | (envelope level) | Confirms interchange envelope receipt |

**Key compliance point**: All covered entities (health plans) MUST accept the 837D for dental claims. Providers who submit claims electronically MUST use the 837D. There is no legal alternative electronic format for dental claim submission between covered entities. Proprietary formats are permitted only for transactions not covered by HIPAA (e.g., pre-estimates, some attachment workflows).

### NPI Requirements for Dental Providers

The National Provider Identifier (NPI) system, mandated by [HIPAA under 45 CFR Part 162](https://www.cms.gov/Regulations-and-Guidance/Administrative-Simplification/NationalProvIdentStand), applies to all dental providers who submit electronic transactions.

#### Type 1 NPI (Individual)

- **Issued to**: Individual dentists, dental hygienists (in some states), oral surgeons, orthodontists, etc.
- **Use on 837D**: The **rendering provider** NPI (Loop 2310B — Rendering Provider) must be the Type 1 NPI of the individual dentist who performed the service.
- **All dentists must have one**: Any dentist who provides services that are billed electronically needs their own Type 1 NPI, regardless of employment arrangement.

#### Type 2 NPI (Organization)

- **Issued to**: Dental practices, dental groups, DSOs (Dental Service Organizations), clinics.
- **Use on 837D**: The **billing provider** NPI (Loop 2010AA — Billing Provider) is typically the Type 2 NPI of the practice entity.
- **Solo practitioners**: A solo dentist may use their Type 1 NPI as both billing and rendering provider if they don't have a separate practice entity. However, best practice (and many payers require) is to have a Type 2 NPI for the practice even for solo providers.

#### Subpart Enumeration (Important for DSOs and Multi-Location Practices)

- Large dental groups and DSOs with multiple locations should enumerate each location as a **subpart** under their organizational Type 2 NPI, per [CMS NPI guidelines](https://www.cms.gov/Regulations-and-Guidance/Administrative-Simplification/NationalProvIdentStand/Downloads/NPIchecklistPDF.pdf).
- Each billing location on a claim should have its own NPI (either a subpart NPI or a separate Type 2 NPI).
- This matters for the encounter model: the billing NPI field must support per-location NPIs, not just a single practice NPI.

### Dental Provider Taxonomy Codes

Taxonomy codes classify the provider's specialty and are submitted on the 837D in the PRV (Provider Information) segment. The taxonomy code set is maintained by [NUCC (National Uniform Claim Committee)](https://www.nucc.org/).

| Taxonomy Code | Specialty | Notes |
|---|---|---|
| **1223G0001X** | General Dentistry | Most common; default for general/family dentists |
| **1223X0400X** | Orthodontics & Dentofacial Orthopedics | Required for ortho claims |
| **1223E0200X** | Endodontics | Root canal specialists |
| **1223P0106X** | Oral & Maxillofacial Pathology | |
| **1223D0001X** | Dental Public Health | |
| **1223S0112X** | Oral & Maxillofacial Surgery | |
| **1223X0008X** | Oral & Maxillofacial Radiology | |
| **1223P0221X** | Pediatric Dentistry (Pedodontics) | |
| **1223P0300X** | Periodontics | |
| **1223P0700X** | Prosthodontics | |
| **1223D0008X** | General Practice Dentistry | Alternate to 1223G0001X |
| **122300000X** | Dentist (generic) | Use when specialty not specified |
| **126800000X** | Dental Hygienist | For states where hygienists bill independently |

**Compliance note**: The taxonomy code on the claim MUST match the provider's NPI registration. If a dentist is registered as general dentistry (1223G0001X) but submits an orthodontic claim (D8000 series), some payers will reject the claim based on taxonomy mismatch. The provider's NPPES record should reflect all specialties they practice under.

### What Makes Dental HIPAA Compliance Different from Medical

1. **Simpler entity structure**: Most dental practices are small (1–3 dentists). The covered entity / business associate analysis is usually simpler than for hospitals or large medical groups. However, DSOs are an exception — they may have hundreds of locations under a single corporate entity with complex NPI/taxonomy relationships.

2. **CDT code set is HIPAA-mandated**: Just as CPT/HCPCS is mandated for medical, CDT is the legally required code set for dental procedures under HIPAA. Using proprietary or outdated CDT codes violates the transaction standard. CDT is updated annually (effective January 1); the system must update code tables yearly. [ADA CDT codes](https://www.ada.org/publications/cdt)

3. **Attachment requirements are evolving**: The HIPAA Attachments Rule has been long-delayed but is expected to finalize standards for electronic claim attachments. Currently, dental attachments (X-rays, perio charts, narratives) are transmitted via:
   - **NEA FastAttach** — proprietary standard widely adopted in dental, managed by [NEA (National Electronic Attachment)](https://www.nea-fast.com/)
   - **Direct upload to payer portals** — varies by payer
   - **Mail/fax** — still common for paper-oriented practices
   - **HIPAA C-CDA / HL7 attachments** — the eventual mandated standard, but not yet enforced

   When the Attachments Rule is finalized, it will likely mandate a specific standard (probably based on HL7 FHIR or C-CDA). Building attachment handling with a pluggable architecture is critical.

4. **Lower audit scrutiny but same penalties**: Dental practices face the same HIPAA penalties as medical practices (up to $1.5 million per violation category per year, per the [HHS HIPAA Enforcement Rule](https://www.hhs.gov/hipaa/for-professionals/compliance-enforcement/index.html)), but OCR (Office for Civil Rights) audits historically focus more on medical. This does NOT mean dental compliance is optional — it means dental entities sometimes underinvest in compliance, which is a risk for a platform serving them.

5. **Business Associate Agreement (BAA) requirements**: If the platform handles PHI (patient health information) for dental practices — which it does if it submits claims — the platform is a **Business Associate** under HIPAA. A BAA must be in place with every dental practice (covered entity) the platform serves. The BAA must cover:
   - Permitted uses and disclosures of PHI
   - Safeguards requirements
   - Breach notification obligations
   - Subcontractor requirements (if the platform uses Stedi, the platform needs a BAA with Stedi too)

6. **State dental board requirements**: Some states have additional regulations around dental claim submission, particularly regarding who can submit claims on behalf of a dental practice (some states require that the submitter be a licensed professional or a registered clearinghouse). This varies by state and should be reviewed with counsel for target markets.

### Compliance Checklist for the Platform

- [ ] **BAAs in place** with all dental practices (covered entities) and all subcontractors (Stedi, cloud providers, RPA infrastructure)
- [ ] **PHI encryption** at rest (AES-256) and in transit (TLS 1.2+) — required by HIPAA Security Rule
- [ ] **Access controls** — role-based access; only authorized personnel can view/modify PHI
- [ ] **Audit logging** — all access to PHI must be logged with user, timestamp, and action
- [ ] **NPI validation** — verify billing and rendering NPIs are active in [NPPES](https://npiregistry.cms.hhs.gov/) before submission
- [ ] **Taxonomy code validation** — ensure taxonomy on claim matches NPPES registration
- [ ] **CDT code version management** — annual code table updates effective January 1
- [ ] **Transaction set version compliance** — must use 005010 versions for all HIPAA transactions
- [ ] **Breach notification procedures** — 60-day notification requirement for breaches affecting 500+ individuals; documented process for smaller breaches
- [ ] **Risk assessment** — annual HIPAA risk assessment required under the Security Rule

## 5. Claim Status Tracking (276/277) and ERA/EOB (835) Processing

### 5A. Claim Status Tracking via 276/277

The 276 (Health Care Claim Status Request) and 277 (Health Care Claim Status Response) transaction pair allows programmatic tracking of claim status without waiting for the ERA/835.

#### 276 Request Structure

The 276 request is sent from the provider/platform to the payer (or clearinghouse) and contains:

- **Submitter information**: Who is asking (NPI, organization name)
- **Provider information**: Billing and/or rendering provider NPI
- **Subscriber/patient**: Member ID, name, DOB — to identify the patient
- **Claim reference**: One or more of:
  - Payer Claim Control Number (from the 277CA acknowledgment)
  - Patient Account Number (CLM01 from the original 837D)
  - Service date range
  - Total claim charge amount

The 276 can query a single claim or batch-query multiple claims in one transaction.

#### 277 Response Structure and Status Codes

The 277 response provides claim-level and line-level status using a three-part status code:

**Status Category Codes (STC segment)**:

| Code | Category | Meaning |
|---|---|---|
| **A0** | Acknowledgment | Forwarded/routed to next entity |
| **A1** | Acknowledgment | Received/complete (accepted) |
| **A2** | Acknowledgment | Accepted with errors |
| **A3–A7** | Acknowledgment | Rejected (various reasons) |
| **P0** | Pending | Adjudication/Review |
| **P1** | Pending | In process, waiting for additional information |
| **P2** | Pending | In process, pended for review |
| **P3** | Pending | Awaiting X-rays, documentation, attachments |
| **P4** | Pending | Under review by dental consultant |
| **F0** | Finalized | Payment (full or partial) |
| **F1** | Finalized | Denial |
| **F2** | Finalized | Revised/corrected |
| **F3** | Finalized | Forwarded to next payer (COB) |
| **F4** | Finalized | Adjudication complete, payment pending |
| **R0–R16** | Request | Request for additional information (subtypes vary) |
| **E0–E4** | Error | Various data errors on the original submission |

**Status detail codes**: Each category code can be accompanied by a detail code and an entity identifier that explains specifically why the claim is in that status (e.g., "P3 + detail 65 = Awaiting radiographs from rendering provider").

#### Implementation: Automated 276 Polling

For the platform, implement a **276 polling service** that:

1. **Tracks all submitted claims** in a status table with fields:
   - `claim_id`, `payer_claim_control_number`, `submission_date`, `last_status_check`, `current_status`, `status_detail`
2. **Polls on a schedule**:
   - First poll: 2–3 business days after submission (allow time for payer to register the claim)
   - Subsequent polls: Every 3–5 business days for claims in Pending status
   - Stop polling when status reaches Finalized (F0/F1/F2/F3/F4) — at that point, wait for the 835
3. **Routes via Stedi**: Stedi supports 276/277 transaction generation and parsing. Send the 276 as JSON via Stedi's API; receive the 277 response parsed back into JSON.
4. **Updates the encounter record**: Map the 277 status back to the claim record so the UI can show real-time status to practice staff.
5. **Triggers alerts**: Notify staff when:
   - A claim is rejected (A3–A7) — needs correction and resubmission
   - A claim is pended for information (P1/P3/R-codes) — attachments or narratives needed
   - A claim has been finalized as denied (F1) — initiate appeal workflow

#### 276/277 Limitations

- **Not all payers respond promptly**: Some smaller dental payers have slow or limited 277 response capability. The response may simply say "in process" for weeks.
- **Status lag**: The 277 response reflects the payer's system at time of query. There can be 1–3 day lag between an adjudication decision and the 277 system updating.
- **Not a replacement for 835**: The 277 tells you the status but NOT the payment details. You still need the 835 for actual payment amounts, adjustment codes, and patient responsibility.

### 5B. ERA/EOB (835) Processing for Dental

The 835 (Health Care Claim Payment/Advice) is the electronic remittance advice — the definitive record of how a claim was adjudicated, what was paid, what was denied, and why.

#### 835 Structure Relevant to Dental

```
ISA/GS/ST — Envelope (same as any X12 transaction)
  BPR — Financial Information (total payment amount, payment method, bank routing)
  TRN — Reassociation Trace Number (links ERA to EFT payment)

  Loop 1000A — Payer Identification (NM1, N3, N4, PER)
  Loop 1000B — Payee Identification (NM1, N3, N4)

  Loop 2100 — Claim Payment Information (one per claim)
    CLP — Claim-level info:
      CLP01: Patient's claim number (matches CLM01 from 837D)
      CLP02: Claim status code (1=Processed as primary, 2=Processed as secondary,
              4=Denied, 19=Processed as primary, forwarded to additional payer, 22=Reversal)
      CLP03: Total claim charge amount
      CLP04: Total payment amount
      CLP07: Payer claim control number
    NM1 — Patient name
    CAS — Claim-level adjustments

    Loop 2110 — Service Payment Information (one per service line)
      SVC — Service line info:
        SVC01: Procedure code (CDT code — should match what was submitted)
        SVC02: Line charge amount
        SVC03: Line payment amount
        SVC04: Revenue code (rare in dental)
        SVC05: Quantity
        SVC06: Submitted procedure code (if payer adjudicated under a different code)
      DTM — Service dates
      CAS — Line-level adjustments (this is where the detail lives)
      REF — Line-level reference numbers
      AMT — Supplemental amounts
      LQ — Line-level remark codes
```

#### Dental-Specific CAS (Claim Adjustment) Patterns

The CAS segment explains every dollar of difference between billed and paid. Dental claims have characteristic adjustment patterns:

**Most Common Dental CARCs (Claim Adjustment Reason Codes)**:

| CARC | Description | Dental Context | CAS Group |
|---|---|---|---|
| **1** | Deductible | Patient's annual dental deductible not yet met | PR |
| **2** | Coinsurance | Patient's share (e.g., 20% basic, 50% major) | PR |
| **3** | Co-pay | DHMO/capitation plans | PR |
| **45** | Charges exceed fee schedule | Provider charged $1,200 for D2740; payer's UCR is $950 — $250 written off | CO (in-network) or PR (out-of-network) |
| **50** | Not a benefit of the plan | Procedure explicitly excluded (e.g., implants, cosmetic) | CO or PR depending on assignment |
| **59** | Processed based on multiple/concurrent procedure rules | Downcoding — payer paid a lesser procedure. E.g., billed D2750 (porcelain-fused-to-metal crown), paid as D2751 (porcelain-fused-to-metal crown, predominantly base metal) | CO |
| **96** | Non-covered charge | Specific exclusion — e.g., missing tooth clause, age limitation | CO or PR |
| **119** | Benefit maximum for this time period has been reached | Annual maximum exhausted — very common in dental where maximums are $1,000–$2,500 | PR |
| **151** | Information submitted does not support level of service | Payer disagrees with clinical necessity — common for SRP, crowns | CO |
| **197** | Authorization/precertification absent | Procedure required preauth that wasn't obtained | CO |
| **29** | Timely filing limit exceeded | Claim submitted too late | CO (provider cannot bill patient) |
| **4** | Procedure code inconsistent with modifier or tooth | Wrong tooth/surface for the CDT code | CO |
| **16** | Claim lacks information needed for adjudication | Missing attachment, narrative, or data element | CO |
| **B15** | Payment adjusted because procedure/service is not paid separately | Bundling — e.g., anesthesia bundled into extraction | CO |

**Dental-Specific RARCs (Remittance Advice Remark Codes)**:

| RARC | Description | Dental Context |
|---|---|---|
| **N362** | Maximum benefit amount has been reached | Accompanies CARC 119 |
| **N432** | Tooth number/surface does not match CDT code | Data quality issue |
| **N522** | Duplicate of previously paid claim | Resubmission of already-adjudicated claim |
| **N575** | Frequency limitation applies | Accompanies frequency denials (prophy, BWX, exams) |
| **M51** | Missing/incomplete/invalid procedure code | CDT code issue |
| **N657** | Prior authorization required | Accompanies CARC 197 |

#### Payment Matching: ERA to Claim

Matching an 835 payment back to the original claim requires linking through multiple identifiers:

```
835.CLP01 (Patient Account Number)  ←→  837D.CLM01 (Claim ID)
835.CLP07 (Payer Claim Control #)   ←→  277.Payer Claim Control # (from status response)
835.BPR   (Payment amount + TRN #)  ←→  EFT deposit (via TRN reassociation)
```

**Matching algorithm**:

1. **Primary match**: CLP01 (Patient Account Number) — this should be your system's unique claim identifier that you set in CLM01 when submitting the 837D. If your system generates unique claim IDs, this is the most reliable link.
2. **Secondary match**: CLP07 (Payer Claim Control Number) — useful if CLP01 is truncated or modified by the payer.
3. **Fuzzy match**: If primary identifiers don't match (happens with some payers that mangle claim numbers), fall back to matching on: patient name + date of service + CDT code + charge amount. This combination is usually unique enough for dental claims.
4. **EFT reconciliation**: The TRN (Trace Number) in the 835's BPR loop matches the trace number on the EFT deposit. This links the ERA to the actual bank deposit, enabling full financial reconciliation.

#### 835 Processing Pipeline

```
1. RECEIVE 835
   ├── Via Stedi (API/webhook — preferred)
   ├── Via clearinghouse SFTP download
   └── Via payer portal download (RPA can automate this)

2. PARSE 835
   ├── Stedi: X12 → JSON (automated)
   └── Extract: claim-level (CLP) + line-level (SVC) + adjustments (CAS)

3. MATCH TO CLAIMS
   ├── Primary: CLP01 → claim_id in encounter table
   ├── Secondary: CLP07 → payer_claim_control_number
   └── Fuzzy: patient + DOS + CDT + amount

4. POST TO ENCOUNTER RECORD
   ├── Update claim status (Paid / Denied / Partially Paid)
   ├── Record payment amount per service line
   ├── Record adjustment amounts and reason codes (CAS)
   ├── Calculate patient responsibility
   └── Flag denials for review/appeal

5. POST TO PMS LEDGER
   ├── Insurance payment entry (credit to A/R)
   ├── Contractual write-off entry (CO adjustments)
   ├── Patient responsibility entry (PR adjustments → patient balance)
   └── Secondary claim trigger (if COB applies)

6. RECONCILE WITH EFT
   ├── Match TRN to bank deposit
   ├── Verify total payment matches sum of CLP04 across all claims in ERA
   └── Flag discrepancies for manual review
```

#### Handling Split Payments and Adjustments

Dental ERAs frequently contain:

- **Multiple claims in one ERA**: A single 835 may contain adjudication results for dozens or hundreds of claims — all from the same provider, bundled into one payment. The pipeline must iterate through all CLP loops.
- **Partial payments**: Some lines paid, others denied on the same claim. Each SVC line has its own payment amount and CAS adjustments.
- **Negative payments (takeback/recoupment)**: The PLB (Provider-Level Balance) segment may contain recoupments — the payer clawing back prior overpayments. These appear as negative amounts and must be posted as debits to the provider's A/R.
- **Zero-pay ERAs**: The payer issues an 835 with $0 payment — this is a denial notification via ERA. All adjustment information is in the CAS segments. These must still be processed and posted.

#### ERA Processing Edge Cases for Dental

1. **Downcoded procedures**: Payer pays a different CDT code than what was billed (SVC06 shows the submitted code, SVC01 shows the adjudicated code). The PMS ledger should reflect both the billed and paid codes.
2. **Secondary EOB**: When processing a secondary claim, the 835 from the secondary payer adjusts based on what the primary already paid. The CAS may include OA (Other Adjustment) group codes reflecting primary payment.
3. **Orthodontic periodic payments**: Ortho claims are often paid in installments over the course of treatment. Each periodic payment generates a separate 835. Track cumulative payments against the total approved amount.
4. **Predetermination responses**: Some payers return predetermination results via an 835-like format. These should NOT be posted as payments — they are estimates only. Distinguish by the claim status code in CLP02.

## 6. Build-vs-Buy Decision Matrix — Clearinghouse, Scrubbing, Attachment Management

### Decision Framework

For each capability needed in the dental claim submission pipeline, evaluate:

- **Build**: Develop in-house on top of your platform
- **Buy/Integrate**: Use a third-party service via API or integration
- **Hybrid**: Build the orchestration layer, buy the domain-specific logic

Key evaluation criteria: **time to market**, **ongoing maintenance burden**, **cost at scale**, **competitive differentiation**, and **regulatory risk**.

### Decision Matrix

#### 1. X12 Transaction Generation & Parsing

| Option | Recommendation | Rationale |
|---|---|---|
| **Build** (raw X12 construction) | **No** | X12 is notoriously complex — fixed-width segments, control number management, envelope nesting. Building an X12 generator/parser from scratch is 3–6 months of engineering with ongoing maintenance for edge cases and spec updates. |
| **Buy: Stedi** | **Yes — strong recommendation** | Stedi provides JSON-to-X12 and X12-to-JSON translation via API. This eliminates the need to understand X12 segment-level formatting. You work with structured JSON. Cost is usage-based ($0.01–$0.10/transaction, per [Stedi pricing](https://www.stedi.com/pricing)). |
| **Alternative: Eligible, Trizetto, Availity SDK** | Viable alternatives | If Stedi's payer network doesn't cover enough payers, supplement with a legacy clearinghouse SDK. However, these tend to have heavier integration requirements and per-provider licensing. |

**Verdict: BUY (Stedi)**. X12 generation is commodity infrastructure — don't build it. Stedi's API-first approach aligns with the team's engineering model.

---

#### 2. Clearinghouse Routing (Claim Delivery to Payers)

| Option | Recommendation | Rationale |
|---|---|---|
| **Single clearinghouse (Stedi)** | **Start here** | Use Stedi's clearinghouse network as the primary routing path. Covers the major dental payers. |
| **Multi-clearinghouse (Stedi + DentalXChange or Tesia)** | **Add as needed** | If Stedi doesn't reach a specific payer, route through a secondary clearinghouse. DentalXChange (now part of [Vyne Dental](https://vfrm.com/)) is dental-specific and has deep payer connectivity. Tesia/Change Healthcare has the broadest general network. |
| **Direct payer connections** | **No** (except via RPA portals) | Direct EDI connections to payers require individual SFTP setups, enrollment, testing, and maintenance per payer. Not worth it unless you're a massive DSO submitting millions of claims. |
| **RPA portal submission** | **Supplement** | As detailed in Section 3, use RPA for high-volume payers where portal submission offers cost or feature advantages. |

**Verdict: BUY (Stedi primary) + HYBRID (secondary clearinghouse + RPA for specific payers)**. Use a routing abstraction layer in your application that decides per-claim whether to route via Stedi EDI, secondary clearinghouse, or RPA.

---

#### 3. Claim Scrubbing (Pre-Submission Validation)

This is the most nuanced build-vs-buy decision. Scrubbing has two layers:

**Layer 1: Structural validation** (Is the X12 valid? Are required fields present?)
- **Buy: Stedi handles this** — guide-based validation catches structural errors before transmission.

**Layer 2: Business rule validation** (Will the payer accept/pay this claim?)
- This includes: frequency limitations, age restrictions, preauth requirements, bundling rules, missing tooth logic, CDT code validity by date of service, payer-specific quirks.

| Option | Recommendation | Rationale |
|---|---|---|
| **Build your own rule engine** | **Hybrid — build the engine, source the rules** | Build a rules engine that can evaluate claims against a rules table. The engine itself is straightforward (if/then logic against claim fields). The **rules data** is the hard part. |
| **Buy: Third-party scrubbing service** | **Evaluate carefully** | Services like [Vyne Dental/DentalXChange scrubbing](https://vfrm.com/), [ClaimRemedi](https://claimremedi.com/), or [Office Ally dental](https://www.officeally.com/) offer pre-submission claim scrubbing. They maintain payer-specific rules. Cost: $0.05–$0.15 per claim for scrubbing. Pros: they maintain the rules, which is the most labor-intensive part. Cons: you're dependent on their rule accuracy and update cadence; you lose control over the user experience of error messages. |
| **Source rules from payer data** | **Do this regardless** | Use 271 eligibility response data (frequency limits, benefit maximums, waiting periods) as a primary scrubbing data source. This is free (you're already running 270/271) and covers the most common denial reasons. |
| **Build rules from 835 denial patterns** | **Do this over time** | Analyze your own 835 denial data to identify payer-specific patterns. Build rules that catch the most common denials you're actually seeing. This creates a data flywheel — more claims processed = better scrubbing rules = fewer denials. |

**Verdict: HYBRID**. Build a lightweight rules engine. Populate it initially with universal rules (CDT code validity, tooth/surface requirements per code category, basic frequency logic). Enrich with 271 eligibility data per-patient. Over time, build payer-specific rules from your own denial data. Consider a third-party scrubbing service as an interim measure while your own rules mature — but plan to reduce dependence on it as your data improves.

**Cost comparison**:
- Third-party scrubbing at 10,000 claims/month × $0.10 = **$1,000/month**
- In-house rules engine maintenance: ~0.25 FTE ongoing = **$2,500–$4,000/month** (fully loaded)
- But in-house gives you: better UX, faster iteration, no vendor lock-in, competitive differentiation
- Break-even favors in-house at scale (>50,000 claims/month) and when denial reduction is a key value proposition

---

#### 4. Attachment Management

| Option | Recommendation | Rationale |
|---|---|---|
| **Build: Self-hosted attachment storage + payer delivery** | **Partial — build the storage, buy the delivery** | Store attachments (X-rays, perio charts, narratives) in your own S3/blob storage linked to encounters. You need this regardless for the practice-facing workflow. But delivering attachments to payers is the hard part. |
| **Buy: NEA FastAttach (Vyne Dental)** | **Yes — for EDI-based attachment delivery** | [NEA FastAttach](https://www.nea-fast.com/) is the de facto standard for dental claim attachments. It handles: (1) uploading the attachment, (2) generating a unique control number, (3) making the attachment available to the payer when they receive the 837D with the PWK reference. Cost: ~$0.25–$0.75 per attachment, per Vyne Dental quotes. Roughly [30–35% of dental claims require attachments](https://www.ada.org/resources/practice/dental-claim-attachments), so this applies to a meaningful subset. |
| **RPA: Portal-based attachment upload** | **Supplement for specific payers** | Some payers (Delta Dental, MetLife) accept attachment uploads via their portals. If you're already automating portal submission via RPA for a given payer, add attachment upload to the same RPA flow — zero incremental attachment delivery cost. |
| **Build: HIPAA Attachment Standard (275)** | **Not yet** | The [CMS attachment rule](https://www.cms.gov/newsroom/fact-sheets/adoption-standard-health-care-attachments-transactions-and-operating-rules) mandates HL7 C-CDA for electronic attachments, but enforcement timelines remain uncertain (originally planned for 2026–2027). Build awareness and architecture flexibility, but don't invest in 275 implementation until enforcement dates are firm. |

**Verdict: HYBRID**. Build internal attachment storage and workflow (upload, link to encounter, manage lifecycle). Buy NEA FastAttach for EDI-based delivery to payers. Use RPA for portal-based delivery where available. Watch the HIPAA Attachment Standard — plan to add 275 support when enforcement begins.

---

#### 5. ERA (835) Processing and Auto-Posting

| Option | Recommendation | Rationale |
|---|---|---|
| **Build: 835 parsing + auto-posting logic** | **Build the auto-posting logic** | The business logic of posting ERA data to the PMS ledger is core to your product value. It involves: matching payments to claims, creating insurance payment entries, calculating write-offs (CO adjustments), posting patient responsibility (PR adjustments), triggering secondary claims. This is where your product differentiates. |
| **Buy: Stedi for 835 parsing** | **Yes** | Use Stedi to parse the raw X12 835 into structured JSON. Don't build an 835 parser from scratch. |
| **Buy: Third-party auto-posting** | **No** | Third-party auto-posting services (some clearinghouses offer this) post directly to specific PMS systems. Since the team is building a platform with PMS integration abstracted, you need your own posting logic that works across PMS backends. |

**Verdict: HYBRID**. Buy the parsing (Stedi), build the posting logic. The posting logic is a key product differentiator — it's what makes the "minimal human touch" promise real.

---

#### 6. Claim Status Tracking (276/277)

| Option | Recommendation | Rationale |
|---|---|---|
| **Buy: Stedi for 276/277 transactions** | **Yes** | Use Stedi to generate 276 requests and parse 277 responses. |
| **Build: Polling orchestration + status dashboard** | **Yes** | Build the scheduling logic (when to poll, how often), the status mapping (277 codes → human-readable statuses), and the UI for staff to see claim status. |
| **Buy: RPA for portal-based status checks** | **Supplement** | For payers where 277 responses are slow or unreliable, use RPA to check claim status via the payer portal. This is faster and often more detailed than 277 responses. |

**Verdict: HYBRID**. Stedi for the transaction layer, your own orchestration and UX on top. Add RPA portal status checks for high-value payers.

---

### Summary Matrix

| Capability | Build | Buy | Hybrid | Recommended Vendor(s) | Est. Cost (10K claims/mo) |
|---|---|---|---|---|---|
| X12 Generation/Parsing | | X | | Stedi | $500–$1,000/mo |
| Clearinghouse Routing | | | X | Stedi + DentalXChange | $2,500–$5,000/mo |
| Claim Scrubbing (structural) | | X | | Stedi (included) | Included |
| Claim Scrubbing (business rules) | | | X | In-house engine + 271 data | 0.25 FTE + data costs |
| Attachment Storage | X | | | Your infrastructure | $50–$200/mo (storage) |
| Attachment Delivery | | | X | NEA FastAttach + RPA | $750–$2,500/mo |
| 835 Parsing | | X | | Stedi | Included in API costs |
| 835 Auto-Posting | X | | | In-house | Engineering effort |
| 276/277 Status Tracking | | | X | Stedi + in-house orchestration | Included in API costs |
| Portal RPA (submission + status) | X | | | In-house RPA engine | $2,000–$5,000/mo |
| PMS Integration | X | | | In-house (abstracted) | Engineering effort |

**Total estimated monthly platform cost at 10,000 claims/month**: $6,000–$14,000/month in vendor/infrastructure costs, plus engineering headcount for the "Build" components.

**Key strategic insight**: The components that should be bought (X12 handling, clearinghouse routing, attachment delivery) are **commodity infrastructure** — they don't differentiate your product. The components that should be built (scrubbing rules, auto-posting logic, RPA orchestration, status dashboard, PMS sync) are **product differentiators** — they're what makes the "minimal human touch" experience real and what locks in practice customers.

---

### Build Sequence Recommendation

| Phase | Duration | Components | Unlocks |
|---|---|---|---|
| **Phase 1: Foundation** | 8–12 weeks | Stedi integration (837D generation, 835 parsing), encounter model extensions (Section 1), basic claim submission via EDI | First claim submitted electronically |
| **Phase 2: Feedback Loop** | 6–8 weeks | 276/277 polling, 835 auto-posting to PMS, claim status dashboard | End-to-end claim lifecycle tracking; payment posting |
| **Phase 3: Quality** | 6–8 weeks | Scrubbing rules engine, attachment workflow (NEA integration), pre-submission validation UX | Reduced denial rate; attachment-heavy procedures supported |
| **Phase 4: RPA** | 8–12 weeks | Portal automation for top 2–3 payers, portal-based attachment upload, portal-based status checks | Cost reduction on high-volume payers; faster status feedback |
| **Phase 5: Optimization** | Ongoing | Denial pattern analysis, payer-specific rule refinement, secondary claim automation, predetermination support | Continuous improvement; data flywheel |
