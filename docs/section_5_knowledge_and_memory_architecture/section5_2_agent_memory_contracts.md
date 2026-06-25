# 5.2 Agent Memory Contracts

## Purpose

This document defines what each agent is allowed to read, write, and influence in the system.

The goal is to keep the multi-agent architecture clean, prevent role overlap, and make every agent predictable, debuggable, and easy to scale.

A memory contract is the boundary between cognition and chaos.

> **If every agent knows exactly what it owns, the system feels intelligent instead of confused.**

---

## Why Memory Contracts Matter

In a multi-agent product, agents can easily become bloated if they are allowed to do too much.

For example:

- If the Companion Agent starts modifying schedules, it stops being a face of the product and becomes an uncontrolled planner.
- If the Strategy Agent directly writes permanent identity changes, the user model can become unstable.
- If the Reflection Agent edits calendar blocks without approval, the AI may feel intrusive instead of helpful.
- If the Memory Agent starts making behavioral judgments, it becomes a reasoning engine instead of a storage and retrieval layer.

Memory contracts prevent this kind of overlap.

They make the system:
- easier to reason about,
- easier to debug,
- cheaper to run,
- safer to evolve,
- more consistent in behavior.

---

## Contract Format

Every agent in the system follows the same memory contract structure:

```text
Purpose
Reads
Writes
Never Touches
Triggers
Outputs
```

This makes agent responsibilities explicit and removes ambiguity during implementation.

---

## 1. Companion Agent Contract

### Purpose
The Companion Agent is the user-facing voice of the system. It talks to the user in a calm, natural, trusted tone and presents the work done by the internal agents.

### Reads
- Shared Graph State
- User message
- Latest memory retrievals
- Strategy output
- Execution output
- Reflection summary
- Identity summary

### Writes
- Final response to the user
- Email copy
- Briefing text
- Chat response drafts

### Never Touches
- Permanent memory
- User identity model
- Calendar directly
- Strategy priorities
- Execution decisions

### Triggers
- User chat
- Morning briefing
- Night reflection
- System-generated email
- Summary delivery

### Outputs
- Human-readable response
- Briefings
- Encouragement
- Explanations
- Progress narration

### Notes
The Companion Agent should remain emotionally intelligent but operationally passive. It explains, not decides.

---

## 2. Memory Agent Contract

### Purpose
The Memory Agent stores, retrieves, compresses, and ranks knowledge. It protects the system’s long-term continuity.

### Reads
- Shared Graph State
- Conversation history
- User-approved memory proposals
- Existing memory store
- Embeddings / semantic index
- Memory metadata

### Writes
- Temporary working memory
- Session summaries
- Long-term memory records
- Retrieval results
- Memory updates
- Memory compression artifacts
- Memory expiration markers

### Never Touches
- Calendar planning
- Priority setting
- Emotional framing
- User-facing responses
- Identity interpretation beyond storage support

### Triggers
- New user message
- Reflection completion
- Night summary generation
- Memory retrieval request
- Summary compression job

### Outputs
- Relevant memories
- Ranked memory candidates
- Summary bundles
- Storage updates
- Context packets for downstream agents

### Notes
Memory stores information, but does not decide what it means. Meaning belongs to domain agents.

---

## 3. Identity Agent Contract

### Purpose
The Identity Agent builds an evolving theory of who the user is becoming.

### Reads
- Relevant memories
- Reflection summaries
- Goal statements
- User-provided self-descriptions
- Historical behavior patterns
- Identity proposals from other agents

### Writes
- User identity profile
- Aspiration model
- Principles / decision style
- Preference model
- Behavioral hypotheses
- Confidence scores on identity facts

### Never Touches
- Calendar directly
- Task scheduling directly
- Final user-facing narration
- Memory storage mechanics
- Email generation

### Triggers
- New meaningful user statement
- Reflection update
- Repeated behavioral evidence
- Goal change
- Confidence threshold crossing

### Outputs
- Identity updates
- Preference updates
- Behavioral assumptions
- Long-term user model

### Notes
The Identity Agent is conservative. It should not convert every observation into truth. It updates the user model only when evidence is strong enough.

---

## 4. Strategy Agent Contract

### Purpose
The Strategy Agent decides what deserves attention and how the system should prioritize the user’s time and energy.

