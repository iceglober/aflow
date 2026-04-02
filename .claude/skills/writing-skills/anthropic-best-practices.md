## Core Principles

**Conciseness:** Context window is a public good. Every token in SKILL.md competes with conversation history.

**Freedom levels match task fragility:**
- High-freedom: subjective tasks (code reviews) — multiple valid approaches
- Low-freedom: critical operations (migrations) — exact sequences required
- Medium-freedom: pseudocode with parameters

**Test across models:** What works for Opus may need more detail for Haiku.

## Skill Structure

**Frontmatter:**
- `name`: Max 64 chars, human-readable
- `description`: Max 1024 chars, what it does AND when to use it, third person

**Names:** Use gerund form — "Processing PDFs", "Analyzing spreadsheets"

**Descriptions:** Include triggers. "Extract text from PDF files. Use when working with PDF files or when the user mentions PDFs."

## Progressive Disclosure

1. Basic: Single SKILL.md
2. Intermediate: SKILL.md + bundled reference files
3. Complex: Domain-specific organization with directories

One-level-deep references only. For 100+ line files, include table of contents.

## Workflows

Break complex operations into checklists Claude can track:
```
- [ ] Step 1: Read sources
- [ ] Step 2: Identify themes
- [ ] Step 3: Cross-reference
```

Feedback loops: draft → review against checklist → fix → review again.

## Content Guidelines

- Avoid time-sensitive information (no dates)
- Consistent terminology throughout
- Templates for strict requirements, flexible guidance for subjective tasks
- Input/output example pairs
- Conditional workflows for decision points

## Evaluation-Driven Development

1. Identify gaps by running Claude on tasks without the skill
2. Create 3 scenarios testing gaps
3. Establish baseline without skill
4. Write minimal instructions addressing only gaps
5. Iterate based on results

Develop with one Claude instance, test with another.

## Quality Checklist

- Description includes key terms and usage triggers
- SKILL.md body under 500 lines
- Progressive disclosure for details
- No time-sensitive information
- Consistent terminology
- Concrete examples
- At least 3 evaluations created
- Real usage scenarios tested
