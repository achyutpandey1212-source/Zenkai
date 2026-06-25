# ANTIGRAVITY MASTER INSTRUCTIONS

## Purpose

> This file exists for one reason: prevent AI coding tools from building the wrong product.

This document is the highest-level implementation authority. If any implementation decision conflicts with this document, **this document wins**.

---

# Project Name

**Temporary Name:** Project Atlas

Final naming will be decided later.

---

# What We Are Building

## We Are NOT Building

- Task Manager
- Calendar App
- Todo App
- AI Chatbot
- Productivity Dashboard

## We ARE Building

An **AI Growth Partner**.

The product should feel like:

- A companion that remembers me
- Understands me
- Plans for me
- Helps me grow

---

# Core Thesis

People spend too much time thinking about what to do and too little time actually doing it.

The AI should reduce:

- Planning
- Decision Fatigue
- Overthinking
- Cognitive Load

And increase:

- Clarity
- Consistency
- Momentum

---

# The Feeling We Are Selling

Not:

- AI Productivity
- Task Automation
- Smart Calendar

The feeling:

> I don't have to carry all of this in my head anymore.

And:

> This AI understands me.

And:

> This AI is helping me become who I want to become.

If implementation drifts away from these feelings:

**Stop. Re-read the PRD.**

---

# Most Important Rule

The AI must feel **alive**.

Users should feel the system is:

- Learning
- Observing
- Remembering
- Improving
- Planning

Even when the user is not actively asking it to.

---

# User Experience Rule

## Bad Experience

1. Open App
2. See Dashboard
3. See Charts
4. See Numbers

## Good Experience

1. Open App
2. AI greets user
3. AI explains what matters
4. AI highlights priorities
5. AI reduces overwhelm

**The AI comes first. Everything else comes second.**

---

# Product Positioning

| Product | Purpose |
|----------|----------|
| Google Calendar | Stores tasks |
| ChatGPT | Answers questions |
| Our Product | Remembers, Learns, Reflects, Plans, Adapts |

---

# User Journey Priority

Always optimize for:

Minute 0 → Day 1 → Day 7 → Day 30

The user relationship should deepen over time.

The AI should become more useful every week.

---

# What Makes This Special

The user does not manually build systems.

Instead:

1. User talks
2. AI learns
3. AI plans
4. AI organizes

### Example

User says:

> I want to become an AI entrepreneur.

The system should eventually:

- Store aspiration
- Create goal
- Suggest roadmap
- Create tasks
- Track progress

Without requiring repeated instructions.

---

# Agent Architecture

Exactly six agents:

1. Companion Agent — Face of the product
2. Memory Agent — Knowledge management
3. Reflection Agent — Pattern learning
4. Identity Agent — Identity evolution
5. Strategy Agent — Long-term planning
6. Execution Agent — Task execution planning

## Important

- Do NOT merge responsibilities
- Do NOT create super agents
- Keep responsibilities clean

---

# LangGraph Rule

LangGraph is the orchestrator.

- Frontend never decides which agents run
- User never decides which workflow runs
- LangGraph decides automatically

Workflow selection must happen automatically.

---

# Memory Philosophy

Memory is the moat.

Memory is the competitive advantage.

Memory is NOT:

- Chat History

Memory IS:

- Identity
- Goals
- Patterns
- Preferences
- Aspirations
- Constraints
- Reflections

Store meaning, not raw conversations.

---

# Memory Retrieval Rule

Never load everything.

Retrieve only:

- Relevant memories
- High-confidence memories
- High-importance memories

Context should remain small.

---

# Identity Philosophy

Identity is sacred.

Never change identity based on:

- One message
- One emotion
- One bad day

Identity changes only through repeated evidence.

### Example

❌ User feels lazy today → Identity = Lazy

✅ User consistently builds projects → Identity = Builder

---

# Reflection Philosophy

Reflections should answer:

1. What happened?
2. What worked?
3. What failed?
4. What should change?

Reflections generate:

- Insights
- Patterns
- Hypotheses

Not judgments.

---

# Task Philosophy

Do not optimize for more tasks.

Optimize for better tasks.

Prefer:

**3 important tasks**

Over:

**25 tiny tasks**

---

# Dashboard Philosophy

## Do Not Build

- Corporate dashboards
- Pie charts
- Bar graphs
- Analytics walls
- Metric overload

## Build

- Greeting
- Focus
- Risk
- Next Step

Dashboard should feel:

> Human, not Enterprise SaaS.

---

# Frontend Design Rules

Design language:

- Calm
- Minimal
- Focused
- Personal

Avoid:

- Visual noise
- Too many cards
- Too many widgets
- Heavy analytics

Ask:

> Does this reduce cognitive load?

If not, remove it.

---

# Database Rule

- PostgreSQL = Source of Truth
- Redis = Performance Layer

Never reverse this.

---

# Redis Rule

Redis stores:

- Current State

PostgreSQL stores:

- Permanent Truth

---

# Cost Optimization Rules

Target audience:

- Students
- Especially in India

Every implementation decision should consider:

- Token cost
- Inference cost
- Scalability

Never run all agents on every message.

Use conditional routing.

---

# What To Cut Immediately

If implementation becomes difficult, cut:

- Advanced analytics
- Complex calendar views
- Notifications
- Gamification
- Achievements
- Social features

Never cut:

- Memory
- Identity
- Reflection
- Strategy
- Execution
- Companion

These ARE the product.

---

# MVP Priorities

Build in this order:

1. Authentication
2. Onboarding
3. Chat
4. Memory
5. Identity
6. Reflection
7. Strategy
8. Execution
9. LangGraph
10. Redis

---

# Demo Priority

The demo must create one reaction:

> "Wait... it figured that out by itself?"

Everything should support that moment.

---

# File Reading Order

1. User Journey.md
2. MLP.md
3. Agent Architecture.md
4. Shared Graph State.md
5. Memory Hierarchy.md
6. Confidence & Hypothesis System.md
7. Workflow Architecture.md
8. Knowledge Ownership.md
9. Agent Memory Contracts.md
10. Knowledge Types.md
11. Storage Architecture.md
12. Memory Lifecycle.md
13. Context Retrieval Pipeline.md
14. Memory Schema.md
15. Context Compression.md
16. Memory Admission Policy.md
17. Memory Retrieval Ranking.md
18. Reflection Engine.md
19. Identity Engine.md
20. Demo Script.md
21. System Architecture.md
22. Database Schema.md
23. Redis Design.md
24. LangGraph Flow.md
25. Agent Prompts.md
26. API Routes.md
27. Frontend Screens.md
28. Build Roadmap.md

Read all files before generating architecture.

---

# Code Generation Rule

Always follow:

User Experience
↓
Workflow
↓
Architecture
↓
Code

Never start with implementation details.

---

# Final Implementation Test

Before adding any feature:

1. Does it reduce cognitive load?
2. Does it deepen user trust?

If the answer to both is not yes:

**Do not build it.**

---

# Final Reminder

We are not building software.

We are building a relationship.

The software merely enables that relationship.

Success is when the user feels:

- My AI knows me.
- My AI remembers me.
- My AI helps me grow.