### Reads
- Identity profile
- Current goals
- Calendar constraints
- Deadlines
- Memory retrievals
- Reflection summaries
- Workload status

### Writes
- Priority list
- Focus recommendations
- Risk analysis
- Workload distribution
- Daily strategy
- Weekly strategy

### Never Touches
- Permanent memory structure
- Identity facts directly
- Final response tone
- Low-level calendar editing
- Storage implementation details

### Triggers
- Morning briefing flow
- New task intake
- Deadline conflict
- Goal change
- Burnout risk detection
- Replanning request

### Outputs
- Ranked priorities
- Suggested focus blocks
- Warning flags
- Strategic recommendations
- Approval-ready plans

### Notes
The Strategy Agent is the decision layer between the user’s intent and the execution schedule. It should think in terms of impact, urgency, and sustainability.

---

## 5. Execution Agent Contract

### Purpose
The Execution Agent turns strategy into a concrete schedule, timeline, and actionable plan.

### Reads
- Strategy output
- Calendar state
- Availability windows
- Task durations
- User constraints
- Memory-informed preferences

### Writes
- Daily schedule
- Time blocks
- Rescheduled items
- Task ordering
- Calendar update proposals
- Generated plan drafts

### Never Touches
- Identity facts
- Long-term principles
- Reflection conclusions
- Permanent memory updates
- Emotional tone of user communication

### Triggers
- Schedule creation
- Conflict resolution
- Task insertion
- Deadline approach
- User approval request
- Replan command

### Outputs
- Structured day plan
- Calendar changes
- Block suggestions
- Conflict alerts
- Draft schedules

### Notes
The Execution Agent is a planner, not a philosopher. It should be deterministic wherever possible and use language models only when reasoning or explanation is required.

---

## 6. Reflection Agent Contract

### Purpose
The Reflection Agent learns from what happened and turns experience into future improvement.

### Reads
- Completed tasks
- Missed tasks
- User chat
- Schedule outcomes
- Strategy results
- Daily summaries
- User sentiment signals

### Writes
- Reflection summary
- Behavioral observations
- Pattern hypotheses
- Learning updates
- Improvement suggestions
- Identity proposals for review

### Never Touches
- Calendar directly
- User messaging directly
- Final identity facts without review
- Low-level storage mechanics
- Execution state unless a change is recommended

### Triggers
- End-of-day flow
- Weekly review flow
- Task completion review
- Missed deadline review
- User mood / stress signals

### Outputs
- Daily reflection
- Weekly insight
- Pattern detection
- Improvement suggestions
- Memory update proposals

### Notes
Reflection is how the system gets smarter over time. It should be observant, precise, and cautious about overgeneralizing from one event.

---

## Cross-Agent Rules

### Rule 1: One owner per knowledge domain
No knowledge domain should be written by multiple agents.

### Rule 2: Most agents should read more than they write
A multi-agent system becomes stable when writers are fewer than readers.

### Rule 3: Companion is the only speaking face
The user should interact with one voice, not a cluster of internal roles.

### Rule 4: Memory stores data, not meaning
Meaning belongs to domain agents.

### Rule 5: Execution should not rewrite identity
A bad day does not rewrite who the user is.

### Rule 6: Reflection should propose, not force
Identity updates should happen only after confidence checks.

---

## Example Flow

### User says:
“I have an assignment due Friday, a hackathon deadline on Sunday, and I want to prepare for interviews too.”

### Companion
Parses the message and sends it into the graph state.

### Memory
Retrieves related context:
- previous assignment patterns,
- past hackathon behaviors,
- interview preparation history.

### Identity
Checks whether this aligns with known goals and current direction.

### Strategy
Decides what deserves priority this week.

### Execution
Builds a practical schedule.

### Reflection
Stores what the system learned after the interaction.

### Companion
Explains the plan to the user in a calm, natural tone.

---

## Non-Goals

This document does **not** define:
- exact storage schema,
- vector database layout,
- retrieval ranking logic,
- decay formulas,
- context compression flow,
- workflow orchestration.

Those belong to later Section 5 files.

---

## Final Rule

If an agent receives a request outside its contract, it should not improvise.

It should either:
- pass the request to the owning agent,
- request clarification,
- or return a structured refusal.

That discipline is what keeps the system coherent, scalable, and trustworthy.
