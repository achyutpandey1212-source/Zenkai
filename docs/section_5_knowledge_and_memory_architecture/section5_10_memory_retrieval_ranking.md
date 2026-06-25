## Section 5.10 — Memory Retrieval Ranking 

## Purpose 

This document defines how the system selects the most valuable memories when constructing context for an AI response. 

The AI may eventually store: 

- thousands of conversations 

- hundreds of summaries 

- dozens of goals 

- dozens of behavioral observations 

- multiple identity insights 

However: 

## **The model should only receive the memories that matter right now.** 

Memory Retrieval Ranking determines exactly which memories enter the context window. 

## Core Philosophy 

The objective is not: 

Retrieve everything. 

The objective is: 

Retrieve the smallest amount of information that produces the best possible decision. 

Good retrieval creates: 

- better responses 

- lower token costs 

- faster execution 

- stronger personalization 

## Retrieval Pipeline 

User Message ↓ Intent Detection ↓ Memory Search ↓ Candidate Pool ↓ Memory Ranking ↓ Top-K Selection ↓ Context Assembly ↓ LLM Call 

## Retrieval Categories 

When a request arrives, memories may be retrieved from: Identity Memory Aspiration Memory Principle Memory Goal Memory Behavior Memory Constraint Memory Summary Memory Event Memory 

Not all categories are equally important. The ranking engine decides which ones deserve attention. 

## Ranking Formula 

Each memory receives a final score. 

Final Score = Relevance 

× Importance × Confidence 

× Freshness 

- × Goal Alignment 

Higher score = higher chance of entering context. 

## Ranking Factor 1 — Relevance 

## Question 

How closely related is this memory to the user's current request? 

Example: 

User says: 

Plan my day. 

Relevant memories: 

Current deadlines 

Work preferences 

Energy patterns 

Active goals 

Not relevant: 

Favorite movie 

Old casual discussions 

Completed projects from years ago 

Range: 

0.0 → 1.0 

Weight: 

Highest Priority 

## Ranking Factor 2 — Importance 

## Question 

How valuable is this memory for future decision-making? 

Example: 

High importance: 

Long-term ambition 

Core value 

Recurring weakness 

Behavioral pattern 

Low importance: 

Temporary preference 

One-off event 

Small talk 

Range: 

0.0 → 1.0 

## Ranking Factor 3 — Confidence 

## Question 

How certain are we that this memory is true? 

Example: Low confidence: Observed once High confidence: Observed repeatedly Example: User likes coding 

Mentioned once: 0.35 

Mentioned 15 times: 0.95 

Purpose: Prevents weak assumptions from influencing decisions. 

## Ranking Factor 4 — Freshness 

Question 

How recent is this memory? 

Recent information often matters more. Example: 

Hackathon due tomorrow 

Freshness: 

1.0 

Example: Deadline completed 8 months ago 

Freshness: 

0.2 

Important rule: Freshness should influence retrieval. 

It should not dominate retrieval. 

## Ranking Factor 5 — Goal Alignment 

## Question 

Does this memory help the user move toward their long-term goals? 

Example: User Goal: Become an AI entrepreneur 

Related memory: Currently building AI products Goal Alignment: 0.95 

Unrelated memory: Random entertainment discussion Goal Alignment: 0.10 

Purpose: Keep the system focused on growth. 

## Retrieval Score Example 

Memory: 

User works best after 8 PM. 

Scores: 

Relevance      = 0.95 

Importance     = 0.90 Confidence     = 0.92 Freshness      = 0.85 Goal Alignment = 0.80 

Final: 

0.95 × 0.90 × 0.92 × 0.85 × 0.80 = 0.53 

Very likely to be retrieved. 

## Candidate Pool Strategy 

The system should retrieve broadly first. 

Example: 

Vector Search ↓ 50 Candidates 

Then: Ranking Engine ↓ Top 10–15 Memories 

Then: Context Assembly 

This prevents missing important information. 

## Top-K Selection 

Never send every memory. 

## Recommended limits: 

## Simple Chat 

3–5 Memories 

## Planning Request 

10–15 Memories 

## Weekly Reflection 

15–25 Memories 

## Deep Strategic Planning 

20–30 Memories 

Even if thousands exist. 

## Memory Priority Hierarchy 

When scores are similar, prefer: 

Identity Memory ↓ Principle Memory ↓ Goal Memory ↓ Behavior Memory ↓ Constraint Memory ↓ Summary Memory ↓ Event Memory 

Reason: 

Identity shapes decisions more than events. 

## Retrieval by Intent 

Different requests should use different retrieval profiles. 

## Planning Intent 

Retrieve: 

Goals 

Deadlines 

Behavior Patterns 

Constraints 

Current Tasks 

Avoid: 

Old Reflections 

Unrelated Events 

Reflection Intent 

Retrieve: 

Recent Reflections 

Identity Insights 

Behavior Changes 

Growth Patterns 

## Coaching Intent 

Retrieve: 

Values 

Principles 

Weaknesses 

Strengths 

Long-Term Goals 

## Opportunity Intent 

Retrieve: 

Profession 

Skills 

Goals 

Location 

Current Focus 

## Recency Bias Protection 

A common retrieval mistake: 

Newest Memory Wins 

Bad. 

Example: 

Recent: 

User watched a movie. 

Old: 

User wants to build an AI startup. 

The second memory is vastly more important. 

The ranking system must prevent recency from overpowering significance. 

## Memory Diversity Rule 

The final context should not contain: 

10 versions of the same memory 

Bad: 

Works best at night 

Studies at night 

Productive at night 

Focuses at night 

Builds at night 

Instead: 

One consolidated insight 

Example: 

User consistently performs best during evening hours. 

Purpose: 

Reduce redundancy. 

## Context Budget Management 

Every retrieval session should have a memory budget. 

Example: 

Maximum Context Memory: 

- 2 Identity Memories 

- 3 Goal Memories 

- 3 Behavioral Memories 

2 Constraints 

2 Summaries 

Benefits: 

- predictable token cost 

- better prompt quality 

- retrieval diversity 

## Retrieval Failure Recovery 

If confidence is low: 

Ask the user. 

Example: Instead of: You prefer working at night. 

Use: 

I have noticed you often work at night. Is that still true? 

This prevents memory drift. 

## Memory Retrieval Metrics 

The system should track: 

Retrieval Frequency 

Retrieval Accuracy 

User Confirmation Rate 

Memory Usage Rate 

Correction Rate 

Purpose: 

Improve ranking over time. 

## Design Outcome 

The Memory Retrieval Ranking Engine acts as the AI’s attention mechanism. 

The system may know thousands of things. 

But wisdom comes from knowing: 

What matters right now. 

By ranking memories using: 

- Relevance 

- Importance 

- Confidence 

- Freshness 

- Goal Alignment 

the AI becomes: 

- faster 

- cheaper 

- more personalized 

- more accurate 

- more human-like 

while keeping context windows small and highly effective. 

