---
name: writing-skills
description: Use when creating new skills, editing existing skills, or verifying skills work before deployment
---

# Writing Skills

## Overview

**Writing skills IS Test-Driven Development applied to process documentation.**

You write test cases (pressure scenarios with subagents), watch them fail (baseline behavior), write the skill (documentation), watch tests pass (agents comply), and refactor (close loopholes).

**Core principle:** If you didn't watch an agent fail without the skill, you don't know if the skill teaches the right thing.

## TDD Mapping for Skills

| TDD Concept | Skill Creation |
|-------------|----------------|
| **Test case** | Pressure scenario with subagent |
| **Production code** | Skill document (SKILL.md) |
| **Test fails (RED)** | Agent violates rule without skill (baseline) |
| **Test passes (GREEN)** | Agent complies with skill present |
| **Refactor** | Close loopholes while maintaining compliance |

## The Iron Law

```
NO SKILL WITHOUT A FAILING TEST FIRST
```

Write skill before testing? Delete it. Start over.
Edit skill without testing? Same violation.

## SKILL.md Structure

**Frontmatter (YAML):**
- `name` and `description` required (max 1024 chars total)
- `description`: Start with "Use when..." — triggering conditions ONLY
- **NEVER summarize the skill's process or workflow in description** (Claude may follow description instead of reading skill body)

## RED-GREEN-REFACTOR for Skills

### RED: Write Failing Test (Baseline)
Run pressure scenario with subagent WITHOUT the skill. Document exact behavior:
- What choices did they make?
- What rationalizations did they use (verbatim)?

### GREEN: Write Minimal Skill
Write skill that addresses those specific rationalizations. Don't add extra content for hypothetical cases.
Run same scenarios WITH skill. Agent should now comply.

### REFACTOR: Close Loopholes
Agent found new rationalization? Add explicit counter. Re-test until bulletproof.

## Bulletproofing Against Rationalization

### Close Every Loophole Explicitly
Don't just state the rule — forbid specific workarounds.

### Build Rationalization Table
Every excuse agents make goes in the table:
```markdown
| Excuse | Reality |
|--------|---------|
| "Too simple to test" | Simple code breaks. Test takes 30 seconds. |
```

### Create Red Flags List
```markdown
## Red Flags — STOP
- [pattern that signals about to violate]
```

## Token Efficiency

- Getting-started workflows: <150 words
- Frequently-loaded skills: <200 words
- Other skills: <500 words
- Cross-reference instead of repeat
- Move details to tool help

## Persuasion Principles for Skills

**Authority + Commitment + Social Proof** for discipline-enforcing skills.
- Imperative language: "YOU MUST", "Never", "Always", "No exceptions"
- Require announcements and explicit choices
- Universal patterns: "Every time", "Always"

See persuasion-principles.md for full research foundation.

## Skill Creation Checklist

**RED Phase:**
- [ ] Create pressure scenarios (3+ combined pressures)
- [ ] Run WITHOUT skill — document baseline failures verbatim
- [ ] Identify patterns in rationalizations

**GREEN Phase:**
- [ ] YAML frontmatter with `name` and `description` (starts with "Use when...")
- [ ] Description has NO workflow summary
- [ ] Address specific baseline failures
- [ ] Run WITH skill — verify compliance

**REFACTOR Phase:**
- [ ] Identify NEW rationalizations
- [ ] Add explicit counters
- [ ] Build rationalization table
- [ ] Create red flags list
- [ ] Re-test until bulletproof

## Testing methodology

See testing-skills-with-subagents.md for pressure scenarios, pressure types, and meta-testing.
See persuasion-principles.md for research on authority, commitment, scarcity principles.
See anthropic-best-practices.md for official Anthropic skill authoring guidance.
