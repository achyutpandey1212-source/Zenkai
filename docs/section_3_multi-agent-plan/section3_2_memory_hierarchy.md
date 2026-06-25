# Section 3.2 — Memory Hierarchy

## Purpose

The product needs memory that is useful, stable, and selective. The AI should not remember everything equally. It should treat different kinds of information with different importance, just like a human mind does.

This section defines a layered memory system so the AI can:
- recall the right context quickly,
- avoid overloading itself with irrelevant details,
- update user understanding over time,
- keep long-term trust by remembering what matters,
- and forget what should not be kept forever.

---

## Why Memory Needs a Hierarchy

A single flat memory store would be too noisy.

Example:
- “User likes React” is a stable useful fact.
- “User ate pizza today” is probably not important.
- “User feels overwhelmed before deadlines” is highly important.
- “User wants to win hackathons” is a core long-term goal.

If every detail is stored the same way, the AI becomes cluttered, slower, and less accurate. A hierarchy lets the system decide what to remember, what to keep temporarily, and what to treat as an evolving hypothesis.

---

## Memory Layers

### 1. Working Memory
This is the short-lived memory used inside the current interaction or workflow.

**Contains**
- current user message
- current agent outputs
- active task context
- temporary reasoning artifacts
- intermediate graph state

**Purpose**
- support the current response
- help agents collaborate inside one workflow
- vanish after the workflow completes unless something is promoted to a deeper layer

**Examples**
- “User said they are free after 8 PM.”
- “Schedule conflict detected for tomorrow morning.”
- “Current goal: finish hackathon work.”

**Important rule**
Working memory should never be treated as permanent truth.

---

### 2. Session Memory
This is memory for the current day or current session of interaction.

**Contains**
- what the user discussed today
- immediate planning changes
- recent emotional tone
- recent schedule updates
- active conversations still in progress

**Purpose**
- keep the user experience consistent during one day
- avoid asking the same thing repeatedly
- support continuity across a few back-and-forth interactions

**Examples**
- “User wants to focus on hackathon architecture today.”
- “User asked to move DSA to evening.”
- “User is feeling highly motivated right now.”

**Important rule**
Session memory should expire naturally unless promoted.

---

### 3. Episodic Memory
This stores meaningful events or moments from the user’s journey.

**Contains**
- completed milestones
- failures and recoveries
- major deadlines
- important conversations
- reflections that shaped future behavior
- moments of progress or burnout

**Purpose**
- create continuity over time
- let the AI refer back to meaningful experiences
- help the AI understand the user’s growth story

**Examples**
- “User submitted first hackathon project.”
- “User missed a deadline and felt bad about it.”
- “User said they work best after lunch.”
- “User had a strong week of consistency.”

**Important rule**
Episodic memories should be written only when something is actually worth remembering.

---

### 4. Semantic Memory
This stores stable facts and user patterns.

**Contains**
- work preferences
- routine patterns
- recurring struggles
- favorite tools
- strong likes/dislikes
- stable identity-related information
- repeated behavioral observations

**Purpose**
- power personalization
- improve decision-making
- help the AI act like it knows the user over time

**Examples**
- “User prefers building over watching tutorials.”
- “User tends to procrastinate when tasks feel too big.”
- “User works better with a calm, structured interface.”
- “User is most motivated by ambitious goals.”

**Important rule**
Semantic memory should only hold information that has proven useful over time.

---

### 5. Long-Term Memory
This is the most stable layer.

**Contains**
- core goals
- major identity aspirations
- long-running habits
- strong preferences
- high-confidence behavioral patterns
- promises the user made repeatedly
- important personal context that should survive across many sessions

**Purpose**
- preserve the user’s story
- keep the AI aligned with long-term growth
- help the AI speak with continuity months later

**Examples**
- “User wants to become a successful AI engineer.”
- “User wants to win hackathons.”
- “User values clear, calm, premium UI.”
- “User wants the AI to be strict but supportive.”

**Important rule**
Long-term memory should be updated slowly and carefully.

---

## Memory Promotion Flow

Not everything should jump into long-term memory immediately.

A memory item should move through layers like this:

1. **Working Memory**  
   Temporary detail inside the current interaction.

2. **Session Memory**  
   Detail still relevant for today.

3. **Episodic Memory**  
   Important event worth keeping.

4. **Semantic Memory**  
   Repeated or stable behavioral pattern.

5. **Long-Term Memory**  
   Strongly validated fact or core preference.

This promotion flow prevents the system from over-remembering random things too early.

---

## Memory Write Rules

The system should store something only if it helps one of these:
- planning better,
- understanding the user better,
- improving trust,
- reducing cognitive load,
- or creating a meaningful long-term narrative.

If it does not help any of those, it should probably not be saved.

Examples:
- Store: “User gets overwhelmed when too many deadlines stack together.”
- Store: “User prefers night planning and morning execution.”
- Store: “User wants help staying consistent with hackathon work.”
- Do not store: “User mentioned pizza.”

---

## Memory Read Rules

When an agent asks for memory, the memory system should return only what is relevant.

The AI should not dump everything back into context.

**Examples**
- Planning Agent asks for current goals and deadlines.
- Reflection Agent asks for recent patterns and missed commitments.
- Companion Agent asks for user preferences and tone history.
- Identity Agent asks for stable personality and work-style patterns.

This keeps the system sharp instead of bloated.

---

## Memory Update Rules

Memory updates should happen in a controlled way.

### Safe updates
- update the current session
- append a useful episode
- refine a behavioral hypothesis
- store a stable preference after repeated evidence

### Sensitive updates
Some information should require stronger confidence before it becomes long-term memory.

Examples:
- emotional patterns
- work habits
- recurring struggles
- identity-level traits

The system should not overreact to one bad day or one emotional conversation.

---

## Forgetting

Forgetting is part of good memory.

The AI should be able to:
- expire temporary details,
- drop stale session context,
- lower confidence in old patterns,
- and remove memories that no longer help.

Forgetting keeps the system clean and prevents bad assumptions from living forever.

---

## How This Helps the Product

A memory hierarchy makes the product feel:
- more human,
- more reliable,
- more personal,
- and more intelligent over time.

It also helps the AI become better at:
- planning,
- timing,
- encouragement,
- rescheduling,
- and understanding user behavior.

This is one of the main reasons the product can feel like a real partner instead of a generic chatbot.

---

## Product Rule

**The AI should remember what improves the user’s future, not everything the user said.**

That principle keeps the memory system trustworthy, useful, and lightweight.

---

## Outcome

With this hierarchy in place, the product can:
- remember the right things,
- forget the wrong things,
- and build a stable long-term relationship with the user.

That is what makes the AI feel alive, helpful, and consistent.
