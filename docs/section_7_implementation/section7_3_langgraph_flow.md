Implementation 4 — LangGraph Flow

Purpose

This document defines how LangGraph orchestrates all agents inside the AI Growth Partner.

This is the brain of the system.

The frontend never decides which agent to call.

The user never chooses workflows.

LangGraph decides.

Core Philosophy

Traditional AI Apps:

User
 ↓
LLM
 ↓
Response

Our System:

User
 ↓
Companion Agent
 ↓
LangGraph Router
 ↓
Required Agents
 ↓
Response

The AI decides what thinking process is needed.

Why LangGraph?

We are building:

Memory

Identity

Reflection

Planning

Execution

These are not single prompts.

They are workflows.

LangGraph gives:

State Management

Agent Routing

Conditional Execution

Shared Context

Workflow Persistence

Exactly what we need.

High Level Graph

User Message
                      │
                      ▼
            Companion Agent
                      │
                      ▼
                 Router Node
          ┌───────────┼───────────┐
          ▼           ▼           ▼

      Memory      Strategy    Reflection

          ▼           ▼           ▼

            Identity Agent

                      ▼

             Execution Agent

                      ▼

            Response Builder

                      ▼

                User Reply

Important:

Not every workflow visits every node.

Shared Graph State

Every node receives the same state object.

interface GraphState {
  userId: string;

  message: string;

  intent: string;

  retrievedMemories: Memory[];

  activeGoals: Goal[];

  activeTasks: Task[];

  identityProfile: IdentityProfile;

  reflectionSummary?: string;

  executionPlan?: Plan;

  response?: string;
}

This allows agents to collaborate.

Graph Entry Point

Every workflow starts here:

User Message
 ↓
Companion Agent
 ↓
Router

Companion Agent never makes major decisions.

It only:

Understands user

Maintains tone

Extracts intent

Starts workflow

Intent Classification

Router determines:

What is the user trying to do?

Possible intents:

Chat

Planning

Task Management

Goal Management

Reflection

Identity

Memory Query

General Support

Example:

User:

“Plan my week.”

Intent:

Planning

Router Node

The Router is the most important node.

Responsibilities:

Determine intent

Select agents

Build execution path

Example:

User:

I feel overwhelmed.

Router decides:

Memory Agent
Reflection Agent
Companion Agent

Execution Agent not needed.

Workflow Type 1 — Normal Conversation

User:

How are things looking?

Flow:

Companion
 ↓
Memory
 ↓
Response Builder
 ↓
User

Purpose:

Quick response

Workflow Type 2 — Planning Request

User:

Plan my next week.

Flow:

Companion
 ↓
Memory
 ↓
Strategy
 ↓
Execution
 ↓
Response Builder

Purpose:

Generate roadmap

Workflow Type 3 — Goal Creation

User:

I want to master LangGraph.

Flow:

Companion
 ↓
Memory
 ↓
Strategy
 ↓
Goal Creation
 ↓
Execution
 ↓
Response Builder

Output:

Goal

Milestones

Tasks

Workflow Type 4 — Reflection

Triggered nightly.

No user interaction required.

Flow:

Messages
 ↓
Reflection Agent
 ↓
Insight Extraction
 ↓
Identity Review
 ↓
Memory Update

Purpose:

Learning

Workflow Type 5 — Identity Update

Triggered only when evidence exists.

Flow:

Reflection Output
 ↓
Identity Proposal
 ↓
Identity Agent
 ↓
Accept / Reject
 ↓
Memory Update

Purpose:

Identity evolution

Workflow Type 6 — Morning Brief

Triggered automatically.

Flow:

Scheduler
 ↓
Memory
 ↓
Strategy
 ↓
Execution
 ↓
Companion
 ↓
Email Generation

Output:

Top Priorities

Risks

Focus Area

Workflow Type 7 — Night Reflection

Triggered automatically.

Flow:

Scheduler
 ↓
Reflection Agent
 ↓
Companion
 ↓
Email Generation

Output:

Wins

Lessons

Tomorrow Focus

Memory Retrieval Node

Almost every workflow uses memory.

Flow:

Query
 ↓
Memory Retrieval
 ↓
Ranking
 ↓
Top Memories
 ↓
Graph State

Returns:

Identity

Goals

Relevant Reflections

Behavior Patterns

Active Constraints

Strategy Agent Node

Responsibilities:

Prioritization

Goal Planning

Long-Term Thinking

Roadmaps

Input:

Goals

Identity

Reflections

Output:

Strategic Plan

Example:

Complete Hackathon

Delay Secondary Course

Reduce Active Projects

Execution Agent Node

Responsibilities:

Scheduling

Task Breakdown

Daily Planning

Input:

Strategic Plan

Output:

Tasks

Timeline

Work Blocks

Reflection Agent Node

Responsibilities:

Pattern Detection

Learning

Insight Extraction

Input:

Messages

Tasks

Goal Progress

Output:

Observations

Patterns

Recommendations

Example:

Most productive after 8 PM.

Identity Agent Node

Responsibilities:

Identity Evolution

Validation

Trait Updates

Input:

Reflection Insights

Output:

Identity Updates

Example:

Builder

Founder-Minded

High Ownership

Response Builder Node

Final step.

Input:

Agent Outputs

Responsibilities:

Merge Information

Remove Duplicates

Maintain Tone

Generate Final Reply

Output:

Single Natural Response

The user never sees agent outputs.

Only final response.

Conditional Edges

One of LangGraph’s biggest strengths.

Example:

Need Planning?

YES:

Strategy Agent

NO:

Skip

Example:

Identity Update Needed?

YES:

Identity Agent

NO:

Skip

This reduces:

Latency

Cost

Token Usage

Asynchronous Workflows

Certain workflows should never block chat.

Examples:

Reflection Generation

Identity Updates

Memory Compression

Email Generation

These run in background.

Flow:

User Message
 ↓
Immediate Response

Background Queue
 ↓
Reflection
 ↓
Memory Update

Graph State Persistence

Graph State stored in Redis.

Flow:

Load State
 ↓
Run Graph
 ↓
Update State
 ↓
Save State

Benefits:

Continuity

Lower Cost

Shared Context

Error Recovery

If an agent fails:

Example:

Reflection Agent Error

System:

Log Error

Continue Workflow

Fallback Response

Never crash entire graph.

Observability

Every node logs:

Execution Time

Input Tokens

Output Tokens

Success Status

Error Details

Stored in:

agent_events

Useful for:

Debugging

Cost Tracking

Performance Analysis

Cost Optimization Rules

Rule 1:

Never run all agents.

Rule 2:

Memory first.

Retrieve context before calling LLMs.

Rule 3:

Use conditional routing.

Only invoke necessary nodes.

Rule 4:

Run learning workflows asynchronously.

Rule 5:

Cache graph state in Redis.

MVP Graph

For hackathon:

Only implement:

Companion Agent

Memory Agent

Strategy Agent

Execution Agent

Reflection Agent

Identity Agent

Exactly six agents.

No more.

Future Graph Expansion

After hackathon:

Potential nodes:

Opportunity Agent

News Agent

Scholarship Agent

Job Agent

Email Agent

Voice Agent

Not MVP.

Not implemented now.

Final Workflow Vision

The user should experience:

One AI.

One Conversation.

One Relationship.

Behind the scenes:

Multiple Agents

Shared State

Continuous Learning

Autonomous Planning

The user never sees the complexity.

LangGraph exists to hide complexity while enabling intelligence.

Architecture Principle

Every workflow must answer:

Does this reduce cognitive load?

Does this improve trust?

If not:

Do not add it to the graph.

This principle governs all LangGraph workflows.