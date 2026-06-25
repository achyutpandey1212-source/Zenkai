# Section 3.1 — Shared Graph State

## Purpose

Shared Graph State is the common data layer used by all agents in the system. It allows the six-agent architecture to communicate through a single structured state object instead of passing messages directly to each other.

This keeps the system organized, debuggable, and modular.

## Why It Exists

The product depends on multiple specialists working together:

- Identity Agent
- Strategy Agent
- Execution Agent
- Reflection Agent
- Companion Agent
- Memory Agent

If each agent communicated in an ad hoc way, the system would become messy and hard to maintain. Shared Graph State gives every agent a consistent place to read from and write to.

## Core Idea

Every workflow runs with one shared state object.

Each agent:

- reads only the fields it needs
- writes only the fields it owns
- avoids modifying unrelated outputs

This creates clear separation of responsibilities.

## Example State Shape

```ts
type GraphState = {
  userMessage?: string;
  userProfile?: object;
  retrievedMemory?: object[];
  goals?: object[];
  strategy?: object;
  schedule?: object;
  reflection?: object;
  response?: string;
  metadata?: object;
};
```

## What Each Agent Reads and Writes

### Identity Agent
Reads:
- retrievedMemory
- userMessage
- reflection
- goals

Writes:
- userProfile

### Strategy Agent
Reads:
- userProfile
- goals
- retrievedMemory
- reflection

Writes:
- strategy

### Execution Agent
Reads:
- strategy
- userProfile
- metadata

Writes:
- schedule

### Reflection Agent
Reads:
- userMessage
- schedule
- completed actions
- response history

Writes:
- reflection

### Companion Agent
Reads:
- the full current state when needed

Writes:
- response

### Memory Agent
Reads:
- userMessage
- reflection
- strategy
- userProfile
- schedule

Writes:
- retrievedMemory
- long-term memory updates
- episodic memory entries

## Benefits

### 1. Cleaner orchestration
Each agent knows exactly where to find information.

### 2. Easier debugging
If something breaks, we can inspect the shared state and identify which step produced the issue.

### 3. Better modularity
Agents can be improved independently without rewriting the whole system.

### 4. Easier LangGraph implementation
LangGraph naturally supports shared state passing between nodes, making this architecture practical.

### 5. More predictable behavior
The agents behave like specialists working on the same case file.

## Design Rules

- Agents should not directly depend on each other’s internal logic.
- Agents should only communicate through the shared state object.
- Each agent must keep its output scoped to its own responsibility.
- The shared state should remain structured and readable.
- Any agent output should be easy to trace in logs.

## Product Value

Shared Graph State is not just a technical detail. It is what makes the product feel coherent.

The user experiences one trusted partner, but behind the scenes the system stays organized through a single shared brain structure.

## Summary

Shared Graph State is the backbone of the multi-agent system. It allows the six agents to work together without chaos, keeps the architecture maintainable, and supports a clean LangGraph-based workflow for the hackathon product.
