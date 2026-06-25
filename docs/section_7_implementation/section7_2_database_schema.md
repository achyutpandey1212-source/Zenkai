## Implementation 2 — Database Schema 

## Purpose 

This document defines the database architecture for the AI Growth Partner. 

Goals: 

- Keep implementation simple 

- Support long-term memory 

- Support identity evolution 

- Support reflections 

- Minimize complexity during hackathon 

- Scale cleanly after hackathon 

Primary Database: 

PostgreSQL 

Hosted on: 

Google Cloud SQL 

## Database Design Principles 

Rule 1: 

Store facts. 

Rule 2: 

Store relationships. 

Rule 3: 

Never store derived intelligence if it can be regenerated. 

Example: 

Store: 

Reflection Result 

Do not store: 

Entire Prompt History 

## Entity Relationship Overview 

User │ ├── Goals │ ├── Tasks │ ├── Memories │ ├── Reflections │ ├── Identity Traits │ ├── Conversations │ └── Agent Events 

Table: users 

Represents the account owner. 

users 

Fields: **id** UUID **PRIMARY KEY** 

email TEXT **UNIQUE** 

name TEXT 

avatar_url TEXT 

created_at TIMESTAMP 

updated_at TIMESTAMP Example: 

{ "id":"user_123", "email":"achyut@gmail.com", "name":"Achyut" } 

## Table: user_profiles 

Stores onboarding information. 

Purpose: 

Current state of user 

Fields: 

**id** UUID **PRIMARY KEY** 

user_id UUID 

profession TEXT education TEXT timezone TEXT current_focus TEXT 

created_at TIMESTAMP 

updated_at TIMESTAMP 

Example: 

{ "profession":"Student Developer", "current_focus":"Hackathon" } 

## Table: aspirations 

Long-term ambitions. Examples: Become AI Entrepreneur 

Become Software Engineer 

Build Startup 

Fields: **id** UUID **PRIMARY KEY** 

user_id UUID 

title TEXT description TEXT priority INTEGER active BOOLEAN 

created_at TIMESTAMP 

## Table: goals 

Medium-term goals. 

Examples: Launch MVP 

Complete Hackathon 

Master LangGraph 

Fields: 

**id** UUID **PRIMARY KEY** 

user_id UUID 

title TEXT 

description TEXT 

status TEXT 

priority INTEGER target_date DATE created_at TIMESTAMP 

updated_at TIMESTAMP Status values: 

active 

completed paused 

cancelled 

## Table: tasks 

Execution layer. Fields: 

**id** UUID **PRIMARY KEY** 

user_id UUID 

goal_id UUID 

title TEXT 

description TEXT status TEXT 

priority INTEGER 

estimated_minutes INTEGER 

scheduled_for TIMESTAMP 

completed_at TIMESTAMP 

created_at TIMESTAMP 

Status: 

todo 

in_progress 

completed 

missed 

## Table: conversations 

Stores chat sessions. 

Purpose: 

Conversation history 

Fields: 

**id** UUID **PRIMARY KEY** 

user_id UUID 

title TEXT 

started_at TIMESTAMP 

ended_at TIMESTAMP 

## Table: messages 

Stores actual messages. Fields: 

**id** UUID **PRIMARY KEY** 

conversation_id UUID 

**role** TEXT 

content TEXT 

created_at TIMESTAMP 

Role: 

user 

assistant system 

Important: Messages are NOT memory. Messages are raw data. 

## Table: memories 

Core memory system. Purpose: 

Long-term knowledge 

Fields: 

**id** UUID **PRIMARY KEY** 

user_id UUID 

memory_type TEXT 

content TEXT 

**summary** TEXT 

FLOAT confidence 

importance FLOAT 

status TEXT 

created_at TIMESTAMP 

updated_at TIMESTAMP 

Status: 

candidate 

proposal 

approved 

archived 

Memory Types: 

identity 

aspiration 

principle 

behavior 

constraint 

pattern 

goal 

