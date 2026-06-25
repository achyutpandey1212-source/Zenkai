# Development Rules

> Purpose: Prevent implementation drift.
>
> AI coding tools are extremely good at generating code.
>
> They are also extremely good at:
>
> - Adding features nobody asked for
> - Changing architecture
> - Introducing unnecessary complexity
> - Ignoring product philosophy
>
> This document defines **non-negotiable development rules**.
>
> If code conflicts with these rules:
>
> **The code is wrong.**

---

# Rule 0 — The Product Comes First

Always prioritize:

```text
User Experience
↓
Product Philosophy
↓
Architecture
↓
Code
```

Never reverse this order.

### Bad

```text
Cool Technology
↓
Force Product Around It
```

### Good

```text
Product Need
↓
Technology Choice
```

---

# Rule 1 — Follow The Documents

Implementation authority order:

1. `00_PROJECT_CONTEXT.md`
2. PRD
3. Agent Architecture
4. Memory Architecture
5. Build Roadmap
6. Development Rules
7. Code

**Code is never the source of truth.**

Documentation is.

---

# Rule 2 — No Architecture Changes

Do **NOT**:

- Replace LangGraph
- Replace PostgreSQL
- Replace Redis
- Replace Next.js
- Replace Gemini

without explicit approval.

## Locked Technology Stack

### Frontend

- Next.js
- TypeScript
- Tailwind
- Shadcn

### Backend

- Node.js
- TypeScript

### AI

- Gemini
- LangGraph
- LangChain

### Storage

- PostgreSQL
- Redis

### Deployment

- Google Cloud Platform

**Assume this stack is locked.**

---

# Rule 3 — Six Agent System Is Fixed

We have exactly six agents:

1. Companion
2. Memory
3. Reflection
4. Identity
5. Strategy
6. Execution

Do **NOT**:

- Merge agents
- Add agents
- Rename agents
- Create super agents

**Agent responsibilities are fixed.**

---

# Rule 4 — Memory Is Sacred

Memory is the moat.

Memory is the product.

Never store:

- Entire conversations

when we can store:

- Structured knowledge

Always prefer:

- Meaning
- Insights
- Identity
- Goals
- Patterns

over raw text.

---

# Rule 5 — Identity Is Stable

Identity should never change because of:

- One message
- One emotion
- One day

Identity updates require:

- Repeated evidence
- Confidence
- Time

**Never create identity hallucinations.**

---

# Rule 6 — Optimize For Trust

Before implementing any feature ask:

> Does this deepen trust?

If no:

**Do not build it.**

---

# Rule 7 — Optimize For Cognitive Load

Before implementing any feature ask:

> Does this reduce cognitive load?

If no:

**Do not build it.**

---

# Rule 8 — Frontend Must Stay Minimal

Never build:

- Analytics dashboards
- 10+ widgets
- Complex charts
- Enterprise UI

The product should feel:

- Calm
- Focused
- Human

**The AI is the hero. Not the dashboard.**

---

# Rule 9 — Chat Is The Primary Interface

Most user actions should originate from:

**Conversation**

### Bad

User manually configures everything.

### Good

```text
User talks
↓
AI organizes
```

---

# Rule 10 — Conditional Agent Execution

Never run all agents.

### Bad

```text
Every Message
↓
All 6 Agents
```

### Good

```text
Message
↓
Router
↓
Relevant Agents Only
```

Cost matters.

Latency matters.

---

# Rule 11 — Token Efficiency Matters

Always assume:

> 1000+ users

and future scale.

Avoid:

- Huge context windows
- Repeated memory fetches
- Large prompt chains

Prefer:

- Memory retrieval
- Compression
- Ranking
- Caching

---

# Rule 12 — Redis Is Temporary

Redis stores:

- Current state
- Caches
- Sessions

Redis is **NOT** the source of truth.

**PostgreSQL is.**

---

# Rule 13 — Build Vertically

Never spend days building infrastructure.

Build complete user experiences.

### Bad

```text
Database
Database
Database
Database
```

### Good

```text
Login
↓
Chat
↓
Memory
↓
Identity
↓
End-to-End Flow
```

Every phase should produce something demoable.

---

# Rule 14 — No Premature Optimization

Do **NOT** build:

- Microservices
- Event buses
- Message queues
- Kubernetes
- Distributed systems

for the hackathon.

Keep architecture simple.

Only optimize after validation.

---

# Rule 15 — No Future Features

Ignore everything inside:

```text
future_roadmap_to_be_ignored/
```

Unless explicitly requested.

Examples:

- News Agent
- Opportunity Agent
- Advanced Autonomy
- External Integrations
- Market Expansion Features

These are post-hackathon ideas.

**Not MVP.**

---

# Rule 16 — Demo First Thinking

Every major feature should support:

**The Demo Script**

Ask:

- Can a judge see this feature?
- Will they understand it?
- Will it create a wow moment?

If not:

**Lower priority.**

---

# Rule 17 — Mobile First

Primary target:

**Mobile Browser**

Then:

**Desktop**

Assume judges may test quickly on smaller screens.

---

# Rule 18 — Prefer Simplicity

When choosing between:

- Complex solution
- Simple solution

Choose:

**Simple solution**

Unless complexity provides massive value.

---

# Rule 19 — Every Commit Must Work

Never leave:

- Broken main branch

Each roadmap checkpoint should produce:

> A working build

that can be demonstrated.

---

# Rule 20 — The North Star Test

Before merging any feature, ask:

Does this make the user feel:

- "My AI knows me."
- "My AI remembers me."
- "My AI helps me grow."

If the answer is not clearly yes:

**Do not build it.**

---

# Hackathon Success Definition

## Success Is NOT

- Most Features
- Most Agents
- Most Complex System

## Success Is

1. The judge opens the app.
2. The AI remembers them.
3. The AI understands them.
4. The AI plans for them.
5. The AI reduces mental load.

The judge says:

> "Wait... do that again."

Everything else is secondary.

---

# Final Instruction To AI Coding Tools

When uncertain:

1. Read the docs again.
2. Do not invent.
3. Do not assume.
4. Do not redesign.
5. Implement what exists.

> The vision has already been decided.
>
> Your job is execution.
