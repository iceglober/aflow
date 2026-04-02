# Engineering Handoff: Dental Claim Submission

**Date**: 2026-04-01
**From**: Product
**To**: Head of Engineering
**Context**: We are building an automated dental claim submission system embedded in a channel partner's CRM (11k practices). Claims are generated from PMS data, validated, and submitted via Stedi EDI (345 payers) with RPA fallback for non-EDI payers. This document contains every engineering question and technical blocker extracted from the product research and PRD. Nothing here has been answered -- it needs your team's investigation.

---

## A. PMS Data Access (5 questions)

**A1. How do we access PMS data at scale across 11k practices?**

Today we have a single live Open Dental instance accessible via Tailscale. The PRD requires auto-generating 837D claims from PMS appointment data across thousands of practices. What is the architecture for accessing PMS data at scale -- direct DB connections to each practice's Open Dental instance, Open Dental's REST API, or a bridge/sync service? Each approach has different latency, security, and deployment implications.

*Blocks*: All auto-claim-generation functionality. Without PMS access at scale, the product cannot generate claims.

**A2. How do we pull attachments from PMS imaging systems?**

The PRD requires auto-pulling x-rays, perio charts, and intraoral photos from the PMS imaging system. Open Dental stores imaging data in a configurable location (local filesystem, network share, or cloud). What is the technical path to accessing imaging data across practices? Is it co-located with the PMS database, or does it require a separate integration?

*Blocks*: Attachment automation (18% of denials are from missing attachments). Without this, attachments are manual.

**A3. What data does the PMS actually expose for claim generation?**

The PRD assumes PMS records contain: patient demographics, provider NPIs, CDT codes, tooth/surface data, service dates, payer name, subscriber ID, and prior auth numbers. Does Open Dental's data model contain all of these fields in a structured, queryable form? Are there fields that are free-text in the PMS but need to be structured for 837D generation?

*Blocks*: Claim generation accuracy. Missing or unstructured fields require HITL fallback or mapping logic.

**A4. What is the PMS write-back mechanism?**

The PRD requires writing submission confirmation back to the PMS so the office manager doesn't reconcile between two systems. Does Open Dental support write-back via API? What entities can be written (claim status, claim ID, submission date)? Is write-back destructive or additive?

*Blocks*: User experience requirement (office manager stays in one system).

**A5. Eaglesoft integration feasibility (future, not launch)**

Eaglesoft's schema is undocumented, its write-back mechanism is unclear, and Patterson's partner program is reportedly cost-prohibitive. If we pursue Eaglesoft later, does the 21st Century Cures Act information blocking provision give us a legal path to data access without Patterson's cooperation? This is a legal + engineering question.

*Blocks*: Nothing at launch (Open Dental first), but determines the second PMS integration path.

---

## B. Stedi EDI Integration (3 questions)

**B1. Which payers are in Stedi's 28-payer EDI 275 attachment network?**

Stedi supports EDI 275 (electronic unsolicited attachments) for only 28 dental payers. The PRD relies on EDI 275 where supported and RPA portal upload everywhere else. Which 28 payers are covered? Do they include the highest-volume payers in the partner's practice base (Delta Dental affiliates, BCBS plans, Aetna, UHC, MetLife, Cigna, Guardian)?

*Blocks*: Attachment routing logic. Determines how much attachment volume goes through EDI vs. RPA.

**B2. What is Stedi's response model for 277CA acknowledgments?**

