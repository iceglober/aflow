# Problem Definition: Dental Claim Submission

## Problem Statement

Dental office managers lose $23,400/month in revenue because 65% of denied insurance claims are never resubmitted -- the staff doesn't exist to rework them, and the manual process of creating claims, collecting attachments, and routing to the correct payer is too slow and error-prone for the people they do have.

## Target User

**Office manager at a general dental practice (1-3 dentists, 2-5 admin staff)** within the channel partner's 11k-practice CRM base. This person is responsible for insurance billing but is not a certified coder. They juggle billing alongside scheduling, patient intake, and front-desk duties. They currently create claims manually in the PMS, upload attachments by hand, and lose track of which claims were denied and why. 70%+ of practices report admin recruitment as "extremely challenging" -- this person is overloaded and unlikely to get help.

## Success Metric

**First-pass acceptance rate above 90% within 90 days of activation**, measured as the percentage of claims accepted by the payer on initial submission (no rework, no resubmission). Industry norm is 80-85%. Best-in-class is 95-98%. Hitting 90% proves the system's validation, attachment automation, and payer routing are working -- and directly reduces the denial volume that creates the revenue leakage problem.

## Scope

### In Scope

| Capability | Why |
|---|---|
| Auto-generate 837D claims from PMS appointment data | Eliminates the manual claim creation step -- no competitor does this |
| Validate claims against CDT code rules, payer-specific requirements, and bundling/frequency logic | 53% of denials stem from incomplete information or incorrect codes -- catchable before submission |
| Auto-collect and attach required documentation (x-rays, perio charts, narratives) from PMS imaging | Missing attachments cause 18% of denials and cost $10.81/claim to handle manually vs. $0.84 electronically |
| Submit via EDI (Stedi, 345 dental payers) with RPA fallback for non-EDI payers | Guarantees delivery to any payer; no competitor covers 100% of payers |
| Coordination of benefits sequencing for secondary claims | COB errors cause 6% of denials; birthday rule and sequencing logic are well-defined |
| Embedded in channel partner CRM (iframe) | Zero new software for the practice; activation is a switch flip by the partner |

### Out of Scope

| Exclusion | Why |
|---|---|
| Eligibility verification | Already exists as a separate product on the platform; different workflow, different data |
| Claim status tracking (277) and ERA/payment posting (835) | Post-submission lifecycle is a separate product surface; adding it bloats scope without improving first-pass acceptance |
| Pre-treatment estimates / predeterminations | Voluntary workflow unrelated to claim submission accuracy; different user intent (treatment planning vs. billing) |
| Denial management and appeals | Downstream of submission; the goal is to prevent denials, not manage them |
| Patient billing and collections | Different user (patient vs. payer), different compliance rules, different product |
| Eaglesoft and Dentrix PMS integration | Henry Schein owns 70% of eAssist (largest dental billing outsourcer); channel conflict makes these integrations risky as a launch priority. Open Dental first. |

## Non-Goals

| Non-Goal | Reasoning |
|---|---|
| Replace the billing outsourcer | We automate claim creation and submission, not the full RCM cycle. Practices that outsource 100% of billing (15-25% of market) are not the target user. |
| Real-time adjudication | Only Tesia/Vyne offers this via proprietary payer integrations built over decades. Not reproducible, and not required to solve the first-pass acceptance problem. |
| ML-based denial prediction | Requires claim outcome training data we don't have yet. First-pass rules-based validation gets us from 80% to 90%+ acceptance. ML is a future layer on top of a working submission pipeline. |
| Print-and-mail fallback | RPA covers non-EDI payers without physical mail. The 14% of claims still submitted on paper are a shrinking segment we don't need to serve at launch. |
| PMS write-back of adjudication results | Useful but depends on claim status tracking (out of scope). Write-back of submission confirmation is in scope; write-back of payment data is not. |
