# 5.1 Knowledge Ownership

## Purpose

This document defines who owns each type of knowledge in the system. The goal is to keep the architecture clean, avoid conflicting sources of truth, and make every agent responsible for a clearly bounded domain.

The core principle is simple:

> **Every piece of knowledge must have exactly one owner.**
> Other agents may read it, but only the owner may write to it.

This prevents inconsistency, reduces reasoning overhead, and makes the system easier to debug, scale, and evolve.

---

## Why Knowledge Ownership Matters

In a multi-agent system, knowledge can easily become chaotic if multiple agents are allowed to update the same information without clear boundaries.

For example:

- If Identity, Strategy, and Reflection all update the user’s preferred work hours, the system may produce conflicting behavior.
- If Companion stores permanent knowledge directly, the user model may become noisy and unreliable.
- If Execution modifies long-term goals, the AI may drift away from the user’s actual intent.

Knowledge ownership solves this by assigning one agent as the authoritative source for each category of information.

---

## Core Rule

### Single Source of Truth

Every knowledge type must have one and only one owner.

That owner is responsible for:

- writing the data,
- updating the data,
- validating changes,
- deciding whether a new observation is strong enough to become persistent knowledge.

All other agents are read-only consumers for that knowledge type.

---

## Ownership Principles

### 1. Ownership is domain-specific
An agent should own only the knowledge that belongs to its role.

### 2. Read access is broader than write access
Many agents may read the same knowledge, but only one agent may write it.

### 3. Storage is not ownership
The Memory Agent stores the data, but it does not decide the meaning of the data. Domain agents own the meaning.

### 4. Permanent knowledge must be protected
Long-term user identity, principles, and aspirations should not change casually.

### 5. Temporary context should not pollute permanent memory
Short-lived states such as today’s mood or a single schedule change should not overwrite long-term knowledge.

---

## Knowledge Ownership Matrix

| Knowledge Type | Owner | Read By | Write Permission |
|---|---|---|---|
| User Identity | Identity Agent | Strategy, Reflection, Companion, Execution, Memory | Identity Agent only |
| Aspirations / Long-term Goals | Identity Agent | Strategy, Reflection, Companion, Execution, Memory | Identity Agent only |
| Decision Principles | Identity Agent | Strategy, Reflection, Companion | Identity Agent only |
| Personality Hypotheses | Identity Agent | Strategy, Reflection, Companion | Identity Agent only |
| Current Strategy / Priority Logic | Strategy Agent | Execution, Companion, Reflection, Memory | Strategy Agent only |
| Daily Plan / Schedule Logic | Execution Agent | Companion, Strategy, Reflection, Memory | Execution Agent only |
| Reflection Summary | Reflection Agent | Identity, Strategy, Companion, Memory | Reflection Agent only |
| Memory Index / Retrieval Layer | Memory Agent | All agents | Memory Agent only |
| Conversation Output / Spoken Response | Companion Agent | User interface only | Companion Agent only |
| Temporary Session Context | Memory Agent | Relevant workflow nodes | Memory Agent only |

---

## Agent Responsibilities by Knowledge Domain

### Identity Agent
Owns the user’s evolving self-model.

This includes:

- who the user is trying to become,
- what matters to the user over time,
- the user’s preferences and tendencies,
- long-term motivational drivers,
- stable behavior patterns.

Identity is not a live chat transcript. It is the system’s best understanding of the user’s deeper profile.

---

### Strategy Agent
Owns the logic for deciding what deserves attention.

This includes:

- priorities,
- urgency,
- risk assessment,
- workload balancing,
- high-level planning decisions.

Strategy should not rewrite identity. It should only use identity to make better choices.

---

### Execution Agent
Owns the concrete schedule and task arrangement.

This includes:

- time blocks,
- task ordering,
- deadline placement,
- conflict resolution,
- rescheduling decisions.

Execution translates strategy into something actionable.

---

### Reflection Agent
Owns learning from outcomes.

This includes:

- what worked,
- what failed,
- recurring patterns,
- behavioral insights,
- improvement suggestions.

Reflection produces observations and proposals, not final identity truth by default.

---

### Memory Agent
Owns storage, retrieval, ranking, compression, and forgetting.

This includes:

- short-term memory,
- long-term memory,
- embeddings,
- indexed retrieval,
- summary storage,
- decay and archival.

Memory is the infrastructure layer. It does not interpret user meaning on its own.

---

### Companion Agent
Owns communication.

This includes:

- the natural-language interface,
- briefing messages,
- reflections presented to the user,
- email copy,
- encouragement and explanations.

Companion should never be the source of truth for permanent knowledge. It should only express the decisions made by the other agents.

---

## Read vs Write Boundaries

### Read access
Multiple agents can read the same knowledge when needed.

Examples:

- Strategy reads identity.
- Execution reads current strategy.
- Companion reads everything relevant to explain the plan.
- Reflection reads outcomes and prior context.

### Write access
Only the owning agent can write to a knowledge type.

Examples:

- Identity writes user profile and principles.
- Strategy writes priorities.
- Execution writes schedule.
- Reflection writes learning summaries.
- Memory writes storage records and retrieval indexes.
- Companion writes nothing permanent.

---

## Why Companion Owns Nothing

The Companion Agent is the face of the product.

It should feel smart, natural, and consistent.

But if it also owns permanent knowledge, the system becomes brittle:

- conversational phrasing could accidentally overwrite truth,
- temporary tone could affect memory,
- user-facing text could become confused with system knowledge.

Keeping Companion stateless in permanent terms makes the product cleaner and safer.

---

## Why Memory Owns Storage, Not Meaning

Memory is responsible for:

- keeping the data,
- organizing the data,
- retrieving the data,
- compressing the data,
- decaying the data.

But Memory should not decide things like:

- whether the user is a night learner,
- whether the user is goal-oriented,
- whether a new habit is actually a stable pattern.

That meaning belongs to domain agents like Identity and Reflection.

This separation prevents storage from becoming a second brain with unclear logic.

---

## Example Scenarios

### Scenario 1: User says “I want to become an AI engineer”
- Identity Agent receives this as a high-value aspiration.
- Memory stores it.
- Strategy uses it to prioritize relevant opportunities and learning tasks.
- Companion can mention it naturally in conversations.

### Scenario 2: User says “I work better after dinner”
- Identity may treat this as a working hypothesis.
- After repeated evidence, Identity can strengthen it into a stable preference.
- Strategy and Execution can use it to plan better time blocks.

### Scenario 3: User says “I’m overwhelmed today”
- Companion expresses empathy.
- Reflection may capture that the user is under stress.
- Strategy may reduce workload temporarily.
- Identity does not rewrite the user’s long-term personality from a single statement.

---

## Non-Goals

This section intentionally does **not** define:

- exact database schemas,
- vector search implementation,
- token compression logic,
- prompt templates,
- workflow orchestration.

Those belong in later Section 5 documents.

This section only defines ownership and authority.

---

## Final Rule

When two agents disagree about a piece of knowledge, the owning agent wins.

If the ownership is unclear, the system should pause and resolve the conflict before the knowledge is persisted.

That clarity is what keeps the system trustworthy, stable, and easy to scale.
