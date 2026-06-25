# Section 5.7 — Memory Schema

## Purpose

Define the data structure used to store, retrieve, rank, and manage memory across the system.

This schema is designed to support:
- long-term personalization
- contextual retrieval
- confidence tracking
- memory decay
- compression
- explainability

---

# Core Principle

Every memory should be stored in a structured way so the AI can reason about:

- what the memory means
- who owns it
- how confident the system is
- how important it is
- how long it should remain active
- where it should be retrieved from

---

# Memory Object

Every memory entry should contain the following base fields:

```json
{
  "id": "mem_001",
  "owner": "identity",
  "type": "preference",
  "value": "User works best at night",
  "confidence": 0.91,
  "importance": 0.84,
  "created_at": "2026-06-25T18:00:00Z",
  "updated_at": "2026-06-25T18:30:00Z",
  "last_used": "2026-06-25T19:10:00Z",
  "decay_rate": 0.02,
  "status": "active",
  "source": "reflection",
  "embedding_id": "vec_124",
  "metadata": {}
}
```

---

# Field Definitions

## 1. id
Unique identifier for the memory record.

Example:
```text
mem_001
```

---

## 2. owner
Which agent owns this memory.

Possible values:
```text
identity
strategy
execution
reflection
memory
```

Purpose:
- keeps ownership clean
- prevents conflicting updates
- makes debugging easier

---

## 3. type
The category of memory.

Possible values:
```text
identity
aspiration
principle
goal
preference
behavior
event
reflection
constraint
task
summary
relationship
```

---

## 4. value
The actual content of the memory.

Example:
```text
User prefers evening work sessions.
```

This should be concise and semantically meaningful.

---

## 5. confidence
How sure the system is that this memory is correct.

Range:
```text
0.0 to 1.0
```

Examples:
- 0.30 → weak signal
- 0.70 → likely true
- 0.95 → strongly verified

Confidence prevents the system from treating every observation as a permanent fact.

---

## 6. importance
How useful this memory is for future decisions.

Range:
```text
0.0 to 1.0
```

High importance examples:
- long-term goal
- decision principle
- recurring work pattern

Low importance examples:
- one-off casual fact
- temporary mood
- irrelevant detail

---

## 7. created_at
When the memory was first created.

Used for:
- aging
- tracking evolution
- debugging
- sorting

---

## 8. updated_at
When the memory was last updated.

Used for:
- freshness tracking
- memory strengthening
- decay logic

---

## 9. last_used
When the memory was last retrieved or applied.

Used for:
- ranking
- pruning
- determining relevance over time

---

## 10. decay_rate
How quickly this memory should lose influence if unused.

Example:
```text
0.01 = slow decay
0.10 = fast decay
```

Used for:
- temporary habits
- weak hypotheses
- stale interests

---

## 11. status
Current lifecycle state of the memory.

Possible values:
```text
candidate
proposed
approved
active
compressed
archived
forgotten
```

---

## 12. source
Where the memory came from.

Possible values:
```text
conversation
reflection
identity_update
manual_input
system_inference
```

This helps explain why the memory exists.

---

## 13. embedding_id
Reference to the semantic embedding for vector search.

Used when the memory should be retrievable by meaning rather than exact text.

Example:
```text
vec_124
```

---

## 14. metadata
Additional structured information.

Examples:
```json
{
  "evidence_count": 5,
  "updated_by": "reflection",
  "retrieval_count": 8,
  "compressed_from": ["mem_014", "mem_027"]
}
```

---

# Memory Categories

The schema should support the following major categories.

---

## 1. Identity Memory

Represents who the user is.

Examples:
- role
- profession
- communication style
- preferred coaching style

Schema focus:
- high confidence
- long lifespan
- low volatility

---

## 2. Aspiration Memory

Represents who the user wants to become.

Examples:
- career goal
- future vision
- major ambitions

Schema focus:
- long-term persistence
- gradual updates
- strong importance

---

## 3. Principle Memory

Represents how the user makes decisions.

Examples:
- prefers long-term growth
- likes direct communication
- values consistency over intensity

Schema focus:
- very high durability
- only changes with strong evidence

---

## 4. Goal Memory

Represents current or active targets.

Examples:
- hackathon submission
- exam preparation
- course completion
- project launch

Schema focus:
- medium to high freshness
- updates often
- tied to execution

---

## 5. Behavior Memory

Represents repeated user patterns.

Examples:
- works best after dinner
- procrastinates after lunch
- gets overwhelmed when too many tasks exist

Schema focus:
- evidence-based
- confidence-sensitive
- useful for planning

---

## 6. Event Memory

Represents important episodes or milestones.

Examples:
- first hackathon win
- missed deadline
- successful project launch
- major reflection

Schema focus:
- episodic
- may be archived later
- useful for continuity

---

## 7. Summary Memory

Represents compressed context.

Examples:
- daily summary
- weekly summary
- monthly summary

Schema focus:
- compact
- replace many raw messages
- optimized for retrieval

---

## 8. Constraint Memory

Represents boundaries that should be respected.

Examples:
- do not schedule after 11 PM
- family time is sacred
- avoid heavy work during exams

Schema focus:
- stable
- high priority
- must be respected by strategy and execution

---

# Suggested MongoDB Document Structure

A memory record in MongoDB may look like this:

```json
{
  "_id": "mem_001",
  "owner": "identity",
  "type": "principle",
  "value": "User prefers long-term growth over short-term comfort",
  "confidence": 0.96,
  "importance": 0.97,
  "created_at": "2026-06-25T18:00:00Z",
  "updated_at": "2026-06-25T20:00:00Z",
  "last_used": "2026-06-25T20:05:00Z",
  "decay_rate": 0.005,
  "status": "active",
  "source": "reflection",
  "embedding_id": "vec_889",
  "metadata": {
    "evidence_count": 7,
    "verified": true
  }
}
```

---

# Suggested Redis Structure

Redis should store fast-changing runtime memory such as:

- current workflow state
- active session summaries
- temporary prompt context
- pending approvals
- cache keys

Example keys:

```text
session:{userId}:state
workflow:{workflowId}:context
briefing:{userId}:today
memory:{memoryId}:temp
```

---

# Suggested Vector Schema

Vector data should store:

- memory id
- embedding vector
- memory type
- relevance tags
- confidence
- importance

Example:

```json
{
  "id": "mem_001",
  "vector": [0.12, -0.44, 0.81],
  "type": "behavior",
  "tags": ["productivity", "night_work", "focus"],
  "confidence": 0.91,
  "importance": 0.84
}
```

---

# Memory Ranking Metadata

When retrieving memories, the system should consider:

- confidence
- recency
- importance
- relevance
- retrieval frequency
- decay state

Suggested retrieval score:

```text
score = relevance × confidence × importance × freshness
```

---

# Memory State Transitions

```text
candidate
→ proposed
→ approved
→ active
→ compressed
→ archived
→ forgotten
```

Each transition should be traceable.

---

# Design Outcome

This schema ensures that memory is not just “stored chat history.”

It becomes a structured, explainable, evolving knowledge system that powers long-term personalization, lower cognitive load, and more intelligent agent behavior.

The result is an AI partner that gets better over time without becoming noisy, expensive, or inconsistent.
