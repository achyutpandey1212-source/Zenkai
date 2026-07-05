# Zen V3 Blueprint: Slash Commands & AI Boundary Architectural Audit

This document serves as the architectural audit and blueprint for transitioning Zen from natural-language-driven CRUD actions to a robust, developer-grade **Slash Command** system. It defines what capabilities exist today, what should be migrated to deterministic slash commands, what must remain within the cognitive domain of LLMs, and the engineering details of the resulting deprecations.

---

## Part 1 — Complete Capability Inventory

Based on an audit of the Zenkai backend, here is the complete inventory of user-facing execution capabilities, their current codebase entry points, and their reliance on AI.

| Capability | Current Entry Point | AI Required? | Notes |
| :--- | :--- | :--- | :--- |
| **Add Schedule Block** | [`SchedulePatchService.addWorkBlock()`](file:///c:/Users/Achyut/Desktop/vibe2ship/src/services/schedule-patch.service.ts#L74) | **No** | Currently routed via Gemini intent detector extracted payloads or fallback confirmation logic. |
| **Move Schedule Block** | [`SchedulePatchService.moveWorkBlock()`](file:///c:/Users/Achyut/Desktop/vibe2ship/src/services/schedule-patch.service.ts#L141) | **No** | Identifies block by title and updates start/end time. Totally deterministic. |
| **Resize Schedule Block** | [`SchedulePatchService.resizeWorkBlock()`](file:///c:/Users/Achyut/Desktop/vibe2ship/src/services/schedule-patch.service.ts#L172) | **No** | Modifies duration and start/end boundaries for a block. Totally deterministic. |
| **Delete Schedule Block** | [`SchedulePatchService.removeWorkBlock()`](file:///c:/Users/Achyut/Desktop/vibe2ship/src/services/schedule-patch.service.ts#L107) | **No** | Removes block where `origin === "user"`. Completely deterministic. |
| **Check Schedule Conflicts** | [`SchedulePatchService.checkConflicts()`](file:///c:/Users/Achyut/Desktop/vibe2ship/src/services/schedule-patch.service.ts#L203) | **No** | Logic checks for overlapping intervals on a given day. Totally deterministic. |
| **Generate Schedule** | [`SchedulingService.generateWeeklySchedule()`](file:///c:/Users/Achyut/Desktop/vibe2ship/src/services/scheduling.service.ts#L205) | **Yes** | Employs Gemini to structure a week's blocks based on active plans, profile, and behaviors. |
| **Modify Schedule via LLM** | [`SchedulingService.modifySchedule()`](file:///c:/Users/Achyut/Desktop/vibe2ship/src/services/scheduling.service.ts#L129) | **No** | Coordinates the database update for patches, but relies on LLM routing to fetch target values. |
| **Generate Plan/Roadmap** | [`PlanningAgent.generateOrEvolvePlan()`](file:///c:/Users/Achyut/Desktop/vibe2ship/src/agents/planning-agent.ts#L405) | **Yes** | Uses LLM to translate goals into a structured 4-tier tree (Plan -> Milestones -> Goals -> Tasks). |
| **Recalculate Plan Progress** | [`PlanningAgent.recalculateProgress()`](file:///c:/Users/Achyut/Desktop/vibe2ship/src/agents/planning-agent.ts#L602) | **No** | Traverses plan tree to compute completed vs. pending tasks. Fully mathematical. |
| **Update Task Status** | [`PATCH /api/tasks/[id]/route.ts`](file:///c:/Users/Achyut/Desktop/vibe2ship/src/app/api/tasks/[id]/route.ts#L12) | **No** | Directly mutates `status` in MongoDB. Recursively triggers progress updates. |
| **Store Conversation Memory** | [`MemoryAgent.evaluateAndStore()`](file:///c:/Users/Achyut/Desktop/vibe2ship/src/agents/memory-agent.ts#L24) | **Yes** | Analyzes dialogue to extract facts using `AdmissionPolicy` and handles consolidation. |
| **Evolve User Identity** | [`IdentityAgent.evaluateAndEvolve()`](file:///c:/Users/Achyut/Desktop/vibe2ship/src/agents/identity-agent.ts#L172) | **Yes** | Synthesizes memories into traits (core, aspirational, patterns) with gradual confidence shifts. |
| **Google Calendar Sync** | [`CalendarSyncService.syncWeeklySchedule()`](file:///c:/Users/Achyut/Desktop/vibe2ship/src/services/calendar-sync.service.ts#L57) | **No** | Fetches/pushes events using Google Calendar REST APIs. |
| **Behavior Engine Profiling** | [`BehaviorEngine.updateFromTaskCompletion()`](file:///c:/Users/Achyut/Desktop/vibe2ship/src/services/behavior-engine.service.ts) | **Yes** (Offline) | Updates behavioral models based on habits, compliance, and skips. |
| **Briefing Composition** | [`BriefComposer.composeDailyBrief()`](file:///c:/Users/Achyut/Desktop/vibe2ship/src/services/brief-composer.service.ts) | **Yes** | Generates tailored voice/text briefings for the morning. |

---

## Part 2 — Chat Intent Audit

Currently, Zen uses a unified Gemini router to parse chat inputs and extract parameters. This process tries to match natural language patterns to structural actions, which leads to high latency, classification failures, and incorrect parameter extractions.

| Intent/Phrasing | Deterministic? | Should Become Slash Command? | Why |
| :--- | :--- | :--- | :--- |
| *"Move my gym to 7pm tomorrow"* | **Yes** | **Yes (`/schedule move`)** | Time and destination are clear variables. Forcing an LLM to parse times leads to timezone mismatches. |
| *"Delete tomorrow's study block"* | **Yes** | **Yes (`/schedule delete`)** | Targeted date and activity are explicit. Requires simple array filtering on `days[].workBlocks`. |
| *"Add gym from 6-7 PM"* | **Yes** | **Yes (`/schedule add`)** | Explicit title and start/end time. Can be parsed instantly with a regex or simple parser. |
| *"Clear morning"* | **No** | **No (Keep AI)** | "Morning" is subjective and user-dependent. The LLM must look up profile preferences (e.g., wake-up time is 7 AM, morning ends at 12 PM) to map this constraint. |
| *"Finish Arrays task"* | **Yes** | **Yes (`/task complete`)** | Explicit title and command verb. Simple fuzzy matching against current `todo` tasks is faster and cheaper. |
| *"Show me my plans"* | **Yes** | **Yes (`/roadmap list`)** | Straight lookup query. Running this through an LLM to call a retrieval branch is a waste of resources. |
| *"Sync my Google Calendar"* | **Yes** | **Yes (`/calendar sync`)** | Triggers an immediate webhook connection/sync cycle. Fully deterministic API call. |

---

## Part 3 — Proposed Slash Commands

The following slash command architecture maps clean, deterministic developer-like commands directly to the existing services in the Zenkai backend.

### 1. `/schedule`
Manages the user's weekly execution blocks.

*   **`/schedule add`**
    *   *Syntax:* `/schedule add [title] --date [YYYY-MM-DD] --start [HH:MM] --end [HH:MM]`
    *   *Example:* `/schedule add Gym --date 2026-07-06 --start 07:00 --end 08:30`
    *   *Endpoint:* `POST /api/execution/agenda` (wraps `SchedulePatchService.addWorkBlock()`)
    *   *Execution Node:* Direct HTTP request; skips LangGraph completely.
    *   *Required Params:* `title`, `date`, `startTime`, `endTime`.
    *   *Optional Params:* `priority`, `tasks`.

*   **`/schedule move`**
    *   *Syntax:* `/schedule move [block_title] --date [YYYY-MM-DD] --start [HH:MM] --end [HH:MM]`
    *   *Example:* `/schedule move Gym --date 2026-07-06 --start 18:00 --end 19:30`
    *   *Endpoint:* `PATCH /api/execution/agenda` (wraps `SchedulePatchService.moveWorkBlock()`)
    *   *Execution Node:* Direct HTTP request.
    *   *Required Params:* `title`, `date`, `newStartTime`, `newEndTime`.
    *   *Optional Params:* None.

*   **`/schedule delete`**
    *   *Syntax:* `/schedule delete [block_title] --date [YYYY-MM-DD]`
    *   *Example:* `/schedule delete Gym --date 2026-07-06`
    *   *Endpoint:* `DELETE /api/execution/agenda` (wraps `SchedulePatchService.removeWorkBlock()`)
    *   *Execution Node:* Direct HTTP request.
    *   *Required Params:* `title`, `date`.
    *   *Optional Params:* None.

*   **`/schedule regenerate`**
    *   *Syntax:* `/schedule regenerate`
    *   *Example:* `/schedule regenerate`
    *   *Endpoint:* `POST /api/execution/test` (triggers `SchedulingService.generateWeeklySchedule()`)
    *   *Execution Node:* Flows into LangGraph `execution` node foreground loop.
    *   *Required Params:* None.
    *   *Optional Params:* None.

---

### 2. `/task`
Manages task tracking and milestone updates.

*   **`/task complete`**
    *   *Syntax:* `/task complete [task_title_or_id]`
    *   *Example:* `/task complete "LangGraph implementation"`
    *   *Endpoint:* `PATCH /api/tasks/[id]` (updates status to `completed`)
    *   *Execution Node:* Direct HTTP request.
    *   *Required Params:* `id` or `title`.
    *   *Optional Params:* None.

*   **`/task create`**
    *   *Syntax:* `/task create [title] --priority [1-3] --milestone [milestone_id]`
    *   *Example:* `/task create "Write technical docs" --priority 2`
    *   *Endpoint:* `POST /api/tasks`
    *   *Execution Node:* Direct HTTP request.
    *   *Required Params:* `title`.
    *   *Optional Params:* `priority`, `milestoneId`.

---

### 3. `/calendar`
Synchronizes calendar connections.

*   **`/calendar sync`**
    *   *Syntax:* `/calendar sync`
    *   *Endpoint:* `POST /api/cron` (triggers `CalendarSyncService.queueSync()`)
    *   *Execution Node:* Direct HTTP request.
    *   *Required Params:* None.
    *   *Optional Params:* None.

*   **`/calendar status`**
    *   *Syntax:* `/calendar status`
    *   *Endpoint:* `GET /api/user` (returns connection state details)
    *   *Execution Node:* Direct HTTP request.
    *   *Required Params:* None.
    *   *Optional Params:* None.

---

### 4. `/roadmap`
Visualizes and archives roadmaps.

*   **`/roadmap list`**
    *   *Syntax:* `/roadmap list`
    *   *Endpoint:* `GET /api/plans`
    *   *Execution Node:* Direct HTTP request.
    *   *Required Params:* None.
    *   *Optional Params:* None.

*   **`/roadmap archive`**
    *   *Syntax:* `/roadmap archive --id [plan_id]`
    *   *Endpoint:* `PATCH /api/plans` (sets plan status to `archived`)
    *   *Execution Node:* Direct HTTP request.
    *   *Required Params:* `id`.
    *   *Optional Params:* None.

---

## Part 4 — AI vs Deterministic Boundary

To maintain Zen's luxury "Growth Partner" feel, we must establish a clear boundary: **AI handles strategy, counseling, and reflection; Slash Commands handle data mutation and configuration (CRUD).**

### AI should ALWAYS handle:
| Function | Reasoning Type | Why AI is Mandatory |
| :--- | :--- | :--- |
| **Roadmap Generation** | Multi-variable synthesis | Requires analyzing goals, current skills, onboarding traits, availability constraints, and time horizons to build a sensible milestone structure. |
| **Weekly Rebalancing** | Strategic prioritization | When a user falls behind, AI must decide what tasks to drop, what to delay, and how to maintain mental momentum without causing burnout. |
| **Reflections & Summaries** | Cognitive extraction | Analyzes chat history and behavior statistics to construct psychological insights and write natural progress briefs. |
| **Identity/Trait Evolution** | Probabilistic tracking | Decides how traits like "works best at night" shift based on memory evidence. Must evaluate confidence gradients gradually over time. |
| **Coaching & Advice** | Conversational therapy | Responds to user doubts, stress, or excitement. Simple commands cannot offer psychological comfort or professional perspective. |

### Slash Commands should ALWAYS handle:
| Function | Operation Type | Why Deterministic is Mandatory |
| :--- | :--- | :--- |
| **Schedule Block Mutation** | Value assignment | Moving, adding, or deleting calendar elements has a 100% correct answer. LLMs introduced parsing lag (2-4s) and occasionally got the day/date wrong. |
| **Task Status Swapping** | State transition | Marking a task complete is a binary change. Forcing an LLM router to classify a message like "Arrays is done" wastes context tokens and API budget. |
| **Integrations Control** | System state | Connecting calendars, changing notification schedules, or setting timezone parameters are strictly settings updates. |
| **Data Querying / Filtering** | DB read operations | Listing roadmaps or looking up calendar statuses can be run instantly with a quick database query instead of LLM retrieval. |

---

## Part 5 — Dead Code Audit

Migrating to Slash Commands for CRUD simplifies the backend by removing complex natural language intent parsing.

| File | Function / Logic Block | Why it becomes obsolete | Estimated LOC Saved |
| :--- | :--- | :--- | :--- |
| [`planning-agent.ts`](file:///c:/Users/Achyut/Desktop/vibe2ship/src/agents/planning-agent.ts#L301) | `detectLocalIntentShortcut()` | We no longer need to parse "i completed X" via regex patterns to bypass LLM calls. | ~100 LOC |
| [`planning-agent.ts`](file:///c:/Users/Achyut/Desktop/vibe2ship/src/agents/planning-agent.ts#L405) | `detectIntentAndExtractLifeEvents()` | The router prompt won't need branches for `task_update` and `schedule_modification`. | ~150 LOC |
| [`router.node.ts`](file:///c:/Users/Achyut/Desktop/vibe2ship/src/orchestration/nodes/router.node.ts#L25) | `buildRoutingDecision()` | Simplified to two paths: `AI Conversation` vs `AI Plan Generation`. Intent branches are removed. | ~60 LOC |
| [`router.node.ts`](file:///c:/Users/Achyut/Desktop/vibe2ship/src/orchestration/nodes/router.node.ts#L86) | `isAffirmative()` & `pendingAction` check | Pending actions (e.g., asking "Would you like me to add Gym?") can be replaced by direct commands. | ~100 LOC |
| [`execution.node.ts`](file:///c:/Users/Achyut/Desktop/vibe2ship/src/orchestration/nodes/execution.node.ts#L130) | `Branch 2: Schedule modification` | Direct schedule modifications move to direct REST endpoints, bypassing the execution node. | ~180 LOC |
| `MERGED_ROUTER_SYSTEM_PROMPT` | Router System Instructions | No longer needs complex JSON schema outputs for structured schedule operations. | ~80 prompt lines |

---

## Part 6 — UX Improvements

A successful slash command system needs a fast, user-friendly interface. Here is the product design blueprint for the chat UI:

### 1. Visual Command Suggestions (Autocomplete & Fuzzy Search)
*   **Behavior:** Typing `/` opens a scrollable, fuzzy-filtered command palette over the input box.
*   **Draft UI Spec:**
    ```
    ┌──────────────────────────────────────────────┐
    │ Current focus: Plan your day                 │
    ├──────────────────────────────────────────────┤
    │ [ /s ]                                       │
    ├──────────────────────────────────────────────┤
    │ 📅 /schedule add     - Insert a block        │
    │ 📅 /schedule move    - Adjust block timing   │
    │ 📅 /schedule delete  - Remove a block        │
    └──────────────────────────────────────────────┘
    ```

### 2. Interactive Parameter Pickers
*   **Behavior:** When `/schedule add` is selected, instead of forcing the user to type dates, open inline calendar and time pickers.
*   **Draft UI Spec:**
    ```
    [ /schedule add Gym ] 📅 [Select Date] 🕒 [07:00] to [08:00]
    ```

### 3. Syntax Highlighting & Validation
*   **Behavior:** As the user types parameters (e.g., date, time), the UI validates inputs on the fly. Correct parameters turn green, while incorrect formatting (e.g., `2026-13-45`) turns red with an inline fix recommendation.

---

## Part 7 — Product Review & Redesign Recommendations

If Zen were to ship to thousands of users tomorrow:

### What feels magical?
*   **Proactive Planning:** When the user shares a goal (e.g., "I have a compiler exam on Friday") and the companion says "I've structured your study blocks," it feels like magic.
*   **Evolving Identity:** Seeing active traits change as the system remembers details over several weeks creates a strong sense of personalization.

### What feels slow & unreliable?
*   **LLM Latency on Simple Updates:** Typing "I completed gym" triggers an LLM call to classify the intent. This adds 2-3 seconds of lag just to tick a checkbox.
*   **Time Parsing Errors:** The LLM sometimes hallucinates time coordinates or shifts dates because it is disconnected from the user's local system time.

### Redesign Recommendations
1.  **Direct CRUD Actions:** Remove LLM involvement for scheduling. The UI should send a direct API call to `/api/execution/agenda` instantly.
2.  **Explicit Action Previews:** Instead of applying schedule changes in the background, show a clear visual preview of the changes and ask the user to confirm them with a single click.
3.  **Local Time Sync:** Pass the user's browser timestamp (`Intl.DateTimeFormat().resolvedOptions().timeZone`) with every message to prevent date shifts.
