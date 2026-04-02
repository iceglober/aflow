# Dental Claim Submission — Technical Research (Codebase Scan)

## Scan Target

Repository: `aflow-wt-feature-product-skills` (`/Users/iceglobe/repos/aflow-wt-feature-product-skills`)

## Finding: Wrong Codebase

This repository is `aflow` — an AI-native development workflow CLI that manages worktrees, tasks, and Claude Code skills. It does not contain the dental claims platform, RPA framework, Stedi integration, HITL web app, or channel partner API integration referenced in the discovery document and PRD.

The product documentation artifacts (`docs/product/dental-claim-submission/discovery.md` and `docs/product/dental-claim-submission/prd.md`) are stored here as outputs of aflow's product skills, but they describe a platform that lives in a separate repository.

## What This Repo Contains

- CLI entry point and command router (`src/index.ts`)
- Git worktree management commands (`src/commands/create.ts`, `checkout.ts`, `list.ts`, `delete.ts`, `cleanup.ts`)
- Task state management (`src/lib/state.ts`, `src/commands/state/`)
- Pipeline orchestrator for Claude Code skill sequencing (`src/lib/pipeline.ts`, `src/lib/session-runner.ts`)
- Claude Code skills for development workflow (`src/skills/` — think, work, fix, qa, ship, spec-*, research-*)
- Product documentation skills (`src/skills/product-discovery-new.ts`, `product-discovery-refine.ts`, `product-discovery-user.ts`, `product-pipeline.ts`, `product-prd-new.ts`, `product-prd-refine.ts`)
- Stack: Bun, TypeScript (ESM), cmd-ts, @anthropic-ai/claude-agent-sdk

## Capability Scan Results

| Capability | Status | Evidence |
|-----------|--------|----------|
| RPA framework | NOT FOUND | No RPA-related code in this repo |
| Stedi eligibility integration | NOT FOUND | No Stedi client, API calls, or EDI code in this repo |
| Stedi 837D claim submission | NOT FOUND | No 837D generation or X12 code in this repo |
| Stedi 275 attachment submission | NOT FOUND | No attachment pipeline code in this repo |
| HITL web app | NOT FOUND | No web application code in this repo |
| Channel partner API integration | NOT FOUND | No partner API or webhook code in this repo |
| PMS integration (Open Dental) | NOT FOUND | No PMS client or database query code in this repo |
| PMS integration (Eaglesoft) | NOT FOUND | No Eaglesoft-related code in this repo |
| Payer routing logic | NOT FOUND | No payer directory or routing code in this repo |
| CDT code validation | NOT FOUND | No CDT code or dental procedure logic in this repo |
| COB handling | NOT FOUND | No coordination of benefits logic in this repo |
| Claim data model | NOT FOUND | No claim-related data models in this repo |
| 837D/X12 serialization | NOT FOUND | No X12 segment generation in this repo |
| Attachment processing | NOT FOUND | No image conversion or attachment handling in this repo |
| Payer-specific rules engine | NOT FOUND | No payer rules or validation engine in this repo |

## What Exists (from discovery doc, not from code)

The discovery document (`docs/product/dental-claim-submission/discovery.md`) describes these as existing capabilities on the actual platform:

- Production HITL web app (embedded iframe in partner CRM)
- Generative RPA engine with 20+ payer portal workflows (eligibility)
- Stedi integration for eligibility (EDI)
- Stedi 837D support for 345 dental payers
- Channel partner with dental CRM, 11k practices, API integration
- AI-powered payer mapping pipeline
- Live Open Dental instance access (one practice, via Tailscale)
- Provider data: TIN and practice name only

These claims cannot be verified from this codebase. The platform code must be scanned separately.

## Action Required

To complete this technical research, the scan must be run against the repository containing the actual platform code (RPA engine, Stedi integration, HITL web app, partner API). The repository path was not provided and is not discoverable from this codebase.

---

*Generated 2026-04-01. Scanned repository: aflow-wt-feature-product-skills. Result: no dental claim submission capabilities found — wrong codebase.*
