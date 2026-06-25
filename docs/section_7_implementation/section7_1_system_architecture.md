## Implementation 1 — System Architecture 

## Purpose 

This document defines the complete technical architecture of the product. 

It acts as the single source of truth for: 

- frontend 

- backend 

- agent orchestration 

- memory system 

- storage 

- AI providers 

- infrastructure 

Every implementation decision should align with this architecture. 

## System Vision 

We are not building: 

Calendar App + AI Chat 

We are building: 

AI Growth Partner 

The AI is the product. 

Everything else exists to support the AI’s ability to: 

- learn 

- remember 

- plan 

- reflect 

- coach 

## High Level Architecture 

┌─────────────────────────┐ │        Frontend         │ │       Next.js App       │ └────────────┬────────────┘ │ ▼ ┌─────────────────────────┐ │       API Layer         │ │      Next.js APIs       │ └────────────┬────────────┘ │ ▼ ┌─────────────────────────┐ │    LangGraph Runtime    │ │     Agent Workflow      │ └────────────┬────────────┘ │ ┌───────┼────────┐ ▼ ▼ ▼ 

Memory   Reflection  Strategy 

▼ ▼ ▼ 

┌─────────────────────────┐ │      Memory Layer       │ │ Redis + PostgreSQL      │ └────────────┬────────────┘ │ ▼ ┌─────────────────────────┐ │      Gemini Models      │ │      Google AI API      │ └─────────────────────────┘ 

## Technology Stack 

Frontend 

Next.js 15 

React 

TypeScript 

TailwindCSS shadcn/ui 

Reason: 

Fast development 

Excellent DX 

Production ready 

Large ecosystem 

## Backend 

Next.js Route Handlers 

TypeScript 

Reason: 

Single codebase 

Faster shipping 

Lower complexity 

For hackathon: 

No separate Express server 

## Agent Layer 

LangGraph 

LangChain 

Reason: 

State management 

Agent orchestration 

Conditional workflows Easy debugging 

This becomes the brain. 

## LLM Provider 

Primary: 

Gemini 2.5 Flash 

Reason: 

Cheap 

Fast 

Large context 

Google ecosystem 

Optional fallback: 

Gemini 2.5 Pro 

For: 

Deep reflections 

Weekly analysis 

## Database 

Primary: 

PostgreSQL 

Hosted on: 

Cloud SQL (GCP) 

Stores: 

Users 

Goals 

Tasks 

Identity 

Reflections 

Memories 

## Cache Layer 

Redis 

Stores: 

Session state 

Conversation state 

Graph state 

Recent memories 

Agent outputs 

Purpose: 

Speed 

Cost reduction 

Lower DB reads 

## Authentication 

Google OAuth 

Why: 

Fast onboarding 

Zero password management 

Hackathon friendly 

## Email Service 

Resend 

Used for: 

Morning Brief 

Night Reflection Reminder 

Important Updates 

Reason: 

Simple API 

Developer friendly 

## Hosting 

Required by Hackathon: 

Google Cloud Platform 

Deployment Target: 

Cloud Run 

Containerized using: 

Docker 

## Core System Layers 

The product consists of five layers. 

## Layer 1 — User Experience Layer 

Components: 

Dashboard 

Chat Goals Tasks 

Reflections 

Purpose: Interact with user 

This layer never contains business logic. 

Layer 2 — API Layer 

Handles: 

Authentication 

Requests 

Validation 

Rate Limits 

Agent Invocation 

Purpose: 

Gateway to the brain 

## Layer 3 — Agent Layer 

Contains: 

Companion Agent 

Strategy Agent 

Execution Agent 

Reflection Agent Identity Agent Memory Agent Managed by: LangGraph 

Purpose: 

Decision making 

Layer 4 — Memory Layer 

Contains: 

Long-term memory 

Reflections 

Identity 

Goals 

Patterns 

Purpose: 

Knowledge persistence 

## Layer 5 — Intelligence Layer 

Contains: 

Gemini Models 

