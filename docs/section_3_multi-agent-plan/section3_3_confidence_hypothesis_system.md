# 3. Confidence & Hypothesis System

## Purpose

The AI should not treat every observation about the user as permanent truth.  
Instead, it should form **hypotheses**, test them over time, and only promote them to **high-confidence beliefs** when repeated evidence supports them.

This prevents the product from making wild assumptions after a single conversation and helps the AI feel thoughtful, adaptive, and trustworthy.

---

## Why this matters

A strong long-term assistant should behave more like a careful human observer and less like a machine that stores every sentence as fact.

Examples:

- If the user says they like working at night once, the system should not immediately assume that as a permanent preference.
- If the user repeatedly finishes deep work in the evening, the system can gradually increase confidence in that pattern.
- If the user says they feel unmotivated this week, that should be treated as a temporary state unless the pattern persists.

This system makes the assistant more accurate, more responsible, and more aligned with the product’s trust-first philosophy.

---

## Core idea

Every meaningful observation is stored with a confidence score.

The AI should classify user-related information into one of three levels:

### 1. Hypothesis
A tentative belief based on limited evidence.

Example:
- “The user may work best after lunch.”
- “The user might be overwhelmed by multiple deadlines.”

### 2. Probable Pattern
A stronger belief supported by repeated observations.

Example:
- “The user often delays difficult tasks until late evening.”
- “The user responds well to direct, structured suggestions.”

### 3. Stable Fact
A high-confidence long-term preference or behavioral pattern.

Example:
- “The user prefers building over passive learning.”
- “The user consistently engages better with concise planning.”

---

## How it works

### Input sources
The system may derive confidence-based observations from:

- conversation history
- morning and night briefings
- task completion patterns
- schedule changes
- repeated user feedback
- emotional tone across conversations
- explicit user confirmations

### Output format
Every observation should ideally include:

- statement
- type: hypothesis / probable pattern / stable fact
- confidence score
- source evidence
- timestamp
- optional expiry or review date

---

## Example flow

### First observation
User says:
> “I usually work better after dinner.”

The system stores:
- Statement: User may work better after dinner
- Type: Hypothesis
- Confidence: 0.52
- Source: self-report
- Status: pending more evidence

### Second observation
Over the next few days, the user consistently completes planning and deep work at night.

The system updates:
- Confidence: 0.74
- Type: Probable Pattern

### Third observation
After multiple weeks, the pattern remains stable and the user confirms it.

The system updates:
- Confidence: 0.92
- Type: Stable Fact

---

## What this system should prevent

- Overconfident assumptions after one interaction
- Permanent memory being polluted by temporary emotions
- Bad personalization based on weak evidence
- Unnecessary suggestions that do not match the user’s actual behavior
- False certainty in the assistant’s language

---

## How the UI should reflect it

The user does not need to see internal confidence scores all the time.  
However, the system may use confidence internally to decide:

- whether to act on a pattern
- whether to ask for confirmation
- whether to adjust tomorrow’s schedule
- whether to store a memory permanently
- whether to present an insight as a suggestion or as a stronger recommendation

---

## Example product behavior

If confidence is low:
- The AI should say: “I may be wrong, but I noticed a pattern…”

If confidence is medium:
- The AI should say: “This looks like a recurring trend…”

If confidence is high:
- The AI should say: “This is a pattern I trust enough to plan around.”

---

## Relationship with other systems

### With Memory
Memory stores the observations.

### With Identity
Identity uses high-confidence beliefs to shape the user model.

### With Strategy
Strategy uses confidence-weighted patterns to prioritize work.

### With Reflection
Reflection updates confidence based on whether previous observations were accurate.

---

## Success criteria

This system is successful if:

- the AI becomes more accurate over time
- the assistant avoids making bad assumptions
- user trust improves because the AI feels careful
- personalization becomes noticeably sharper after repeated usage
- the product feels intelligent without feeling intrusive

---

## V1 scope

For the hackathon version, this system can be lightweight:

- confidence score from 0.0 to 1.0
- three levels only: hypothesis, probable pattern, stable fact
- simple rules for promotion and demotion
- no complex probabilistic model required

The important part is the behavior, not the mathematical complexity.

---

## Final principle

**The AI should not assume. It should learn.**
