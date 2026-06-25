## Implementation 5 — Redis Design 

## Purpose 

This document defines how Redis is used within the AI Growth Partner architecture. Redis is **not** our primary database. 

PostgreSQL remains the source of truth. 

Redis exists to provide: 

- speed 

- temporary memory 

- graph state management 

- caching 

- cost reduction 

## Core Philosophy 

PostgreSQL answers: 

What do we know? 

Redis answers: 

What are we working on right now? 

## Why Redis Exists 

Without Redis: 

User sends message ↓ Load memories ↓ Load goals ↓ Load identity ↓ Load tasks 

↓ Run agents ↓ Respond 

Every request hits the database repeatedly. 

Slow. 

Expensive. 

With Redis: 

User sends message ↓ Fetch active state ↓ Run workflow ↓ Respond Much faster. 

## Redis Responsibilities 

Redis is responsible for: 

Conversation Context 

Agent State 

LangGraph State 

Session Cache 

Memory Retrieval Cache 

Daily Brief Cache 

Task Cache 

Identity Snapshot Cache 

Redis is NOT responsible for: 

Permanent Storage 

Long-Term Memory 

Historical Data 

Analytics 

Those belong in PostgreSQL. 

## High-Level Architecture 

PostgreSQL ▲ │ Persistent Storage │ ▼ User │ ▼ Redis │ ▼ LangGraph │ ▼ Gemini 

Redis sits between storage and intelligence. 

## Redis Data Categories 

We will use Redis for five categories. 

## 1. Session State 

2. Graph State 

## 3. Context Cache 

## 4. Agent Cache 

## 5. Event Queue 

## Category 1 — Session State 

Purpose: 

Track active user session 

Key Format: 

session:{userId} 

Example: 

{ "userId": "123", "activeConversation": "conv_55", "lastSeen": "2026-06-25T22:15:00Z", : "chat" "currentWorkflow" } 

TTL: 

24 hours 

## Category 2 — Graph State 

Most important Redis usage. 

LangGraph needs shared state. 

Instead of rebuilding state every request: 

Store graph state in Redis 

Key: 

graph:{userId} 

Example: 

{ "activeGoal": "Hackathon Submission", "currentFocus": "Memory System", "energyLevel": "high", "activeAgents": [ "Companion", "Strategy" ], : 3 "workflowVersion" } 

TTL: 

12 hours 

Refreshed continuously. 

## Why Graph State Matters 

Without Graph State: 

Every agent must rebuild context. 

Memory Agent ↓ Strategy Agent ↓ Execution Agent Repeated work. More tokens. More latency. 

With Graph State: 

Build once 

Share everywhere 

This significantly reduces cost. 

## Category 3 — Context Cache 

Purpose: 

Avoid repeated memory retrieval. 

Example: 

User asks: 

What should I focus on today? 

Memory retrieval occurs. Result: 

Top Goals Identity Current Tasks 

Recent Reflection 

Stored as: context:{userId} 

Example: 

{ "topGoal": "Hackathon", "identity": "Builder", "focusTask": "Memory Retrieval", 

"reflectionSummary": "Most productive at night" } 

TTL: 

30 minutes 

## Category 4 — Agent Cache 

Stores recent outputs. 

Purpose: 

Avoid regenerating identical responses. 

Example: 

Strategy Agent generates: 

Weekly Plan 

Store: 

strategy:{userId} 

TTL: 

12 hours 

## Category 5 — Event Queue 

Used for background processing. 

Examples: 

Generate Reflection 

Update Identity 

Morning Brief 

Night Review 

Redis acts as queue. 

Key: 

events:pending 

Example: 

{ "eventType": "reflection", 

"userId": "123", "timestamp": "..." } 

## Redis Key Structure 

Use consistent naming. 

session:{userId} graph:{userId} context:{userId} identity:{userId} tasks:{userId} strategy:{userId} 

reflection:{userId} 

events:pending 

Never use random keys. 

## Identity Snapshot Cache 

Identity is read constantly. 

Instead of: 

Database Query ↓ Identity Table ↓ Build Profile 

Store: 

identity:{userId} 

Example: 

{ "coreIdentity": [ "Builder", "Developer" ], 

"aspirations": [ "AI Entrepreneur" ], 

"principles": [ "Growth Over Comfort" ] } 

TTL: 

6 hours 

## Goal Snapshot Cache 

Store active goals. 

Key: 

goals:{userId} 

Example: 

{ "activeGoals": [ "Hackathon", "LangGraph Mastery" 

] } 

TTL: 

2 hours 

## Task Snapshot Cache 

Store today’s tasks. 

Key: 

tasks:{userId} 

Example: 

{ "today": [ "Finish Memory Schema", "Review LangGraph" ] } TTL: 2 hours 

## Reflection Cache 

Recent reflections are frequently accessed. 

Store: 

reflection:{userId} 

Example: 

{ "latestInsight": "Task switching reduces productivity", 

: 0.88 "confidence" } 

TTL: 

24 hours 

## Memory Retrieval Cache 

One of the largest cost savers. 

Normal flow: 

User Query ↓ Embedding Search ↓ Memory Ranking ↓ Context Assembly 

Expensive. 

Instead: 

Cache result. 

Key: 

retrieval:{hash} 

Example: 

{ "memories": [ "...", "...", "..." ] } 

TTL: 

15 minutes 

## Prompt Context Cache 

Prompt construction is expensive. 

Store: 

prompt:{userId} Example: { "identitySummary": "...", "goalSummary": "...", "reflectionSummary": "...", "taskSummary": "..." } TTL: 30 minutes 

## Redis and Cost Optimization 

Redis reduces: 

Database Reads Memory Searches 

Agent Re-Computation Prompt Construction Repeated Retrieval Expected benefit: 40–70% fewer expensive operations 

depending on usage. 

## Redis and LangGraph 

Every workflow execution should receive: 

graphState from Redis. Example: Load Graph State ↓ Execute Workflow ↓ Update Graph State ↓ Save Back To Redis 

This makes workflows feel continuous. 

## Cache Invalidation Rules 

When identity changes: 

Delete: 

identity:{userId} 

context:{userId} 

prompt:{userId} 

When goals change: 

Delete: 

goals:{userId} 

context:{userId} 

When reflection generated: 

Delete: 

reflection:{userId} 

context:{userId} 

When tasks updated: 

Delete: 

tasks:{userId} 

context:{userId} 

## Memory Safety Rule 

Never trust Redis as permanent storage. 

Every important update must also be written to PostgreSQL. 

Rule: 

PostgreSQL = Source of Truth 

Redis = Performance Layer 

## MVP Redis Scope 

For hackathon MVP we only need: 

session:{userId} 

graph:{userId} 

identity:{userId} 

context:{userId} 

Everything else can be added later. 

## Future Redis Uses 

After MVP: 

Rate Limiting 

Agent Queues 

Email Queues 

Notification Queues 

Streaming Responses 

Real-Time Analytics 

Not required for hackathon. 

## Success Criteria 

A successful Redis layer should make the system feel: 

Instant 

Continuous 

## Alive 

The user should never feel like the AI is starting from scratch every time they send a message. 

Redis is what gives the system short-term memory and continuity between interactions. 

## Architecture Principle 

Redis exists for one reason: 

Reduce waiting. 

Reduce cost. 

Preserve flow. 

If a Redis feature does not improve one of those three outcomes: 

Do not build it. 

