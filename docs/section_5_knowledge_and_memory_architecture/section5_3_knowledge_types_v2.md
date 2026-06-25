# Section 5.3 --- Knowledge Types

## Purpose

Define the categories of knowledge the AI maintains. Each category has a
different owner, lifetime, and purpose.

## 1. Identity

Represents who the user is. - Name - Roles (Student, Developer, Creator,
etc.) - Profession - Personality profile - Communication preferences

Owner: Identity Agent\
Lifetime: Permanent (updated gradually)

------------------------------------------------------------------------

## 2. Aspirations

Represents who the user wants to become. - Long-term goals - Career
vision - Skill roadmap

Owner: Identity Agent\
Lifetime: Long-term

------------------------------------------------------------------------

## 3. Principles

Stable decision-making preferences. - Prefers long-term gains - Likes
accountability - Learns by building

Owner: Identity Agent

------------------------------------------------------------------------

## 4. Current Direction

Active projects and goals. - Current project - Exams - Hackathons -
Courses

Owner: Strategy Agent

------------------------------------------------------------------------

## 5. Relationship Timeline

Important milestones shared with the AI. - First interaction - Major
achievements - Significant failures - Turning points

Owner: Reflection Agent

------------------------------------------------------------------------

## 6. Transformations

How the user has changed over time. - Became more consistent - Improved
confidence - Better planning habits

Owner: Reflection Agent

------------------------------------------------------------------------

## 7. Boundaries

Constraints the AI should always respect. - Do not schedule during
family time - Respect focus hours - Preferred coaching style

Owner: Identity Agent

------------------------------------------------------------------------

## 8. Temporary Working Memory

Short-lived information required for current reasoning. - Today's mood -
Active conversation - Current schedule - Immediate context

Owner: Memory Agent\
Lifetime: Minutes to days

------------------------------------------------------------------------

## Design Principle

The AI remembers only information that improves future decisions. Every
knowledge type exists to reduce cognitive load and improve future
planning, not to store arbitrary facts.
