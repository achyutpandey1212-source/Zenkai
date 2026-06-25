## Section 5.9 — Memory Admission Policy 

## Purpose 

This document defines the rules that determine whether information is allowed to enter the memory system. 

Without an admission policy: 

- Memory becomes cluttered 

- Retrieval quality decreases 

- Context becomes noisy 

- Costs increase 

- Personalization becomes less accurate 

The purpose of this policy is to ensure that every stored memory improves the AI’s ability to help the user in the future. 

## Core Philosophy 

The AI should not remember everything. 

The AI should remember only information that improves future decisions. 

Every piece of information must earn the right to become memory. 

## The Admission Test 

Before anything enters memory, the system should ask: 

Will this information help me make better decisions for the user in the future? 

If the answer is: 

YES 

Store it. 

If the answer is: 

NO 

Forget it. 

This single principle governs the entire memory system. 

## Examples 

## Reject 

My favorite pizza is margherita. 

Reason: 

Does not improve planning. Does not improve coaching. Does not improve personalization. 

Result: 

Rejected 

## Accept 

I always lose focus after lunch. 

Reason: 

Improves planning. Improves scheduling. Improves productivity recommendations. 

Result: 

Candidate Memory 

## Reject 

It rained today. 

Reason: 

Temporary fact. No long-term value. 

Result: 

Rejected 

## Accept 

I want to become an AI entrepreneur. 

Reason: 

Core aspiration. Influences opportunities. Influences planning. Influences long-term strategy. 

Result: 

Identity Proposal 

## Memory Categories That Qualify 

Information should be considered for memory when it belongs to one of the following categories. 

## 1. Identity 

Who the user is. 

Examples: 

Student 

Developer 

Content Creator 

Founder 

Why it matters: 

Determines context. Shapes recommendations. 

## 2. Aspirations 

Who the user wants to become. 

Examples: 

AI Engineer 

Entrepreneur 

Researcher 

Singer 

Why it matters: 

Guides long-term planning. Guides opportunity discovery. 

## 3. Principles 

How the user makes decisions. 

Examples: 

Prefers long-term gains. 

Values independence. 

Accepts direct feedback. 

Why it matters: 

Improves coaching style. Improves strategic decisions. 

## 4. Constraints 

Things the AI should respect. 

Examples: 

No meetings after 10 PM. 

Family comes first. 

Exam period has priority. 

Why it matters: 

Prevents bad planning. Builds trust. 

## 5. Behavioral Patterns 

Repeated actions and tendencies. 

Examples: 

Works best at night. 

Gets distracted after lunch. 

Performs better under accountability. 

Why it matters: 

Improves scheduling. Improves predictions. 

## 6. Recurring Challenges 

Repeated obstacles. 

Examples: 

Overcommits. 

Procrastinates. 

Struggles with prioritization. 

Why it matters: 

Allows proactive intervention. 

## 7. Transformations 

Evidence of growth. 

Examples: 

Improved consistency. 

Became more disciplined. 

Developed confidence. 

Why it matters: 

Supports long-term reflection. Strengthens trust. 

## Memory Categories That Do Not Qualify 

The following information should generally not enter long-term memory. 

## Temporary Facts 

Examples: 

I ate pasta. 

I watched a movie. 

I bought a new mouse. 

Reason: 

Low future value. 

One-Off Statements 

Examples: 

Today was boring. 

I feel slightly tired. 

## Reason: 

May not represent a pattern. 

## Random Trivia 

Examples: 

Favorite color. 

Favorite superhero. 

Random preferences unrelated to goals. 

Reason: 

Low decision-making value. 

## Redundant Information 

Examples: 

Already stored information repeated again. 

Reason: 

Creates noise. 

## Memory Confidence Thresholds 

Not all memories are equal. 

The system should assign confidence scores before admission. 

## Low Confidence 

0.0 – 0.4 

Examples: 

Single observation. 

Weak evidence. 

Action: 

Candidate only. 

## Medium Confidence 

0.4 – 0.8 

Examples: 

Observed several times. 

Action: 

Proposal state. 

## High Confidence 

0.8 – 1.0 

Examples: Repeatedly verified. 

Action: 

Approved memory. 

## Memory States 

Every memory must pass through stages. 

Observation ↓ Candidate ↓ Proposal ↓ Approval 

↓ Active Memory 

This prevents hallucinated identities and incorrect assumptions. 

## Evidence Requirements 

The system should not create identity-level memories from a single message. 

Examples: 

Bad: 

User says: "I like coding." 

Immediately stored as identity. 

Good: 

User repeatedly discusses projects. 

User spends significant time coding. 

User expresses interest in engineering. 

Confidence grows. 

Then: 

Identity Proposal: User strongly identifies as a builder. 

This creates reliable memory. 

## The Reflection Agent’s Role 

The Reflection Agent acts as the first filter. 

Responsibilities: 

Detect patterns. 

Detect goals. 

Detect values. 

Detect recurring behaviors. 

Reject noise. 

The Reflection Agent proposes. 

It does not approve. 

## The Identity Agent’s Role 

The Identity Agent acts as the gatekeeper. 

Responsibilities: 

Evaluate evidence. 

Review proposals. 

Update identity. 

Reject weak claims. 

This prevents memory corruption. 

## Admission Scoring Framework 

Every candidate memory should receive scores for: 

Importance 

Future Utility 

Confidence 

Frequency 

Strategic Relevance 

Example: 

Importance: 0.95 

Future Utility: 0.92 Confidence: 0.88 Frequency: 0.91 

Strategic Relevance: 0.97 

Composite score determines admission priority. 

## Memory Pollution Prevention 

The system should aggressively reject: 

Noise 

Temporary details 

Repeated trivia 

Low-impact observations 

Contextless facts 

Goal: 

Few memories. 

High quality memories. 

Maximum usefulness. 

Not: 

Many memories. 

Low quality memories. 

## Golden Rule 

Every memory should answer: 

How will remembering this help the AI become a better partner for the user? 

If no clear answer exists: 

Do not store it. 

## Design Outcome 

The AI does not behave like a recorder. 

It behaves like a mentor. 

It remembers only what helps it: 

- plan better 

- coach better 

- predict better 

- support better 

- personalize better 

This policy ensures that after years of usage, the system remains focused, useful, scalable, and trustworthy rather than becoming an expensive archive of irrelevant information. 

