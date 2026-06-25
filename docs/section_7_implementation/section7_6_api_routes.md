Implementation 6 — API Routes

Purpose

This document defines all backend API routes required for the MVP.

The API layer acts as the bridge between:

Frontend
↓
LangGraph
↓
Database
↓
Redis
↓
AI Agents

The frontend should never directly interact with:

PostgreSQL

Redis

LangGraph

Gemini

Everything goes through API routes.

API Design Principles

Rule 1

Thin Controllers

Route handlers should:

Validate

Authenticate

Call Services

Return Response

They should NOT contain business logic.

Rule 2

All AI workflows go through LangGraph

Never call agents directly from route handlers.

Rule 3

User-facing routes only

The frontend should not know internal architecture.

Route Groups

/auth

/chat

/goals

/tasks

/reflections

/identity

/dashboard

/briefings

/system

Authentication Routes

POST /api/auth/login

Purpose:

Authenticate User

Method:

POST

Handled by:

Google OAuth

Response:

{
  "success": true,
  "user": {}
}

POST /api/auth/logout

Purpose:

Terminate Session

Response:

{
  "success": true
}

GET /api/auth/me

Purpose:

Get Current User

Response:

{
  "id": "user_id",
  "name": "Achyut",
  "email": "..."
}

Chat Routes

Most important API group.

POST /api/chat

Purpose:

Primary user interaction endpoint

Frontend sends:

{
  "message": "I feel overwhelmed."
}

Flow:

API
↓
LangGraph
↓
Companion Agent
↓
Router
↓
Required Agents
↓
Response

Response:

{
  "message": "...",
  "metadata": {}
}

GET /api/chat/history

Purpose:

Load conversation history

Response:

{
  "messages": []
}

GET /api/chat/conversations

Purpose:

Load user conversations

Response:

{
  "conversations": []
}

Goal Routes

POST /api/goals

Purpose:

Create Goal

Request:

{
  "title": "Win Hackathon",
  "targetDate": "2026-07-01"
}

Flow:

Goal Created
↓
Strategy Agent
↓
Milestones Generated

GET /api/goals

Purpose:

Fetch Goals

Response:

{
  "goals": []
}

GET /api/goals/:goalId

Purpose:

Get Single Goal

PATCH /api/goals/:goalId

Purpose:

Update Goal

DELETE /api/goals/:goalId

Purpose:

Archive Goal

Task Routes

POST /api/tasks

Purpose:

Create Task

Usually called internally.

Response:

{
  "task": {}
}

GET /api/tasks

Purpose:

Get Tasks

Filters:

Today

Upcoming

Completed

PATCH /api/tasks/:taskId

Purpose:

Update Task Status

Example:

{
  "status": "completed"
}

DELETE /api/tasks/:taskId

Purpose:

Delete Task

Reflection Routes

GET /api/reflections

Purpose:

Get Reflection History

Response:

{
  "reflections": []
}

GET /api/reflections/latest

Purpose:

Get Latest Reflection

Response:

{
  "summary": "...",
  "insights": []
}

POST /api/reflections/generate

Purpose:

Generate Reflection

Normally:

Internal Use

Flow:

Messages
↓
Reflection Agent
↓
Reflection Stored

Identity Routes

GET /api/identity

Purpose:

Get Identity Profile

Response:

{
  "coreIdentity": [],
  "aspirations": [],
  "principles": [],
  "patterns": []
}

GET /api/identity/timeline

Purpose:

Identity Evolution

Response:

{
  "timeline": []
}

Example:

Learner
↓
Builder
↓
Founder-Minded Builder

Dashboard Routes

These power the Home Screen.

GET /api/dashboard

Purpose:

Load Dashboard

Response:

{
  "greeting": "...",
  "focusTask": "...",
  "topGoal": "...",
  "risk": "...",
  "progress": {}
}

Built using:

Memory Agent

Strategy Agent

Execution Agent

GET /api/dashboard/summary

Purpose:

Quick Dashboard Snapshot

Cached in Redis.

Briefing Routes

GET /api/briefings/morning

Purpose:

Get Today's Brief

Response:

{
  "priorities": [],
  "risks": [],
  "focus": ""
}

GET /api/briefings/night

Purpose:

Get Night Reflection

Response:

{
  "wins": [],
  "lessons": [],
  "tomorrow": []
}

POST /api/briefings/send

Purpose:

Send Email Brief

Internal endpoint.

Triggered by scheduler.

Memory Routes

Hidden from frontend navigation.

Useful for debugging.

GET /api/memory/profile

Purpose:

Inspect Memory State

Response:

{
  "identity": [],
  "goals": [],
  "patterns": []
}

POST /api/memory/rebuild

Purpose:

Rebuild Memory Index

Admin/Internal use.

System Routes

Internal platform endpoints.

GET /api/system/health

Purpose:

Health Check

Response:

{
  "status": "healthy"
}

Used by:

Cloud Run

GET /api/system/version

Purpose:

Deployment Metadata

Response:

{
  "version": "0.1.0"
}

Scheduler Endpoints

Called automatically.

Not user-facing.

POST /api/system/jobs/morning-brief

Flow:

Scheduler
↓
Strategy Agent
↓
Execution Agent
↓
Email

POST /api/system/jobs/night-reflection

Flow:

Scheduler
↓
Reflection Agent
↓
Email

POST /api/system/jobs/weekly-review

Flow:

Reflection Agent
↓
Identity Agent
↓
Memory Updates

Suggested Folder Structure

src/

app/api/

├── auth/
├── chat/
├── goals/
├── tasks/
├── reflections/
├── identity/
├── dashboard/
├── briefings/
└── system/

Services:

src/services/

chat.service.ts

memory.service.ts

strategy.service.ts

reflection.service.ts

identity.service.ts

LangGraph:

src/langgraph/

graph.ts

nodes/

router.ts

companion.ts

memory.ts

strategy.ts

execution.ts

reflection.ts

identity.ts

MVP Routes Only

For the hackathon, only build:

POST /api/chat

GET /api/dashboard

GET /api/goals

POST /api/goals

GET /api/tasks

PATCH /api/tasks/:id

GET /api/reflections/latest

GET /api/identity

GET /api/briefings/morning

Everything else is secondary.

API Success Criteria

The API layer should make it possible for the frontend to think:

There is one intelligent companion.

while hiding:

LangGraph

Redis

Postgres

Agent Orchestration

Memory Retrieval

The frontend should never need to know how the intelligence works.

Only what the intelligence returns.

Architecture Principle

Routes expose capabilities.

Agents contain intelligence.

Database stores truth.

Redis stores state.

LangGraph orchestrates everything.

Keep those responsibilities separate.