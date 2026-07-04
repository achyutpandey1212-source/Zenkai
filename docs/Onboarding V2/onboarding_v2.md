# Zen Onboarding V2 – Product Specification
Version: 2.0
Status: Ready for Implementation
Target: Antigravity
Author: Mahesh + GPT

---

# Philosophy

The onboarding is **NOT** a questionnaire.

The onboarding is the moment where **Zen builds its first mental model of the user.**

Every question should answer one question internally:

> "Will knowing this allow Zen to make better decisions?"

If the answer is no, don't ask it.

The experience should feel premium.

Think:

- Apple
- Linear
- Arc Browser
- Notion

NOT

- Google Forms
- Survey
- HR Application

---

# Design Principles

## 1. Minimal typing

Prefer

- Cards
- Chips
- Buttons
- Toggles
- Multi Select

Avoid text fields wherever possible.

---

## 2. Progressive Disclosure

Never ask 20 questions at once.

Instead,

learn gradually.

Each screen should answer ONE topic.

---

## 3. Adaptive

Users should NOT all receive the same onboarding.

Example

School Student

↓

Different Questions

College Student

↓

Different Questions

Professional

↓

Different Questions

Founder

↓

Different Questions

Eventually all branches merge again.

---

## 4. Premium Feel

Every screen should have

• Large Title

• Short Subtitle

• Large Cards

• Soft Animations

• Progress Indicator

• Continue Button

---

Example

━━━━━━━━━━━━━━━━━━

Who are you?

Help Zen understand your world.

○ School Student

○ College Student

○ Working Professional

○ Founder

━━━━━━━━━━━━━━━━━━

---

# Progress

Instead of

Step 3 of 9

Use

Understanding You

█████░░░░░

45%

Completed

✓ Identity

✓ Context

⏳ Routine

○ Goals

○ Finish

---

# Screen Flow

Welcome

↓

Primary Identity

↓

Identity Branch

↓

Current Priorities

↓

Routine

↓

Productivity

↓

Goals

↓

Summary

↓

Generate Strategy

---

# SCREEN 1

Welcome

Title

Welcome to Zen

Subtitle

Let's understand your life so Zen can coach you better.

CTA

Get Started

---

# SCREEN 2

Primary Identity

QUESTION

Which best describes you today?

Single Select

School Student

College Student

Working Professional

Founder

Other

This choice decides the onboarding branch.

Store

primaryIdentity

---

# BRANCH

----------------------------------

If School Student

----------------------------------

Ask

Current Class

Examples

8

9

10

11

12

Board

CBSE

ICSE

State Board

Other

Target Exam

JEE

NEET

Olympiads

Boards

None

Country

(default India)

State

(optional)

Then merge.

----------------------------------

If College Student

----------------------------------

Ask

Country

(default India)

University

(searchable dropdown)

Degree

B.Tech

BCA

BBA

MBA

BA

MBBS

Other

Current Semester

Hosteller

Day Scholar

Then merge.

----------------------------------

If Working Professional

----------------------------------

Country

Industry

Experience

Work Mode

Remote

Hybrid

Office

Typical Work Hours

Then merge.

----------------------------------

If Founder

----------------------------------

Country

Startup Stage

Idea

MVP

Revenue

Funding

Team Size

Then merge.

---

# SCREEN

Secondary Roles

QUESTION

What else do you do?

Multiple Select

Content Creator

Freelancer

Athlete

Open Source

Teaching

Startup

Investor

Writer

Designer

Developer

None

Store

roles[]

---

# SCREEN

Current Priorities

QUESTION

What matters most right now?

Multiple Select

Placements

College

Business

Fitness

Learning

YouTube

Freelancing

Relationships

Health

Money

Career

Store

focusAreas[]

---

# SCREEN

Routine

QUESTION

When does your day usually look like?

Large Selectors

Wake Time

Sleep Time

Peak Focus

Morning

Afternoon

Evening

Night

Average Free Time

Less than 1 hour

1-2 Hours

2-4 Hours

4-6 Hours

6+ Hours

Store

deepWorkTime

dailyAvailability

wakeTime

sleepTime

(No new schema if already exists.)

---

# SCREEN

Productivity

QUESTION

What usually gets in your way?

Multiple Select

Phone

Procrastination

Overthinking

No Motivation

Too Many Ideas

Burnout

Lack of Time

Distractions

Inconsistency

Perfectionism

Store

productivityChallenges[]

---

# SCREEN

Current Goals

QUESTION

What are you trying to achieve?

Allow multiple.

Examples

Get Internship

Get Placement

1000 YouTube Subscribers

Earn ₹50K

Lose Weight

Build Startup

Pass Semester

Learn AI

Store

Existing goals structure.

DO NOT create duplicate schema.

---

# SCREEN

Calendar Permission

Connect Google Calendar

Benefits

✓ Smarter Scheduling

✓ Conflict Detection

✓ Automatic Availability

Button

Connect Calendar

Secondary

Skip for Now

---

# FINAL SCREEN

Summary

Title

Here's what Zen understands about you.

Display

Identity

Roles

Focus Areas

Routine

Challenges

Goals

Button

Looks Good

---

# Loading Screen

After onboarding

DO NOT instantly redirect.

Instead show

Zen is building your strategy...

Animated progress

Examples

✓ Understanding your routine

✓ Creating roadmap

✓ Planning your first week

✓ Learning your priorities

Then enter dashboard.

---

# Existing Schema Usage

Reuse wherever possible.

Primary Identity

(new)

roles[]

(existing new field)

focusAreas[]

(existing)

deepWorkTime

(existing)

dailyAvailability

(existing)

productivityChallenges[]

(existing)

goals

(existing)

DO NOT introduce unnecessary schema.

---

# Things NOT Asked

Birthday

Reason

Can be asked later naturally.

Occupation

Unless Professional.

Salary

Never.

Exact Address

Never.

Phone Number

Already available via auth.

Social Links

Can be added later.

---

# Future Profile Evolution

Onboarding should NOT be the only place users edit information.

Future page

"You"

will allow

Update Routine

Update Goals

Update Identity

Update Challenges

Connect Integrations

etc.

---

# UX Requirements

Every screen

One question only.

Maximum

5-8 choices visible.

Large Cards.

Large Touch Targets.

Animations

150-250ms.

No jarring transitions.

Dark mode first.

Minimal text.

No scrolling whenever possible.

---

# Validation

Primary Identity

Required

Branch Questions

Required

Secondary Roles

Optional

Routine

Required

Goals

Minimum one

Challenges

Optional

Calendar

Optional

---

# Technical Requirements

DO NOT

Change existing pipelines.

DO NOT

Modify roadmap generation logic.

DO NOT

Break profile schema.

Reuse existing fields wherever possible.

Add only fields already approved.

Everything should remain backwards compatible.

---

# Success Criteria

The onboarding should feel like Zen is learning about a person,
not collecting data.

A user should finish onboarding in approximately **3–5 minutes** while feeling understood rather than exhausted.

The result should be a rich enough profile that Zen can immediately generate:
- A personalized roadmap
- A realistic weekly schedule
- Context-aware coaching
- Better memory and reflections
- Higher-quality conversations

This onboarding is the foundation of Zen's long-term personalization system.