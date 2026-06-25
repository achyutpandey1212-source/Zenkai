Implementation 8 — Build Roadmap

Purpose

This roadmap defines exactly what gets built, in what order, and why.

The goal is NOT:

Build everything.

The goal is:

Build the smallest version that proves the vision.

Every phase should end with:

A working GitHub commit.

At any point during development:

Main Branch = Demoable

Never spend 3 days building something that cannot be shown.

Development Philosophy

Priority Order:

1. User Experience

2. Agent Workflow

3. Memory

4. Automation

5. Polish

NOT:

Database

Infrastructure

Optimizations

Because judges buy experiences.

Not architecture diagrams.

Final MVP Scope

Must Exist:

Login

Onboarding

Home Screen

Chat

Memory

Identity

Goals

Tasks

Reflections

Morning Brief

Night Reflection

6-Agent Workflow

Everything else is optional.

Phase 0 — Project Setup

Duration:

2-4 Hours

Goal:

Project runs locally.

Deliverables

Setup:

Next.js

TypeScript

Tailwind

Shadcn

Prisma

PostgreSQL

Redis

LangGraph

Gemini

Folder Structure

Create:

src/

app/

components/

lib/

services/

langgraph/

agents/

memory/

prompts/

types/

Git Commit

git commit -m "chore: initial project setup"

Phase 1 — Frontend Skeleton

Duration:

1 Day

Goal:

UI navigation works.

No AI.

No memory.

Just screens.

Build

Authentication

Onboarding

Home

Chat

Tasks

Identity

Settings

Dummy Data

Hardcode:

Goals

Tasks

Identity

Reflections

Success Criteria

User can:

Navigate entire app.

Commit

git commit -m "feat: frontend skeleton completed"

Phase 2 — Authentication

Duration:

3-5 Hours

Goal:

Users can login.

Build

Google Auth

Session Management

Protected Routes

User Creation

Success Criteria

User logs in successfully.

Commit

git commit -m "feat: authentication implemented"

Phase 3 — Database Foundation

Duration:

4-6 Hours

Goal:

Persistence works.

Build

Tables:

users

profiles

goals

tasks

messages

memories

identity_traits

reflections

Success Criteria

CRUD works.

Commit

git commit -m "feat: database schema implemented"

Phase 4 — Chat Foundation

Duration:

1 Day

Goal:

Chat works with Gemini.

Build

POST /chat

Message Persistence

Conversation History

Companion Agent

Important

No Memory Agent yet.

Just:

User

↓

Companion

↓

Gemini

Success Criteria

Chat works.

Commit

git commit -m "feat: companion chat implemented"

Phase 5 — Memory System

Duration:

1 Day

Goal:

AI remembers users.

Build

Memory Agent

Memory Storage

Memory Retrieval

Memory Ranking

Memory Admission Policy

Success Criteria

User says:

I want to become an entrepreneur.

Later:

AI remembers it.

Commit

git commit -m "feat: memory system implemented"

Phase 6 — Identity Engine

Duration:

1 Day

Goal:

AI develops understanding of user.

Build

Identity Agent

Identity Traits

Identity Screen

Identity Confidence

Identity Proposals

Success Criteria

Identity evolves from conversations.

Commit

git commit -m "feat: identity engine implemented"

Phase 7 — Reflection Engine

Duration:

1 Day

Goal:

AI learns from behavior.

Build

Reflection Agent

Reflection Storage

Insights

Pattern Detection

Success Criteria

AI produces useful reflections.

Commit

git commit -m "feat: reflection engine implemented"

Phase 8 — Strategy Agent

Duration:

1 Day

Goal:

AI can think long-term.

Build

Goal Planning

Prioritization

Roadmaps

Milestones

Success Criteria

User creates goal.

AI creates roadmap.

Commit

git commit -m "feat: strategy engine implemented"

Phase 9 — Execution Agent

Duration:

1 Day

Goal:

Convert plans into action.

Build

Task Generation

Daily Plans

Scheduling

Work Blocks

Success Criteria

AI generates actionable tasks.

Commit

git commit -m "feat: execution engine implemented"

Phase 10 — LangGraph Integration

Duration:

1 Day

Goal:

All agents connected.

Build

Router

Graph State

Conditional Routing

Agent Nodes

Shared State

Workflow

User Message

↓

Companion

↓

Memory

↓

Strategy

↓

Execution

↓

Response

Success Criteria

Agents collaborate.

Commit

git commit -m "feat: langgraph orchestration implemented"

Phase 11 — Redis Integration

Duration:

4-6 Hours

Goal:

Speed + Continuity

Build

Session Cache

Graph State Cache

Context Cache

Identity Cache

Success Criteria

Context loads instantly.

Commit

git commit -m "feat: redis caching layer added"

Phase 12 — Morning Brief

Duration:

3 Hours

Goal:

Proactive AI behavior.

Build

Morning Summary

Email Generation

Scheduled Trigger

Success Criteria

User receives briefing.

Commit

git commit -m "feat: morning briefing system"

Phase 13 — Night Reflection

Duration:

3 Hours

Goal:

Daily learning loop.

Build

Night Reflection

Reflection Email

Daily Summary

Success Criteria

Reflection delivered.

Commit

git commit -m "feat: nightly reflection system"

Phase 14 — Demo Polish

Duration:

1 Day

Goal:

Judge Experience

Improve

Animations

Loading States

Empty States

Typography

Mobile UI

Agent Status

Add

Example User

Seed Data

Demo Account

Commit

git commit -m "feat: demo polish completed"

Phase 15 — Deployment

Duration:

4-6 Hours

Goal:

Production Deployment

Deploy

Frontend

Backend

Database

Redis

LangGraph

Target

Google Cloud Platform

Services

Cloud Run

Cloud SQL

Redis

Secret Manager

Commit

git commit -m "chore: production deployment"

Hackathon Emergency Plan

If time runs out:

Keep:

Companion

Memory

Identity

Strategy

Execution

Remove:

Email Automation

Night Reflection

Advanced Analytics

Complex Scheduling

The core experience survives.

Demo Readiness Checklist

Before presentation:

☐ Login Works

☐ Onboarding Works

☐ Chat Works

☐ Memory Works

☐ Identity Works

☐ Goal Creation Works

☐ Task Generation Works

☐ Home Screen Works

☐ LangGraph Works

☐ Deployment Works

Timeline For Current Hackathon

Assuming limited time:

Day 1

Project Setup

Frontend

Database

Day 2

Chat

Memory

Identity

Day 3

Reflection

Strategy

Execution

Day 4

LangGraph

Redis

Testing

Day 5

Morning Brief

Polish

Deployment

Success Definition

Success is NOT:

Perfect AI

Success is:

Judge opens app.

AI remembers user.

AI understands user.

AI plans for user.

AI reduces mental load.

Judge says:

"Wait... it did that automatically?"

That is the moment we are building toward.