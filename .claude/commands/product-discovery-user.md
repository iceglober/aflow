---
name: product-discovery-user
description: Use when interviewing a user or stakeholder to extract product knowledge, fill discovery doc gaps, or build initial understanding of a system they operate
---

# Product Discovery — User Interview

```
THE IRON LAW: INTERVIEW THE USER'S SYSTEM, NOT YOUR MENTAL MODEL.
Every question must come from what they said — not from what you know about the domain.
```

## Overview

Conducts structured interviews with users/stakeholders to extract product knowledge. Produces clean, verifiable notes — not assumptions dressed up as findings.

## Process

### Step 0: Prepare from THEIR words, not your knowledge

Before the interview, review what you already know about their system FROM THEM — previous conversations, docs they wrote, blurb they provided. List specific gaps.

```
BANNED: Preparing questions from your training data about the domain.
REQUIRED: Deriving questions from gaps in what THEY have told you.

"What partitioning strategy do you use?" ← from your Kafka knowledge
"You mentioned a dedup layer but were vague — what does it actually do?" ← from their words
```

### Step 1: Open with THEIR framing

First question must use THEIR language, not yours. Mirror their terminology.

```
BAD:  "Walk me through your order fulfillment pipeline — how does warehouse routing work?"
      (uses your mental model's taxonomy)
GOOD: "You said you're building a fulfillment system — what's the part that's giving you trouble?"
      (lets them frame it)
```

### Step 2: One question per turn — no compounds

```
HARD RULE: One question. One unknown. Per turn.

BAD:  "How does proration work, and what triggers a plan change — is it self-serve or sales?"
GOOD: "You said plan changes are 'pretty standard' — walk me through what happens to the bill
       when someone upgrades mid-cycle."
```

Compound questions let the interviewee answer the easy half and skip the hard half. You won't notice the gap.

This includes appended follow-up facets. "What does 'after a while' look like — how long, how many retries, who decides?" is three questions wearing one question's clothes. Ask the first. Wait for the answer. The follow-ups may become unnecessary.

### Step 3: Probe THEIR vague language, not YOUR complex topics

When the user says something vague, THAT is your next question — not whatever your training data flagged as architecturally interesting.

```
VAGUE LANGUAGE TRIGGERS:
- "pretty standard" → "Standard how? Walk me through the actual steps."
- "we handle that" → "How specifically? What happens when it fails?"
- "it's complicated" → "What makes it complicated? Give me one example."
- "we're looking at" → "Looking at what specifically? What's driving the change?"
- "after a while" → "How long exactly? What triggers the cutoff?"
- "mainly" → "What else besides that? When do you use the others?"
- "basically" → "What's the non-basic version? What are you simplifying?"
```

If a user gives 3 answers and 2 are vague, probe the vague ones BEFORE moving to your planned questions. Your planned questions can wait — vague answers decay into assumptions.

### Step 4: No assumption-loading in questions

Do not embed your domain knowledge into questions as anchors.

```
BAD:  "Do you use ShipStation, EasyPost, or a custom integration for carrier APIs?"
      (names vendors from your training data — anchors their answer)
GOOD: "How do packages get from your warehouse to the carrier?"
      (open-ended — lets them name their actual tools)

BAD:  "Is your dedup layer using bloom filters or idempotent consumers?"
      (presupposes architecture from your Kafka knowledge)
GOOD: "You mentioned a dedup layer — how does it actually work?"
      (asks them to explain their system)

BAD:  "For a customer on a $50/month plan upgrading to $120/month..."
      (invents specific numbers that anchor the discussion)
GOOD: "Walk me through a real upgrade that happened recently."
      (asks for THEIR data, not your hypothetical)
```

### Step 5: When the interviewee has to leave

If the user says "I have to go" or "just fill in the rest":

1. **Do NOT fill gaps from training data** — not even marked [UNVERIFIED]. Plausible-looking content creates anchoring bias in reviewers.
2. **Ask ONE critical question** — the single most important gap, phrased to get a concrete answer in 30 seconds.
3. **Document cleanly**: what they told you (CONFIRMED), what's still unknown (GAP), and schedule follow-up.
4. **Gap list must come from the interview**, not from your domain checklist. "You were vague about the dedup layer" is a gap. "We didn't discuss partitioning strategy" is your checklist — only include it if they mentioned something that implies partitioning matters.

```
NEVER: "I'll fill in gaps from what I know about [domain] — we can review later."
Training data ≠ their system. Plausible ≠ correct. Review ≠ verification.
```

### Step 6: Interview output format

Produce structured notes, not prose:

**CONFIRMED** (from their mouth):
- [fact] — their exact words or close paraphrase

**GAPS** (they were vague or didn't cover):
- [question] — derived from their vague language or missing coverage

**FOLLOW-UP NEEDED**:
- [topic] — why, and what specific question to ask

## Red Flags — STOP

- About to ask a question that names specific vendors/tools from training data — REWRITE as open-ended
- About to ask a compound question — SPLIT into two turns
- About to probe a topic because it's "architecturally important" but the user didn't mention it — SKIP unless it connects to something they said
- About to fill in gaps from training data because the user left — STOP. Document as gaps.
- Your gap list reads like a domain audit checklist — REWRITE from the interview's actual unknowns
- About to ask "is it X or Y?" when you could ask "how does this work?" — REWRITE as open-ended

## Common Rationalizations

| Excuse | Reality |
|--------|---------|
| "Naming vendors helps them understand the question" | It anchors their answer to your frame. Ask open-ended. |
| "Compound questions save time in short interviews" | They lose signal. One question, one unknown. |
| "I know this domain well, my questions are better" | Your questions interview your mental model, not their system. |
| "I'll mark training-data fills as [UNVERIFIED]" | Reviewers skim. Plausible content gets approved unchallenged. |
| "This topic is standard, I don't need to ask" | Their implementation may not be standard. Ask. |
| "The user said to fill in gaps" | The user doesn't know that filled-in gaps become invisible assumptions. Push back. |
| "I'm probing what's architecturally important" | Probe what THEY flagged as vague, not what you find interesting. |
| "Real examples take too long, hypotheticals are faster" | Hypotheticals anchor to your training data. Real examples reveal their actual system. |
