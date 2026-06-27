# Optimization & Behavior Report — Phase 10.6

This report provides a detailed engineering analysis of the behavior observed in the Zenkai agent workflow, focusing on two recent conversation turns, insights from the Developer Dashboard study, and the fixes implemented.

---

## 1. Analysis of User Prompt 1: Relative Date Scheduling

### The Problem
* **User Input**: *"Bro tomorrow evening i have to go watch a movie show of 8pm-10pm... update the timeline according to this"*
* **Conversation Context**: Sent at **03:04 AM** on **June 28, 2026**.
* **Observed Behavior**: Zenkai scheduled the movie show for **July 11, 2026** (at the very end of the timeline).
* **Expected Behavior**: It should have scheduled it for **Sunday evening, June 28, 2026** (the same calendar day, as "tomorrow evening" spoken at 3:00 AM before sleeping refers to the upcoming Sunday night).

### Root Cause Analysis
1. **Lack of Date/Time Context**: The `PlanningAgent` context prompt did not include the current system date or time. The LLM was trying to schedule relative dates in a vacuum, with no reference anchor for "today" or "tomorrow". It defaulted to appending the task to the end of the existing plan tree.
2. **Early Morning Interpretation**: 3:04 AM on June 28 is technically the calendar day of June 28. To a human who has not slept yet, "tomorrow evening" means Sunday (June 28) evening. Without explicit time-of-day guidelines, the LLM cannot perform this reasoning.

### Fixed Implementation
* **System Time Injection**: Injected the exact current timestamp, local date, and local time into the `PlanningAgent` prompt:
  ```typescript
  Current Date/Time Context:
  - Current Timestamp: [timestamp]
  - Current Date: [formatted date]
  - Current Local Time: [formatted time]
  ```
* **Date Reasoning Instructions**: Added explicit guidelines instructing the model to resolve all relative date terms (e.g. "today", "tomorrow", "this evening") relative to the injected timestamp, accounting for early morning queries (1 AM - 5 AM) where "tomorrow" implies the same waking calendar day.

---

## 2. Analysis of User Prompt 2: Casual Conversation Summary Card

### The Problem
* **User Input**: *"thx bro.. u r amazing"*
* **Observed Behavior**: Zenkai responded with a conversational reply but appended an **Execution Summary Card** (`Strategy Updated. I've quietly organized everything for you. Estimated Workload: 0.0 hrs/day`).
* **Expected Behavior**: Zenkai should have just replied textually without presenting a blank strategy card since no plans or tasks were updated.

### Root Cause Analysis
* **Ungated Summary Cards**: The `assemblerNode` in `src/orchestration/nodes/assembler.node.ts` was building, persisting, and streaming the summary card event (`__type: "execution_summary"`) on every single message turn, regardless of whether the active workflow was a general conversation (`none` intent) or actually modified plans/tasks.

### Fixed Implementation
* **Conditional Gating**: Refactored `assemblerNode` to only build and stream the execution summary card if actual database or workflow modifications took place:
  ```typescript
  const hasModifications =
    state.intent?.type === "create_or_modify" ||
    state.intent?.type === "task_update" ||
    (state.planResult?.milestonesCreated ?? 0) > 0 ||
    (state.planResult?.tasksCreated ?? 0) > 0 ||
    state.agendaBuilt ||
    state.taskUpdateExecuted;
  ```
* If no modifications are detected, the summary card is skipped, and the stream closes cleanly with only the text assistant reply.

---

## 3. Developer Dashboard Study & Core Fixes

### A. Next.js Sandbox Trace Separation
* **Observation**: The Zenkai Developer Dashboard showed `0 AI Requests Today` and `No recent workflows found`.
* **Diagnosis**: Next.js compiles Server Actions (dashboard load) and API routes (chat engine) in separate closures or hot-reloaded processes during local development. The default `InMemoryCheckpointStore` was writing to an isolated module map that the dashboard server action could not access.
* **Fix**: Switched `CHECKPOINT_STORE="mongo"` in `.env`. Both environments now write/read from the shared `graph_checkpoints` MongoDB collection, unifying logs and tracing.

### B. Mongoose Document Hydration Crash
* **Observation**: Workflows aborted before the final turn, leaving streaming loops hanging.
* **Diagnosis**: In `assembler.node.ts`, `state.newMemory.updateOne` crashed because the background memory worker returns a lean/plain JavaScript object (due to `.lean()` and `.toObject()` on database queries) which does not contain the hydrated Mongoose document instance methods.
* **Fix**: Replaced with `Memory.updateOne({ _id: new Types.ObjectId(state.newMemory._id) }, ...)` using the model directly.

### C. Quota Exceeded 429 Token Bloat
* **Observation**: Planning workflows frequently hit Gemini input token exhaustions (250,000+ input tokens).
* **Diagnosis**: The LLM prompt context serialized the full `existingPlans` array raw. Each plan document stored a full copy of its revision history (stringified trees of every past update) and diagnostics (previous raw prompts and completions).
* **Fix**: Implemented a tree-pruning function in `PlanningAgent.generateOrEvolvePlan` that strips out `history`, `diagnostics`, and timestamps, reducing payloads from 300k+ tokens to under 5k tokens.
