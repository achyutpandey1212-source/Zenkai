# Zenkai Verification & Testing Guide

This guide provides step-by-step instructions to verify every major user flow, feature, and edge case in Zenkai. Use this guide to ensure that all core modules (Onboarding, Home Dashboard, Companion Chat, Tasks Execution, Identity & Reflection, and Memory) are functioning correctly.

---

## Part 1: Clean Test Setup (Prerequisites)

To verify the onboarding flow and daily transitions accurately, it is best to start with a fresh user state.

### 1. Start the Dev Server
Run the Next.js development server:
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 2. Reset or Create a Test User
- If you want to test from absolute scratch, click **Logout** if you are logged in, or clear your browser's LocalStorage and cookies.
- Navigate to `/signup` and create a brand-new user (e.g., `tester@zenkai.ai` / password: `password123`).

---

## Part 2: Step-by-Step User Flows

### Flow 1: Onboarding & Values Extraction
**Objective**: Verify the initial setup and personality alignment.

1. **Step 1**: Register a new user at `/signup`. You will be directed to the Onboarding wizard.
2. **Step 2**: Enter your name and proceed through the questions (User values, Goals, Weekly schedule, Current challenges).
3. **Step 3**: On completion, submit.
   - *Expected Behavior*: The backend structures key values into your initial user profile. You are automatically redirected to the `/app` Home Screen.
   - *Verification*: The Home screen should say "Good Morning, [Your Name]" using the signature font.

---

### Flow 2: Daily Execution Dashboard (Home Screen)
**Objective**: Verify intention rendering, skeleton loaders, fixed background, progress metrics, and task interactions.

1. **Step 1**: Load the Home screen.
   - *Expected Behavior*:
     - A beautiful, pulsating loading skeleton should appear for the intention card, work blocks checklist, and progress cards.
     - The background image of the temple on the right side of the screen should remain static and not shift as elements load.
     - Once loaded, the elements should slide down and fade in with a smooth "curtain" animation.
2. **Step 2**: Scroll down the page.
   - *Expected Behavior*: The dashboard content (greeting, intent card, blocks) scrolls up, while the temple background image remains strictly fixed in place.
3. **Step 3**: Toggle a task in the "Suggested Work Blocks" list by clicking its checkbox.
   - *Expected Behavior*:
     - The Companion Orb pulses scale and glows briefly (`completed_task` state).
     - The task text gets strike-through styling and opacity drops.
     - The SVG circular progress ring updates instantly to reflect the completion percentage.
4. **Step 4**: Complete *all* tasks listed under the work blocks.
   - *Expected Behavior*: The Companion Orb transitions to a golden glowing breath state (`all_completed` state), signaling the complete fulfillment of critical day goals.

---

### Flow 3: Seamless Chat Integration
**Objective**: Verify that the input box redirects to the chat tab and streams responses correctly with zero transitions glitching.

1. **Step 1**: Locate the "Speak with Zenkai..." input box at the bottom of the Home screen.
2. **Step 2**: Type a message (e.g., "What should my focus be today?") and hit **Enter** (or click the send button).
   - *Expected Behavior*:
     - The screen instantly routes to the **Companion Chat** tab on the sidebar.
     - The message is printed on the chat area, and Zenkai begins streaming the response chunk-by-chunk.
     - The Companion Orb transitions states: `typing` (as you type) $\rightarrow$ `thinking` (waiting for API) $\rightarrow$ `writing` (spinning and pulsing while streaming chunks) $\rightarrow$ `idle` (on finish).
3. **Step 3**: Click back to the **Home** tab in the sidebar.
   - *Expected Behavior*: The Home Dashboard mounts immediately without displaying any chat logs or playing a delayed fade-in transition. It remains a clean daily agenda.
4. **Step 4**: Click the **New Chat** button in the sidebar.
   - *Expected Behavior*: A blank chat interface is loaded, ready for a fresh dialogue.

---

### Flow 5: Tasks & Agenda Execution Screen
**Objective**: Verify time block schedules, task deferrals, and agenda regeneration.

1. **Step 1**: Navigate to the **Tasks** tab in the sidebar.
2. **Step 2**: Observe the two-column layout:
   - Left side shows the structured work block schedule timeline.
   - Right side shows task statistics (completed, deferred) and highlights.
3. **Step 3**: Click the **Regenerate Agenda** button (refresh icon next to "Today's Intention").
   - *Expected Behavior*:
     - The Companion Orb enters the `generating_agenda` state.
     - The dashboard updates with a newly optimized agenda aligning with your recent changes.

---

### Flow 6: Identity & Reflections
**Objective**: Verify the cognitive schema memory extraction and reflection logs.

1. **Step 1**: Navigate to the **Identity** tab.
   - *Expected Behavior*: Displays your extracted profile values, core beliefs, and behavioral rules.
2. **Step 2**: Navigate to the **Reflection** tab.
   - *Expected Behavior*: Displays daily/weekly reflection notes generated by Zenkai, highlighting insights.

---

### Flow 7: Memory Inspector (Debug Panel)
**Objective**: Inspect what Zenkai stores in its persistent memory database.

1. **Step 1**: Navigate to the **Memory Inspector** tab at the bottom of the sidebar.
2. **Step 2**: Review the items:
   - Core facts about the user.
   - Extracted interests and goals.
   - Conversation summary checkpoints.
   - *Expected Behavior*: Updates dynamically as you chat with Zenkai and complete daily tasks.

---

## Part 4: Edge Cases to Test

| Edge Case | Steps to Test | Expected Outcome |
| :--- | :--- | :--- |
| **No Tasks on Startup** | Register a user without tasks. | The dashboard loads successfully showing "No tasks planned". |
| **Multi-line Input** | Press `Shift + Enter` in the query box. | The text area expands in height (up to `180px` max before scrollbars appear) without clipping text. |
| **Rapid Task Check** | Check/uncheck multiple tasks quickly. | The SVG progress ring matches the checked count accurately without UI freezing. |
| **Logout & Login** | Log out and log in as another user. | The entire screen, sidebar history, and memory profile update to reflect the new user immediately. |
