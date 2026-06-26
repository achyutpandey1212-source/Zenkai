# Onboarding Flow

## Purpose

The purpose of onboarding is **not** to collect profile information.

The purpose is to understand the person.

Everything collected during onboarding will become the foundation for:

* Identity Engine
* Planner Agent
* Reflection Engine
* Memory System
* Context Retrieval
* Personalized Suggestions

The onboarding experience should feel like the AI is getting to know the user, not asking them to fill out a form.

---

# UX Principles

* One primary question per screen.
* Full-screen experience.
* Calm transitions.
* Large typography.
* Minimal distractions.
* Progress indicator at the top.
* User should finish within 2–3 minutes.

Never display long forms.

Never ask more than one major question at a time.

---

# Screen 1 — Welcome

Title:

Welcome to Zenkai.

Subtitle:

Before we begin, I'd like to understand who you are and where you want to go.

Button:

Let's Begin

Nothing is stored.

---

# Screen 2 — Your Name

Question:

What should I call you?

Input:

Single text field.

Required.

Stored:

profile.name

---

# Screen 3 — Current Profession

Question:

Which best describes you today?

Options:

* Student
* Working Professional
* Freelancer
* Founder
* Creator
* Looking for Opportunities
* Other

Stored:

profile.profession

---

# Screen 4 — Long-Term Goal

Question:

What do you want to become?

Examples:

* Software Engineer
* IAS Officer
* Entrepreneur
* Doctor
* YouTuber
* AI Researcher

Free text input.

Required.

This is one of the most important pieces of information.

Stored:

goals.longTermGoal

---

# Screen 5 — Current Focus

Question:

What are you working on right now?

Examples:

Preparing for placements

Building a startup

Learning React

Preparing for UPSC

Semester exams

Creating content

Free text.

Stored:

goals.currentFocus

---

# Screen 6 — Why Does It Matter?

Question:

Why is this goal important to you?

Examples:

Financial freedom

Helping my family

Building something meaningful

Creative freedom

Personal growth

Free text.

Stored:

identity.motivation

This response should later influence reflections and encouragement.

---

# Screen 7 — Available Time

Question:

How much focused time can you realistically dedicate each day?

Options:

Less than 30 minutes

30–60 minutes

1–2 hours

2–4 hours

More than 4 hours

Stored:

profile.dailyAvailability

---

# Screen 8 — Working Style

Question:

How do you usually like to work?

Options:

Deep Focus

Structured Planning

Flexible

Short Bursts

Still Figuring It Out

Stored:

identity.workStyle

---

# Screen 9 — Biggest Challenge

Question:

What usually gets in your way?

Options:

Procrastination

Distractions

Lack of clarity

Inconsistency

Overthinking

Time management

Other

Stored:

identity.biggestChallenge

This will influence future planning.

---

# Screen 10 — AI Introduction

Display:

Thank you.

From now on, I won't just answer your questions.

I'll quietly help you become the person you want to be.

Animation:

Companion Orb.

No inputs.

---

# Completion

Redirect:

Home Screen

The greeting should now immediately feel personal.

Example:

Good Morning, Achyut.

I've already started planning today around your goal of becoming a Software Engineer.

Let's make progress.

---

# Data Collected

Profile

* Name
* Profession
* Daily Availability

Goals

* Long-Term Goal
* Current Focus

Identity

* Motivation
* Working Style
* Biggest Challenge

---

# Things We Intentionally Do NOT Ask

Age

Gender

Phone Number

Country

Address

Bio

Profile Picture

Favorite Color

Birthday

These do not improve the intelligence of Zenkai.

---

# Future Expansion

Future versions may additionally collect:

* Preferred study hours
* Calendar integration
* Preferred notification times
* Personality assessments
* Skill inventory
* Habit tracking

These are intentionally excluded from Version 1.

---

# Success Criteria

The onboarding is successful if, after completion, Zenkai can naturally answer:

* Who is this user?
* What are they trying to become?
* What are they working on today?
* Why does this matter to them?
* How much time do they have?
* What usually holds them back?

If these questions can be answered confidently, onboarding has achieved its purpose.
