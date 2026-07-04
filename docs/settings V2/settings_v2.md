# Zen V2 — Settings Experience Redesign
Version: V2
Status: Ready for Implementation

---

# Vision

The Settings experience should feel like a premium desktop application rather than another page inside a dashboard.

The user should never feel like they have "left" Zen.

Instead of opening a new screen, Settings should appear as a large centered modal (roughly 82-88vw and 88-92vh) with a softly blurred backdrop, similar to ChatGPT, Cursor, Codex, Claude Desktop and Antigravity.

This makes settings feel like part of the operating system rather than another route.

---

# Navigation Changes

## Sidebar

Keep the sidebar exactly the same except for the bottom profile section.

Current

---------------------------------
Profile Picture
Name
Email
---------------------------------

New

Entire profile card becomes clickable.

Clicking it opens a small context menu.

Example:

---------------------------------
👤 Achyut

Manage Account
Settings
Billing & Plans
Sign Out
---------------------------------

Only "Settings" opens the Settings modal.

Billing may also be opened directly from here.

No separate Settings page navigation is required.

---

# Settings Modal

Size

approximately

82-88vw

90vh

rounded corners

large shadow

blurred backdrop

same visual language as existing pricing modal.

The modal should animate smoothly from opacity + slight scale.

No full page navigation.

---

# Tabs

The Settings modal contains these tabs.

---

## 1. General

Purpose

Personal preferences.

Contains

Theme

Light

Dark

System

Language

Timezone

12/24 hour clock

Animations

Reduce motion

Desktop notifications

Email notifications

Morning Brief

Evening Reflection

Auto-open today's agenda

These settings should feel like Cursor.

Lots of spacing.

Few words.

Premium toggles.

---

## 2. Companion

Controls Zen's personality.

Reuse existing settings.

Communication Style

Quiet

Balanced

Collaborative

Direct

Planning Behaviour

Minimal

Balanced

Proactive

Conversation depth

Short

Normal

Deep

Future placeholders

Voice Mode

Coming Soon

Memory Recall Style

Coming Soon

Reasoning Level

Coming Soon

These are feature teasers.

---

## 3. MCPs & Integrations

Merge these.

No separate tabs.

Header

"Connect Zen with the tools you already use."

Cards layout.

Each card uses official company icon.

If icon unavailable

Use placeholder.

At end of implementation provide a list of required SVGs.

Connected

Google Calendar

Future

Notion

GitHub

Gmail

Google Tasks

Google Drive

Spotify

Slack

Discord

Apple Calendar

Apple Reminders

Linear

ClickUp

Todoist

Obsidian

Claude MCP

Sequential Thinking MCP

Filesystem MCP

Memory MCP

Browser MCP

Playwright MCP

GitHub MCP

Brave Search MCP

Each card contains

official icon

status pill

Connected

Available

Coming Soon

button

Connect

Disconnect

Coming Soon

Hover animation

soft glow

slight lift

No fake loading.

Future cards simply show Coming Soon.

---

## 4. Billing & Plans

Move pricing here.

Reuse current pricing modal.

Improve spacing.

Future ready.

Sections

Current Plan

Usage

Upcoming Plans

Upgrade

Features comparison

No payment implementation needed.

Just presentation.

Future ready.

---

## 5. Account

Contains

Email

Display Name

Export Data

Delete Memory

Delete Account

Sign Out

Danger zone separated visually.

---

## 6. About Zen

This is important.

Instead of hiding that Zen is early...

embrace it.

Top Card

--------------------------------

Building Zen in Public

Zen is currently in active development.

Every user directly shapes its future.

Found a bug?

Have an idea?

Want to collaborate?

I'd genuinely love to hear from you.

--------------------------------

Developer Card

Photo placeholder

Name

Achyut Pandey

Bio

B.Tech Electronics & Communication Engineering

MERN Stack Developer

AI Product Builder

Video Editor

Content Creator

1.2M+ combined views across platforms

Links

GitHub

LinkedIn

Email

Button

Say Hello

Future

Twitter

Portfolio

Discord Community

---

# Official Icons

Use official monochrome SVG logos wherever licensing permits.

If unavailable

render placeholders

AND

after implementation output a list like

/assets/icons/github.svg

/assets/icons/notion.svg

/assets/icons/google-calendar.svg

...

so they can later be replaced manually.

---

# Design Language

Maintain Zen's existing visual identity.

Dark luxury aesthetic.

Soft gold accents.

Cormorant typography.

Large whitespace.

Premium cards.

Subtle borders.

Hover animations.

No loud colors.

No gradients unless already used.

No glassmorphism overload.

Everything should feel calm.

---

# Motion

Opening modal

fade

scale

Slide between tabs

200ms

Cards

Lift 2px

Glow

Buttons

Gentle transitions

No exaggerated animations.

---

# Architecture

Settings should be component based.

Example

/components/settings

GeneralSettings.tsx

CompanionSettings.tsx

IntegrationsSettings.tsx

BillingSettings.tsx

AccountSettings.tsx

AboutSettings.tsx

SettingsSidebar.tsx

SettingsModal.tsx

SettingsCard.tsx

Toggle.tsx

SectionHeader.tsx

Everything modular.

Future additions should require minimal code.

---

# Reuse

Reuse existing functionality whenever possible.

Google Calendar sync

Notification settings

Companion preferences

Pricing cards

Authentication

Avoid duplicate logic.

Only redesign presentation.

---

# Accessibility

Keyboard navigable

ESC closes modal

Tab navigation

Focus trap

Responsive down to tablet

Scrollable if content exceeds viewport

---

# Verification

After implementation verify

✓ Existing settings still work

✓ Google Calendar still connects

✓ Companion preferences persist

✓ Billing modal migrated successfully

✓ Profile menu opens correctly

✓ Settings open as modal

✓ No page navigation

✓ Existing APIs unchanged

✓ Build passes

✓ TypeScript passes

✓ ESLint passes

---

# Deliverables

After implementation provide

1. Files modified

2. New reusable components

3. APIs reused

4. Required SVG icon filenames

5. Build status

6. TypeScript status

7. ESLint status

No functionality should regress.
Only presentation and UX should evolve.