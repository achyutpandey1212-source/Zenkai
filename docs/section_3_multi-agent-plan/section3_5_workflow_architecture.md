# Section 3.5 — Workflow Architecture

## Purpose
This section defines how the product routes different user events into the right multi-agent workflow. The goal is to keep orchestration clean, event-driven, and easy to explain in the hackathon demo.

## Why Workflow Architecture Matters
Our product is not a single chatbot. It behaves differently depending on the user’s intent and the time of day. A login, a casual chat, a morning briefing, a night reflection, and a deadline conflict should not all run through the same exact path.

Instead of one giant chain, the system uses multiple specialized workflows. This makes the product easier to maintain, easier to debug, and easier to present as a real agentic system.

## Core Principle
**LangGraph orchestrates workflows, but the application decides which workflow to start based on the incoming event.**

LangGraph is used for:
- branching
- stateful execution
- checkpoints
- retries
- human approval pauses
- parallel retrieval
- workflow resumption

## Workflow Types

### 1. Conversation Workflow
Used when the user opens the chat or asks a direct question.

Typical flow:
- Retrieve relevant memory
- Let the Companion Agent respond naturally
- Update reflection if the conversation reveals something useful
- Update memory if new long-term information is discovered

Purpose:
- Keep the product feeling alive and personal
- Support natural, trust-building interaction

### 2. Morning Briefing Workflow
Used when the user starts the day or when the system triggers a morning email/briefing.

Typical flow:
- Retrieve memory and current context
- Ask Identity Agent for the current understanding of the user
- Ask Strategy Agent what matters today
- Ask Execution Agent to turn priorities into an actionable schedule
- Let Companion Agent present a calm, concise briefing
- Send the result through email and/or show it in the UI

Purpose:
- Reduce decision fatigue
- Give the user a clear starting point for the day

### 3. Night Reflection Workflow
Used at bedtime or at the end of the day.

Typical flow:
- Companion Agent asks reflective questions
- Memory Agent stores useful answers
- Reflection Agent analyzes the day
- Identity Agent updates the user model if needed
- Strategy Agent checks whether tomorrow needs adjustment
- Execution Agent modifies the plan if necessary

Purpose:
- Learn from the user over time
- Deepen trust
- Improve tomorrow’s plan using today’s experience

### 4. Deadline Update Workflow
Used when a new deadline is added or an existing deadline changes.

Typical flow:
- Memory Agent fetches the latest context
- Strategy Agent re-evaluates priority and urgency
- Execution Agent updates the schedule
- Companion Agent explains the change to the user
- If needed, generate a review email

Purpose:
- React quickly to changes
- Keep the user organized without manual recalculation

### 5. Weekly Reflection Workflow
Used at the end of the week or on a fixed schedule.

Typical flow:
- Gather completed tasks and missed tasks
- Compare planned vs actual execution
- Ask Reflection Agent to identify patterns
- Update Identity Agent if a stable trend is observed
- Update Memory Agent with the weekly summary
- Let Companion Agent present a thoughtful recap

Purpose:
- Show growth
- Build a narrative of progress
- Help the user see how they are changing over time

## Event-to-Workflow Routing
The application routes workflows based on events such as:
- user login
- direct chat message
- morning trigger
- night trigger
- deadline update
- weekly schedule trigger

This keeps the system modular. The event router decides which workflow should run, and LangGraph handles the detailed orchestration inside that workflow.

## Shared Elements Across Workflows
Even though workflows are separate, they all reuse the same six agents:
- Identity Agent
- Strategy Agent
- Execution Agent
- Reflection Agent
- Memory Agent
- Companion Agent

This gives the product consistency. The user always feels like they are talking to one partner, even though different workflows activate different parts of the system behind the scenes.

## Why This Approach Works
This architecture is ideal for the hackathon because it is:
- easy to explain
- easy to demo
- modular enough to build quickly
- strong in agentic depth
- flexible for future expansion

It also makes the system feel intentional instead of random. Each workflow has a purpose, and every workflow serves the same product promise: reduce cognitive load and deepen user trust.

## Summary
The product should not use one giant workflow for everything. It should use multiple event-driven workflows, each triggered by a specific user or system event, with LangGraph orchestrating the steps inside each workflow. This design keeps the product clean, maintainable, and genuinely agentic.