reflection 

## Table: memory_evidence 

Stores evidence supporting memory. 

Purpose: 

Prevent hallucinated memory 

Fields: 

**id** UUID **PRIMARY KEY** 

memory_id UUID source_type TEXT source_id UUID evidence_text TEXT created_at TIMESTAMP 

Example: User repeatedly mentions startup ambitions 

## Table: reflections 

Stores reflection outputs. Fields: 

**id** UUID **PRIMARY KEY** 

user_id UUID 

reflection_type TEXT 

content TEXT 

**summary** TEXT 

FLOAT confidence 

created_at TIMESTAMP 

Types: 

session 

daily 

weekly monthly 

## Table: reflection_insights 

Insights extracted from reflections. 

Fields: 

**id** UUID **PRIMARY KEY** 

reflection_id UUID insight_type TEXT content TEXT FLOAT confidence 

created_at TIMESTAMP 

Example: 

Works best after 8 PM 

## Table: identity_traits 

Most important table. 

Purpose: 

Defines who user is 

Fields: 

**id** UUID **PRIMARY KEY** 

user_id UUID 

trait TEXT 

**category** TEXT 

FLOAT confidence status TEXT 

created_at TIMESTAMP updated_at TIMESTAMP Categories: core_identity aspiration principle behavior_pattern current_state 

Status: 

candidate 

active 

deprecated 

## Table: identity_proposals 

Created by Reflection Agent. Reviewed by Identity Agent. 

Fields: 

**id** UUID **PRIMARY KEY** 

user_id UUID 

trait TEXT 

**category** TEXT 

FLOAT confidence 

reason TEXT 

status TEXT 

created_at TIMESTAMP 

Status: 

pending 

approved 

rejected 

## Table: agent_events 

Tracks internal system activity. 

Purpose: 

Debugging 

Analytics 

Observability 

Fields: 

**id** UUID **PRIMARY KEY** 

user_id UUID 

agent_name TEXT 

event_type TEXT 

payload JSONB created_at TIMESTAMP 

Examples: 

memory_created reflection_generated goal_updated identity_updated 

## Table: daily_briefs 

Stores generated morning briefs. Fields: 

**id** UUID **PRIMARY KEY** 

user_id UUID 

content TEXT 

generated_at TIMESTAMP 

## Table: nightly_reflections 

Stores nightly summaries. 

Fields: 

**id** UUID **PRIMARY KEY** 

user_id UUID 

content TEXT 

generated_at TIMESTAMP 

## Table: scheduled_jobs 

Used for automation. 

Fields: 

**id** UUID **PRIMARY KEY** 

user_id UUID 

job_type TEXT 

status TEXT 

scheduled_for TIMESTAMP 

executed_at TIMESTAMP 

Job Types: 

morning_brief 

night_reflection 

weekly_review 

monthly_review 

## Vector Search Support 

Future-ready table. 

Can be added immediately or later. 

memory_embeddings 

Fields: 

**id** UUID **PRIMARY KEY** 

memory_id UUID embedding VECTOR(1536) 

Purpose: Semantic retrieval 

Used by: Memory Agent 

## Recommended MVP Tables 

For hackathon MVP we only NEED: 

users user_profiles goals tasks conversations messages memories reflections identity_traits 

Everything else can be added gradually. 

## Data Ownership Rules 

Companion Agent: 

## Read only 

Memory Agent: Read + Write memories 

Reflection Agent: Read + Write reflections Identity Agent: Read + Write identity_traits 

Strategy Agent: Read goals identity memories 

Execution Agent: Read + Write tasks 

## Database Growth Strategy 

Phase 1: 

Single PostgreSQL instance 

Phase 2: 

Postgres + Redis 

Phase 3: 

Postgres + Redis + Vector Search 

## Architecture Principle 

The database should answer three questions: 

What happened? 

What was learned? 

Who is the user becoming? 

Everything stored in the system must contribute to answering one of those three questions. Anything else is noise. 