The PRD requires claims to stay in "pending payer acknowledgment" state until 277CA arrives. How does Stedi deliver 277CA responses -- webhook, polling, or batch file? What is the typical latency? Are there payers that never return a 277CA (some small payers don't)?

*Blocks*: Claim lifecycle state machine design. Without knowing the 277CA delivery model, we cannot design the claim status pipeline.

**B3. What are Stedi's rate limits, batch sizes, and retry semantics?**

The PRD specifies Idempotency-Key headers and 24-hour deduplication windows. What are Stedi's actual rate limits for dental claim submission? What is the maximum batch size? How does Stedi handle partial batch failures? What happens if we retry after the 24-hour deduplication window -- does the payer see a duplicate?

*Blocks*: Submission pipeline throughput design. At 11k practices x 200+ claims/month, we need to understand capacity constraints.

---

## C. Payer Routing and Rules Engine (4 questions)

**C1. Where does the CDT-to-field-requirements mapping come from?**

The PRD requires validating that each CDT code has the correct fields (tooth number, surface codes, quadrant, oral cavity area). The authoritative mapping is ADA's Appendix 3 table, which is behind the ADA paywall. Two options: (1) license ADA's Appendix 3 table, or (2) build the mapping from payer companion guides. Option 1 is authoritative but has licensing cost and update cadence questions. Option 2 is free but incomplete and requires ongoing maintenance.

*Blocks*: Pre-submission validation engine. Without this mapping, we cannot validate CDT code fields before submission.

**C2. How do we maintain payer-specific routing tables?**

Delta Dental is a federation of 39 independent companies with separate payer IDs. BCBS uses 3-character alpha prefixes to route to 36+ independent plans. Payer IDs change. Who maintains these mappings -- us, Stedi, or the partner? How do we detect stale mappings before they cause claim rejections?

*Blocks*: Payer routing accuracy. Wrong payer ID = rejected or misrouted claim.

**C3. Where does frequency limitation data come from?**

The PRD requires checking frequency limitations before submission (e.g., D0120 2x/12mo, D2750 1x/tooth/60-84mo). This requires knowing: (a) the patient's benefit plan frequency rules, and (b) the patient's claim history for that procedure. Where does each data source come from -- PMS records, prior submissions through our system, eligibility responses, or payer-specific benefit plan databases?

*Blocks*: Frequency validation feature. Without claim history + benefit plan data, frequency checks are impossible.

**C4. How do we get payer-specific bundling, downcoding, and LEAT rules?**

The PRD requires flagging bundling conflicts (D2950+D2750, D4341+D4355) and downcoding risks. These rules vary by payer and change over time. Is there a structured source for these rules, or must they be built manually from payer companion guides and denial pattern analysis?

*Blocks*: Pre-submission intelligence layer. Without structured rules, we can only flag known common patterns.

---

## D. Coordination of Benefits (2 questions)

**D1. How is dual coverage detected?**

The PRD requires COB sequencing (primary vs. secondary). How does the system know a patient has dual coverage -- from the eligibility response, from PMS insurance plan data, or from the office manager flagging it manually? If from eligibility, does the existing eligibility product return secondary payer information?

*Blocks*: COB automation. Without detection, secondary claims require manual identification.

**D2. How does the system get primary payer adjudication data for secondary claims?**

The PRD requires populating Loop 2320 with primary payer's paid amounts, adjustments, and allowed amounts when submitting secondary claims. ERA/835 processing is explicitly out of scope. So where does primary adjudication data come from? Options: (a) office manager enters it manually, (b) import from PMS if the practice posts ERA data there, (c) build a minimal 835 parser just for COB data extraction. Each has different engineering cost and UX implications.

*Blocks*: Secondary claim submission. Without primary ERA data, secondary claims cannot be correctly formatted.

---

## E. RPA Submission Pipeline (2 questions)

**E1. What is the RPA coverage for dental claim submission portals?**

The existing RPA engine handles 20+ payer portal workflows for eligibility. How many of those portals also support claim submission? Claim submission forms are different from eligibility forms -- do the existing RPA workflows extend to claim submission, or do new portal-specific workflows need to be built for each payer?

*Blocks*: The "100% payer coverage" claim in the PRD. If RPA claim submission workflows don't exist yet, this is net-new RPA development per payer.

**E2. What is the RPA reliability model for claim submission?**

Eligibility checks are idempotent -- a failed RPA attempt can be retried without consequence. Claim submission is not idempotent -- a portal submission that succeeds but whose confirmation is not captured could result in duplicate claims. How does the RPA engine handle partial failures, confirmation capture, and deduplication for non-idempotent operations?

*Blocks*: RPA submission reliability. Duplicate claims cause payer rejections and provider credibility issues.

---

## F. Provider Data (2 questions)

**F1. Where does provider credentialing data come from?**

The PRD requires billing NPI (Type 2 org or Type 1 solo), rendering NPI (Type 1), taxonomy codes (1223 series for dental), and service facility addresses. The technical scan found only TIN and practice name in the current system. Who onboards this data -- the partner, the practice, or us? Is it a one-time setup per practice or ongoing maintenance?

*Blocks*: 837D generation. NPI, taxonomy, and facility address are required fields on every claim.

**F2. How do we handle provider credentialing gaps?**

The PRD mentions CARC 208 (provider not credentialed with payer) as a reactive handling case. But if a provider is not credentialed with a payer, every claim to that payer will fail. Do we verify credentialing status before submission, or submit and handle the rejection? If proactive, where does credentialing status data come from?

*Blocks*: First-pass acceptance rate. Credentialing failures are 100% preventable but require a data source.

---

## G. Attachment Processing (2 questions)

**G1. What image formats and sizes do payers accept?**

The PRD requires converting attachments to JPEG/TIFF and enforcing size limits. What are the actual format and size requirements per payer? Are they standardized (e.g., all payers accept JPEG under 5MB), or do they vary (e.g., Delta wants TIFF, Aetna wants JPEG under 2MB)?

*Blocks*: Attachment processing pipeline. Format conversion and compression logic depends on payer-specific requirements.

**G2. How do we generate treatment narratives from clinical notes?**

The PRD requires auto-generating narratives for crowns, SRP, surgical perio, and implants from clinical notes in the PMS. What do clinical notes look like in Open Dental -- structured fields, free-text, or a mix? What does a payer-acceptable narrative look like (length, content, format)? Ameritas enforces a 250-character narrative limit; other payers may differ.

*Blocks*: Narrative automation feature. Without understanding clinical note structure and payer narrative requirements, this cannot be designed.

---

## H. System Architecture (2 questions)

**H1. What is the claim data model and state machine?**

The PRD defines claim states: generated, validating, pending correction, submitted, pending payer acknowledgment, acknowledged. Claims need to track: source PMS data, generated 837D, validation results, submission method (EDI vs. RPA), payer acknowledgment (277CA), and payer claim control numbers for corrections/voids. What is the data model? Where does claim state live -- in our system, in the partner's CRM, or both?

*Blocks*: Core system design. Every feature depends on the claim data model.

**H2. What is the webhook/notification architecture with the partner CRM?**

The PRD requires sending webhook notifications to the partner CRM when a claim requires correction (exponential backoff retries, email fallback after 24 hours). What is the partner's webhook ingestion capability? What payload format do they expect? Is there an existing webhook contract from the eligibility integration?

*Blocks*: Partner integration for the correction workflow.

---

## Summary: Question Count by Priority

| Category | Questions | Blocks Launch? |
|---|---|---|
| A. PMS Data Access | 5 | Yes (A1-A4). A5 is future. |
| B. Stedi EDI Integration | 3 | Yes (all) |
| C. Payer Routing and Rules Engine | 4 | Yes (all) |
| D. Coordination of Benefits | 2 | Yes (all) |
| E. RPA Submission Pipeline | 2 | Yes (all) |
| F. Provider Data | 2 | Yes (all) |
| G. Attachment Processing | 2 | Yes (all) |
| H. System Architecture | 2 | Yes (all) |
| **Total** | **22** | **21 block launch, 1 future** |

---

*Extracted from: research-market.md, research-domain.md, research-competitive.md, research-technical.md, research-benchmarks.md, problem.md, prd.md. Generated 2026-04-01.*