Purpose: 

Reasoning 

Planning 

Analysis 

## Agent Architecture 

The frontend never talks directly to agents. 

Flow: 

User Message ↓ Companion Agent ↓ LangGraph Router ↓ Required Agents ↓ Response 

This ensures: 

## Single conversational interface 

for the user. 

## Companion Agent 

Role: 

Face of the product 

Responsibilities: 

Talk to user 

Maintain relationship 

Answer questions 

Route requests 

Never: 

Directly modify memory 

## Memory Agent 

## Role: 

Knowledge Manager 

Responsibilities: 

Store memory 

Retrieve memory 

Rank memory 

Compress memory 

Owns: 

Memory System 

## Reflection Agent 

Role: 

Learning Engine 

Responsibilities: Daily reflection 

Weekly reflection 

Pattern detection 

Insight generation 

## Identity Agent 

Role: 

Identity Guardian Responsibilities: 

Identity updates 

Evidence validation 

Identity evolution 

## Strategy Agent 

Role: 

Long-term planner 

Responsibilities: 

Goals 

Roadmaps 

Prioritization 

## Execution Agent 

Role: 

Day-to-day planner 

Responsibilities: 

Tasks 

Scheduling 

Workload balancing 

## Data Flow 

Chat Request: 

User ↓ API ↓ Companion Agent ↓ Memory Retrieval ↓ Relevant Agents ↓ Response ↓ Reflection Queue 

Important: 

Reflection happens asynchronously. 

Never block chat. 

## Reflection Pipeline 

Nightly: 

Conversations ↓ Reflection Agent ↓ Observations ↓ Identity Proposals ↓ Identity Agent Review ↓ Memory Updates 

This is how learning occurs. 

## Memory Pipeline 

When new information arrives: 

Conversation ↓ Memory Candidate ↓ Admission Policy ↓ Memory Store 

Only valuable information survives. 

## Context Assembly Pipeline 

Before every LLM call: 

User Message ↓ 

Intent Detection ↓ Memory Retrieval ↓ Ranking ↓ Top Memories ↓ Prompt Construction ↓ Gemini 

This minimizes token usage. 

## Cost Optimization Principles 

Rule 1: 

Do not call all agents. 

Only invoke necessary agents. 

Rule 2: 

Retrieve memories first. 

Avoid huge prompts. 

## Rule 3: 

Use summaries. 

Not raw conversation history. 

## Rule 4: 

Cache aggressively. 

Use Redis whenever possible. 

## Event System 

The system supports internal events. 

Examples: 

Task Completed 

Goal Created 

Reflection Generated 

Identity Updated Deadline Approaching Events may trigger workflows. 

## Morning Brief Workflow 

Scheduler ↓ Execution Agent ↓ Strategy Agent ↓ Email Generation ↓ User 

Output: 

Today's Focus 

Risks 

Priorities 

## Night Reflection Workflow 

Scheduler ↓ Reflection Agent ↓ Daily Summary ↓ Email ↓ User 

Purpose: 

Build habit loop 

## Security Principles 

Never store: 

Raw passwords 

Always: OAuth 

Encrypt: Sensitive user data 

Limit: 

Prompt logging 

Use: 

Environment variables 

for all secrets. 

## MVP Scope Lock 

The following are IN SCOPE: 

Chat Goals Tasks Memory Identity Reflections Morning Brief Night Reflection Email Nudges The following are OUT OF SCOPE: Voice Calls Mobile App Browser Extension News Agent 

Opportunity Discovery Team Collaboration 

WhatsApp Integration Knowledge Graph Future versions only. 

## Success Criteria 

A successful implementation should make the user feel: 

I don't need to carry everything in my head anymore. 

The AI already knows what matters. 

The AI helps me focus on execution. 

That is the core promise of the product. 

## Architecture Principle 

Every feature should pass this test: 

Does this reduce cognitive load? 

Does this strengthen trust? 

If the answer is no: 

Do not build it. 

This principle governs the entire system architecture. 

