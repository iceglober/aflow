# Acceptance Criteria: Dental Claim Submission

---

## Definition of Done

All must be true before we call this shipped:

- [ ] Claims auto-generate from PMS appointment data and submit to payers without manual data entry by the office manager
- [ ] Required attachments (x-rays, perio charts, narratives) are auto-collected from PMS imaging and included at submission
- [ ] Pre-submission validation catches incomplete information, incorrect CDT codes, bundling conflicts, and frequency limit violations before claims leave the system
- [ ] Claims reach any payer -- EDI for the 345 payers on Stedi, RPA fallback for all others
- [ ] Secondary claims include primary payer adjudication data and sequence correctly per COB rules
- [ ] The entire workflow runs inside the channel partner CRM (iframe) -- zero new software for the practice
- [ ] Pilot practices confirm the office manager can review and submit a day's claims in under 5 minutes
- [ ] No claim that passes pre-submission validation is structurally rejected (999) by the clearinghouse

---

## Tier 1: Launch Gate

Binary pass/fail. All must pass before activation with production practices.

| # | Gate | Pass condition |
|---|---|---|
| 1 | Claims generate from PMS data | Office manager sees auto-generated claims from completed appointments with no manual data entry required |
| 2 | Attachments included when PMS has them | Zero claims rejected for missing attachments (CARC 252) when the imaging data exists in the PMS |
| 3 | Payer routing works | Claims reach the correct payer entity -- including Delta Dental state-specific routing (39 entities) and BCBS alpha-prefix resolution |
| 4 | EDI + RPA coverage | Claims submit successfully via EDI (Stedi) and via RPA for at least 3 non-EDI payer portals used by pilot practices |
| 5 | No structural rejections on validated claims | 999 rejection rate is 0% for claims that pass pre-submission validation |
| 6 | COB sequencing correct | Secondary claims are held until primary ERA data is available; no CARC 22/289 rejections from incorrect COB ordering |
| 7 | Validation catches preventable errors | Pre-submission validation flags incomplete patient info, incorrect CDT codes, frequency violations, and bundling conflicts -- the top 4 denial categories (53% of all denials) |
| 8 | Office manager stays in CRM | Entire review-and-submit workflow completes inside the partner CRM iframe without context-switching to PMS or payer portal |
| 9 | Human approval required | No claim submits without explicit office manager review and batch approval |
| 10 | Timely filing alerts active | System warns at 30-day and 14-day thresholds for 90-day payers; 60-day and 30-day thresholds for 12-month payers |

---

## Tier 2: Success Criteria

Measured post-launch. These prove the product works.

| # | Metric | Target | Timeframe | Baseline | Source |
|---|---|---|---|---|---|
| 1 | First-pass acceptance rate | > 90% | Within 90 days of activation | 80-85% industry norm | research-benchmarks.md 1.1 |
| 2 | Denial rate | < 15% | Within 90 days of activation | 15-20% industry norm (19.3% median) | research-benchmarks.md 1.2 |
| 3 | Revenue recovered from prevented denials | > $16,000/month reduction in denial-related revenue loss | Within 90 days of activation | $23,400/month lost to denials | research-benchmarks.md 4.4 |
| 4 | Office manager time-on-task | < 5 minutes per daily batch | Within 30 days of activation | [DATA NEEDED -- baseline manual time per batch from pilot] |
| 5 | Denial management staff time | < 3 hrs/week | Within 90 days of activation | 7.5 hrs/week industry norm | research-benchmarks.md 4.4 |
| 6 | Days to payment (clean claims) | < 25 days | Within 90 days of activation | 30-32 days industry norm; 18 days best-in-class | research-benchmarks.md 2.4 |
| 7 | Attachment-related denials | < 2% of claims requiring attachments | Within 90 days of activation | 18% of denials caused by missing/insufficient documentation | research-benchmarks.md 1.2 |
| 8 | Practices activated through channel partner | > 50 practices | Within 6 months of launch | 0 (new product) | [DATA NEEDED -- partner activation target] |

---

## Tier 3: Quality Bar

Ongoing standards the product must maintain after launch.

| # | Standard | Threshold | Monitoring |
|---|---|---|---|
| 1 | First-pass acceptance rate does not regress | Stays above 90% on rolling 30-day basis | Weekly metric review |
| 2 | Claim processing cost stays below electronic benchmark | < $2.90 per claim (industry norm for electronic submission) | Monthly cost review |
| 3 | Attachment cost stays below electronic benchmark | < $0.84 per attachment (vs. $10.81 manual/paper) | Monthly cost review |
| 4 | RPA fallback reliability | > 95% successful submission rate for non-EDI payers | Weekly per-payer success rate |
| 5 | Auto-fix rate for structural errors | > 90% of auto-fixable errors resolved without surfacing to staff | Monthly review of correction queue volume |
| 6 | Validation false positive rate | < 5% of flags are overridden by office manager and accepted by payer on first pass | Monthly review -- high override-then-accept rate means the rule is wrong |
| 7 | Zero data loss | No claim data lost between PMS extraction and payer submission | Continuous -- reconciliation audit trail |
| 8 | Payer routing accuracy | > 99% of claims routed to correct payer entity on first attempt | Weekly payer-level rejection analysis |

---

*Generated 2026-04-01. Sources: problem.md, prd.md, research-benchmarks.md.*
