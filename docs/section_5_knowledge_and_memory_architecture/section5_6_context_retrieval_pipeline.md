# Section 5.6 — Context Retrieval Pipeline

## Purpose

Define how the system decides what information should be included when the user sends a message.

This is one of the most important parts of the architecture because it controls relevance, cost, latency, and quality.

---

# Core Principle

Do not send the entire memory universe to the LLM.

Instead:

1. Understand the user’s current intent
2. Retrieve only relevant memory
3. Rank the retrieved information
4. Compress the context
5. Build a focused prompt
6. Call the LLM only with what it actually needs

---

# High-Level Flow

```text
User Message
    ↓
Intent Detection
    ↓
Memory Query
    ↓
Candidate Retrieval
    ↓
Ranking & Filtering
    ↓
Context Assembly
    ↓
Prompt Compression
    ↓
LLM Call
    ↓
Response
```

---

# Stage 1 — User Message

The process begins when the user sends a message.

Examples:

```text
Plan my day.
I feel overwhelmed.
What should I focus on today?
I have a hackathon deadline tomorrow.
```

At this stage, the system only knows the raw input.

---

# Stage 2 — Intent Detection

The first job is to determine what kind of request this is.

Possible intents:

```text
Planning
Reflection
Chat
Schedule Update
Goal Update
Quick Question
Opportunity Search
```

Why this matters:

- Different intents need different memory types
- Different intents require different agents
- Different intents need different prompt shapes

Example:

```text
"Plan my day" -> Planning
"I'm tired today" -> Reflection / Support
"When is my assignment due?" -> Schedule Query
```

Owner:
- Companion Agent or a lightweight classifier node

Output:
- Intent label
- Confidence score

---

# Stage 3 — Memory Query

Once intent is known, the system asks memory for relevant information.

The Memory Agent should query across the correct sources:

- Identity memory
- Goal memory
- Episodic memory
- Semantic memory
- Current state
- Recent summaries

Example:

If the user says:

```text
Plan my day.
```

The system may request:

- Current deadlines
- Important goals
- Recent behavior patterns
- Work preferences
- Pending tasks
- Last few reflections

---

# Stage 4 — Candidate Retrieval

The memory system returns a larger pool of candidates than needed.

This is intentional.

Example:

```text
10–50 possible memories
```

Why?

Because retrieval should be broad before it becomes narrow.

Candidate examples:

```text
User prefers evening study sessions.
User has a hackathon deadline on Sunday.
User gets distracted after lunch.
User wants to build an AI startup.
User missed a workshop last week.
```

At this stage, nothing is final yet.

---

# Stage 5 — Ranking and Filtering

Now the system sorts the candidates by relevance.

Ranking signals may include:

```text
Relevance to current message
Confidence
Recency
Importance
Goal alignment
Behavioral usefulness
```

Example ranking formula:

```text
Final Score = Relevance × Importance × Confidence × Freshness
```

Important rule:

- A memory can be recent but unimportant
- A memory can be important but old
- The pipeline should balance both

Example:

```text
"I have a hackathon tomorrow"
```

High ranking:
- Hackathon deadline
- Current workload
- Related goal
- Recent stress pattern

Low ranking:
- Favorite food
- Random old chat joke
- Outdated one-time note

---

# Stage 6 — Context Assembly

After ranking, the system builds the final context bundle.

This bundle should contain only what the LLM needs.

Example context bundle:

```text
User identity:
- College student
- Wants to become an AI engineer
- Prefers direct communication

Current goal:
- Hackathon submission due Sunday

Recent pattern:
- Works best after 8 PM
- Procrastinates when overloaded

Current schedule:
- College assignment
- DSA practice
- Hackathon planning
```

Why this matters:

- Keeps prompt small
- Improves response quality
- Reduces hallucination
- Lowers token cost

---

# Stage 7 — Prompt Compression

The assembled context should be compressed into a concise prompt format.

The prompt should answer only what matters.

Example structure:

```text
User goal
Current situation
Important memory
Relevant constraints
Required action
```

Example final prompt:

```text
The user is a college student preparing for a hackathon due Sunday.
They want to become an AI engineer.
They work best at night and tend to lose focus after lunch.
Their current workload includes an assignment, DSA practice, and hackathon planning.
Create a realistic day plan that reduces overload and protects the hackathon deadline.
```

This is much better than sending raw conversation logs.

---

# Stage 8 — LLM Call

Only after the context is assembled and compressed should the LLM be called.

The LLM should receive:

- The user message
- The small, ranked context bundle
- The current workflow objective
- Any required constraints

The LLM should not receive:

- Entire chat history
- Unfiltered memory dumps
- Irrelevant task logs
- Repeated summaries

---

# Stage 9 — Response Generation

The LLM returns the output.

Examples:

- Daily plan
- Reflection response
- Advice
- Schedule draft
- Email draft
- Summary

The Companion Agent then turns this into a clear, human response.

---

# Retrieval Modes

Different flows need different retrieval strategies.

## 1. Planning Mode
Used when the user asks for help organizing time.

Retrieve:
- Goals
- Deadlines
- Preferences
- Current workload
- Recent behavior patterns

---

## 2. Reflection Mode
Used when the user shares feelings or updates.

Retrieve:
- Past reflections
- Identity profile
- Recent emotional patterns
- Relevant milestones

---

## 3. Chat Mode
Used for general conversation.

Retrieve:
- Core identity
- Important recent memories
- Active context only

---

## 4. Schedule Update Mode
Used when a deadline or task changes.

Retrieve:
- Calendar
- Execution state
- Conflicts
- Current priorities

---

## 5. Opportunity Mode
Used when searching for useful opportunities.

Retrieve:
- Role
- Goals
- Skills
- Geography
- Current ambitions

---

# Ranking Rules

The system should prefer memories that are:

- Relevant to the message
- High confidence
- Recent enough to still matter
- Important to the user’s goals
- Useful for planning or personalization

The system should reject memories that are:

- Too old
- Too vague
- Low confidence
- Off-topic
- Emotionally noisy but strategically useless

---

# Example Retrieval Scenarios

## Scenario 1 — “Plan my day”

Retrieve:
- Today’s schedule
- Current deadlines
- Preferred work hours
- Energy pattern
- Current task priorities

---

## Scenario 2 — “I feel stuck”

Retrieve:
- Recent reflections
- Stress patterns
- Identity goals
- Past struggles
- Support style preferences

---

## Scenario 3 — “Should I apply for this hackathon?”

Retrieve:
- Long-term goals
- Current workload
- Past hackathon behavior
- Confidence level
- Relevant opportunity preferences

---

# Design Outcome

The Context Retrieval Pipeline ensures that the AI behaves like a selective thinker, not a memory dump.

It should ask:

> What does the model need right now?

not

> What does the model know about the user?

This is how we keep the system:
- cheap
- relevant
- fast
- accurate
- emotionally coherent
