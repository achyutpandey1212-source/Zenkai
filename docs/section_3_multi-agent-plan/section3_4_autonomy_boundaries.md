# Section 3.4 — Autonomy Boundaries

## Purpose

This section defines what the AI system can do on its own, what it can recommend but not execute, and what always requires user approval. The goal is to make the product feel proactive without becoming intrusive, risky, or confusing.

Autonomy boundaries are important because the product is not meant to replace the user’s judgment. It is meant to reduce cognitive load, improve planning quality, and help the user move faster with confidence.

---

## Core Principle

The AI may take initiative, but it must stay inside clearly defined limits.

It should be able to:
- plan,
- suggest,
- draft,
- detect risk,
- and prepare actions.

It should not silently make irreversible decisions for the user.

---

## Autonomy Levels

### Level 1 — Safe to Automate
These actions can happen automatically without user approval because they are low-risk and reversible.

Examples:
- retrieving memory relevant to the current conversation
- generating a proposed daily plan
- ranking tasks by priority
- detecting schedule conflicts
- drafting a reflection summary
- preparing a briefing email draft
- updating temporary session state
- suggesting a revised plan when priorities change

### Level 2 — Suggest First, Then Confirm
These actions can be prepared automatically, but the user must explicitly approve them before they take effect.

Examples:
- moving tasks to different time slots
- changing the order of priorities
- updating tomorrow’s schedule
- sending a briefing email
- storing a new long-term memory
- promoting a pattern from hypothesis to fact
- applying a schedule revision after a deadline conflict

### Level 3 — Always Require Approval
These actions are too important to happen automatically and must always be approved by the user.

Examples:
- deleting tasks
- permanently forgetting memories
- changing long-term goals
- changing identity assumptions
- sending an email that has personal or sensitive wording
- overwriting previously confirmed user preferences
- making a major schedule change that affects deadlines or commitments

---

## What the AI Can Do Automatically

The system should proactively handle the following without asking every time:

- read current memory and context
- summarize the user’s day
- identify the top priorities
- detect task overlap and deadline pressure
- propose schedule changes
- generate short action plans
- prepare morning and night briefing content
- draft encouragement based on actual progress
- flag repeated patterns to the Reflection Agent

This keeps the product feeling alive and agentic instead of passive.

---

## What the AI Must Ask Before Doing

The system must ask for approval before making changes that could affect the user’s real commitments or long-term profile.

The AI should ask before:
- rescheduling an important deadline
- moving a commitment to another day
- storing a memory as a long-term fact
- sending a message to the user’s email inbox
- changing the user’s core goals
- making a strong assumption about the user’s identity or behavior

This preserves trust and prevents the AI from becoming annoying, overconfident, or unsafe.

---

## Approval Experience

When approval is needed, the AI should not behave like a generic permissions pop-up.

It should explain:
1. what it noticed,
2. what it wants to do,
3. why it recommends it,
4. and what happens if the user accepts.

Example:

> I noticed your hackathon deadline overlaps with your assignment work.  
> I prepared a revised plan that moves two lower-priority tasks to tomorrow evening.  
> Review the changes before I apply them.

This keeps the product calm, respectful, and useful.

---

## Boundaries by Agent

### Identity Agent
Can:
- form hypotheses about the user
- update user patterns with confidence scores

Cannot:
- overwrite confirmed user identity without approval
- make emotional claims as facts
- alter goals on its own

### Strategy Agent
Can:
- rank tasks
- identify urgent work
- recommend workload changes

Cannot:
- directly modify the schedule
- send user-facing messages
- permanently store memory

### Execution Agent
Can:
- create draft plans
- move work blocks in a proposed schedule
- detect conflicts
- prepare a revised timeline

Cannot:
- apply major changes without approval
- change long-term goals
- decide what the user “should become”

### Reflection Agent
Can:
- analyze outcomes
- identify recurring patterns
- suggest memory updates

Cannot:
- finalise memory on its own
- make clinical or psychological claims
- force the system into dramatic conclusions

### Memory Agent
Can:
- store, retrieve, compress, and expire memories
- separate short-term and long-term context

Cannot:
- interpret meaning like a planner
- decide user priorities
- give encouragement as if it were the Companion Agent

### Companion Agent
Can:
- communicate the system’s thinking in a natural tone
- ask for approval
- explain suggestions clearly
- keep the user emotionally engaged

Cannot:
- silently change data
- plan behind the scenes without the other agents
- impersonate certainty when the system is unsure

---

## Product Rule

Any action that could reduce trust must be visible.

Any action that could increase trust may be automated if it is safe.

This rule keeps the system proactive while still feeling respectful and reliable.

---

## Why This Matters

A product like this becomes believable only when the user feels that the AI is helpful but not reckless.

The best autonomy is not invisible control.

The best autonomy is:
- transparent,
- bounded,
- and easy to approve.

That is what makes the AI feel like a trusted partner rather than an overactive assistant.

---

## Outcome

With autonomy boundaries defined, the product can act intelligently without crossing into unwanted behavior. This gives the system confidence, protects the user, and makes the experience feel premium and calm.
