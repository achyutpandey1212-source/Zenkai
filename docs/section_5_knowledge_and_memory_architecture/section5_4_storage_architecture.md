# Section 5.4 — Storage Architecture

## Purpose
Define where each category of knowledge and runtime state lives so the system stays fast, cheap, and easy to debug.

## Core Principle
Use the cheapest storage layer that correctly solves the problem.  
Do not send information to an LLM unless reasoning or language generation is actually needed.

---

## 1. MongoDB — Persistent Structured Data

MongoDB stores durable application data that should survive across sessions and be easy to query directly.

### Store here
- User profile
- Identity profile
- Goals and aspirations
- Tasks
- Calendar events
- Weekly reflections
- User settings
- Permission state
- Saved opportunities
- System logs that matter long-term

### Why MongoDB
- Flexible schema
- Easy to query
- Good for product data
- Good for long-lived records

---

## 2. Redis — Working Memory and Fast State

Redis stores short-lived state that is needed during live workflows and should be accessed quickly.

### Store here
- Current graph state
- Active workflow context
- Temporary conversation state
- Cached briefings
- Pending schedule drafts
- Session-level memory
- Rate-limit counters
- Deduplication flags
- Job locks / task coordination

### Why Redis
- Very fast reads and writes
- Ideal for temporary state
- Useful for checkpointing and workflow continuity
- Great for caching generated outputs

---

## 3. Vector Store — Semantic Memory

A vector store keeps embeddings for memory retrieval based on meaning rather than exact text.

### Store here
- Past conversations
- Important reflections
- User preferences expressed in natural language
- Behavioral observations
- Relationship milestones
- Compressed summaries of long chats

### Why a Vector Store
- Supports meaning-based retrieval
- Finds related memories even when wording changes
- Helps personalize responses using semantic similarity

### Possible implementations
- MongoDB Atlas Vector Search
- Local vector storage for development
- Any lightweight vector DB if needed later

---

## 4. LangGraph State — Runtime Graph Data

LangGraph state should hold the data that moves through a single workflow execution.

### Store here
- Current input message
- Retrieved memory snippets
- Agent outputs for the current run
- Intermediate reasoning artifacts
- Confidence values
- Branch decisions
- Final response draft

### Why
- Keeps workflows explicit
- Makes debugging easier
- Prevents agents from depending on hidden state

---

## 5. Cache Layer — Reusable Results

Cache any output that is expensive to generate but can safely be reused.

### Cache here
- Daily briefing output
- Repeated prompt results
- Opportunity feed results
- Common retrieval results
- Frequently used summaries

### Why
- Reduces token cost
- Reduces latency
- Prevents recomputation

---

## Storage Design Rules

### Rule 1 — Permanent data belongs in MongoDB
If the system should remember it across many sessions, store it in MongoDB.

### Rule 2 — Fast temporary state belongs in Redis
If the system only needs it for a short time or within one workflow, store it in Redis.

### Rule 3 — Meaning-based recall belongs in embeddings
If the system should retrieve it by semantic similarity, store it in a vector index.

### Rule 4 — Current run data belongs in Graph State
If it only matters while one workflow is running, keep it in LangGraph state.

### Rule 5 — Expensive repeated outputs should be cached
If the output is likely to be reused, cache it before recomputing.

---

## Example: “Plan my day”

1. User sends a chat message.
2. Graph state stores the message.
3. Memory Agent fetches relevant memories from vector search.
4. Strategy Agent creates a plan.
5. Execution Agent converts the plan into schedule blocks.
6. Companion Agent writes the final response.
7. Redis stores the current workflow state.
8. MongoDB stores the updated long-term plan if needed.
9. The generated briefing may also be cached.

---

## Why this matters
A clean storage architecture keeps the product:
- faster
- cheaper
- easier to scale
- easier to debug
- easier to evolve later

It also prevents the system from sending every single decision to the LLM, which would increase cost and reduce reliability.

---

## Design Outcome
Each storage layer has one job:
- MongoDB = truth over time
- Redis = truth right now
- Vector store = meaning
- Graph state = current reasoning
- Cache = reuse

That separation is what makes the architecture stable and affordable.
