"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { Sparkles, Eye, Brain, Compass, Shield, ArrowRight, Check } from "lucide-react";
import ThemeToggle from "@/components/theme-toggle";

export default function LandingContent() {
  const [orbActive, setOrbActive] = useState(false);
  const [demoOpen, setDemoOpen] = useState(false);
  const [activeJourneyStep, setActiveJourneyStep] = useState(0);

  // Periodic rotation or floating trigger for the Hero Orb
  useEffect(() => {
    const interval = setInterval(() => {
      setOrbActive((prev) => !prev);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const journeySteps = [
    {
      title: "Overwhelmed",
      temple: "/assets/temples/temple_1_focus.png",
      tagline: "Focus",
      description: "Quieting the external noise to find your center and clarify what matters most.",
    },
    {
      title: "Focused",
      temple: "/assets/temples/temple_2_discipline.png",
      tagline: "Discipline",
      description: "Establishing consistent daily routines that build compound momentum over time.",
    },
    {
      title: "Disciplined",
      temple: "/assets/temples/temple_3_growth.png",
      tagline: "Growth",
      description: "Expanding your strategies and unlocking new capabilities with balanced ambition.",
    },
    {
      title: "Growing",
      temple: "/assets/temples/temple_4_wisdom.png",
      tagline: "Wisdom",
      description: "Reflecting on daily experiences to distill insights and adjust your future actions.",
    },
    {
      title: "Wise & Masterful",
      temple: "/assets/temples/temple_5_mastery.png",
      tagline: "Mastery",
      description: "Aligning who you are becoming with what you execute, achieving state of peace.",
    },
  ];

  return (
    <div className="min-h-screen w-full bg-background text-foreground overflow-x-hidden selection:bg-accent/20 selection:text-foreground">
      
      {/* Navbar */}
      <nav className="fixed top-0 left-0 w-full z-50 py-6 px-8 md:px-16 flex justify-between items-center bg-background/80 backdrop-blur-md border-b border-border/20">
        <div className="flex items-center gap-2">
          <span className="font-heading text-2xl font-light tracking-wide text-foreground">
            ZENKAI
          </span>
        </div>
        <div className="flex items-center gap-6">
          <ThemeToggle />
          <Link
            href="/login"
            className="font-sans text-xs tracking-wider uppercase font-semibold text-muted-foreground hover:text-foreground transition-colors"
          >
            Sign In
          </Link>
          <Link
            href="/signup"
            className="font-sans text-xs tracking-wider uppercase font-semibold py-2.5 px-5 rounded-full bg-primary text-primary-foreground hover:bg-accent hover:text-accent-foreground transition-all duration-300"
          >
            Begin Journey
          </Link>
        </div>
      </nav>

      {/* Section 1 — Hero */}
      <section className="relative min-h-screen w-full flex flex-col justify-between pt-32 pb-16 px-8 md:px-16 overflow-hidden">
        {/* Faded Temple Background */}
        <div 
          className="absolute right-0 top-0 h-full w-full md:w-1/2 pointer-events-none select-none z-0"
          style={{
            maskImage: "linear-gradient(to left, rgba(0,0,0,1) 50%, rgba(0,0,0,0) 100%)",
            WebkitMaskImage: "linear-gradient(to left, rgba(0,0,0,1) 50%, rgba(0,0,0,0) 100%)"
          }}
        >
          <Image
            src="/assets/temples/temple_1_focus.png"
            alt="Temple of Focus"
            fill
            priority
            className="object-cover object-right-bottom opacity-75 dark:opacity-20"
          />
        </div>

        {/* Hero content */}
        <div className="flex-1 flex flex-col justify-center items-start z-10 max-w-2xl mt-12 md:mt-0">
          <span className="font-sans text-xs tracking-[0.25em] text-accent font-semibold uppercase mb-4 block">
            AI Growth Partner
          </span>
          <h1 className="font-heading text-5xl md:text-7xl font-light leading-none mb-6 animate-fade-in">
            Stop Planning.<br />
            <span className="italic font-normal">Start Becoming.</span>
          </h1>
          <p className="font-sans text-lg text-muted-foreground max-w-lg mb-10 leading-relaxed">
            Zenkai quietly understands your ambitions, plans your growth, and helps you become the person you want to be.
          </p>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full sm:w-auto">
            <Link
              href="/signup"
              className="py-4 px-8 rounded-full font-sans text-xs tracking-wider uppercase font-semibold text-center bg-primary text-primary-foreground hover:bg-accent hover:text-accent-foreground transition-all duration-300 shadow-md hover:shadow-lg"
            >
              Meet your partner
            </Link>
            <button
              onClick={() => setDemoOpen(true)}
              className="py-4 px-8 rounded-full font-sans text-xs tracking-wider uppercase font-semibold text-center border border-border/80 hover:border-accent/40 bg-secondary hover:bg-secondary/80 text-foreground transition-all duration-300 cursor-pointer"
            >
              Watch Demo
            </button>
          </div>
        </div>

        {/* Center/Right floating Orb (Shifted for layout spacing) */}
        <div className="absolute right-12 md:right-1/4 top-1/2 -translate-y-1/2 hidden md:flex flex-col items-center gap-4 z-10 pointer-events-none">
          <div className="absolute -inset-16 rounded-full bg-accent/5 blur-3xl opacity-60 pointer-events-none" />
          <div 
            className={`relative w-64 h-64 transition-transform duration-[5000ms] ease-in-out ${
              orbActive ? "translate-y-3 rotate-6 scale-105" : "-translate-y-3 -rotate-6 scale-95"
            }`}
          >
            <Image
              src="/assets/orbs/companion_orb.png"
              alt="Companion Orb"
              fill
              priority
              sizes="256px"
              className="object-contain drop-shadow-[0_10px_25px_rgba(201,168,106,0.1)]"
            />
          </div>
        </div>
      </section>

      {/* Section 2 — Why Zenkai Exists */}
      <section className="py-24 md:py-36 px-8 md:px-16 max-w-4xl mx-auto text-center border-t border-border/20">
        <span className="font-sans text-[10px] tracking-[0.2em] text-accent font-semibold uppercase mb-4 block">
          The Problem
        </span>
        <h2 className="font-heading text-3xl md:text-5xl font-light text-foreground mb-8">
          The Cognitive Load of Planning
        </h2>
        <div className="h-[1px] w-24 bg-accent/40 mx-auto mb-10" />
        <p className="font-sans text-lg md:text-xl text-muted-foreground leading-relaxed italic max-w-2xl mx-auto">
          "Most people don't fail because they lack ambition. They fail because they spend too much time planning and too little time doing. Your AI partner should remove that burden, not add to it."
        </p>
      </section>

      {/* Section 3 — Meet Your AI Companion */}
      <section className="py-24 md:py-36 px-8 md:px-16 bg-secondary/35 border-y border-border/25">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center gap-12 md:gap-20">
          <div className="flex-1 space-y-6">
            <span className="font-sans text-[10px] tracking-[0.2em] text-accent font-semibold uppercase block">
              Zenkai Companion
            </span>
            <h2 className="font-heading text-3xl md:text-5xl font-light">
              A Presence, <span className="italic">Not a Chatbot</span>
            </h2>
            <p className="font-sans text-base text-muted-foreground leading-relaxed">
              Zenkai is not a dialog box waiting to answer generic questions, nor is it a checklist of productivity hacks. It is a calm, evolving companion that lives alongside you.
            </p>
            <p className="font-sans text-base text-muted-foreground leading-relaxed">
              It continuously thinks in the background. It remembers your constraints, prioritizes your day based on your core desires, and learns from your patterns. It quietly handles the cognitive overhead of structure so you can focus on creation.
            </p>
          </div>
          
          <div className="flex-1 flex justify-center relative">
            <div className="absolute -inset-10 rounded-full bg-accent/5 blur-3xl opacity-50" />
            <div className="relative w-56 h-56 md:w-80 md:h-80 animate-float">
              <Image
                src="/assets/orbs/companion_orb.png"
                alt="Companion Orb"
                fill
                sizes="320px"
                className="object-contain drop-shadow-[0_15px_30px_rgba(201,168,106,0.12)]"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Section 4 — Multi-Agent Intelligence */}
      <section className="py-24 md:py-36 px-8 md:px-16 max-w-6xl mx-auto">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <span className="font-sans text-[10px] tracking-[0.2em] text-accent font-semibold uppercase mb-4 block">
            Architecture
          </span>
          <h2 className="font-heading text-3xl md:text-5xl font-light">
            Six Collaborating Minds
          </h2>
          <p className="font-sans text-sm text-muted-foreground mt-4 leading-relaxed">
            Behind Zenkai's simple interface, six specialized agents collaborate to analyze, recall, plan, and guide your daily progress.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            {
              title: "Companion Agent",
              desc: "The gentle face of Zenkai. Guides your daily conversations, registers mood, and keeps the growth relationship personal.",
              icon: <Compass className="text-accent" size={20} />,
            },
            {
              title: "Memory Agent",
              desc: "The archivist. Maintains long-term context, recalls important aspirations, and ranks past information dynamically.",
              icon: <Brain className="text-accent" size={20} />,
            },
            {
              title: "Strategy Agent",
              desc: "The architect. Formulates weekly roadmaps, breaks down abstract desires, and designs developmental milestones.",
              icon: <Sparkles className="text-accent" size={20} />,
            },
            {
              title: "Execution Agent",
              desc: "The organizer. Converts strategy into concrete, high-priority tasks and checks in on your daily workload.",
              icon: <ArrowRight className="text-accent" size={20} />,
            },
            {
              title: "Reflection Agent",
              desc: "The mirror. Audits your completed tasks, logs your daily reflections, and extracts deep learning insights.",
              icon: <Eye className="text-accent" size={20} />,
            },
            {
              title: "Identity Agent",
              desc: "The guardian. Evolves a comprehensive understanding of who you are, verifying evidence of the person you're becoming.",
              icon: <Shield className="text-accent" size={20} />,
            },
          ].map((agent, i) => (
            <div key={i} className="bg-card border border-border p-8 rounded-xl flex flex-col gap-4 shadow-sm hover:shadow-md transition-all duration-300 hover:border-accent/30">
              <div className="flex items-center justify-between">
                <span className="font-heading text-xl font-light text-foreground">{agent.title}</span>
                {agent.icon}
              </div>
              <p className="font-sans text-xs text-muted-foreground leading-relaxed">{agent.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Section 5 — The Growth Journey */}
      <section className="py-24 md:py-36 px-8 md:px-16 bg-secondary/20 border-y border-border/25 relative overflow-hidden">
        <div className="max-w-6xl mx-auto relative z-10">
          
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="font-sans text-[10px] tracking-[0.2em] text-accent font-semibold uppercase mb-4 block">
              The Path
            </span>
            <h2 className="font-heading text-3xl md:text-5xl font-light">
              Your Evolving States
            </h2>
            <p className="font-sans text-sm text-muted-foreground mt-4 leading-relaxed">
              Zenkai coordinates your schedule and reflections to guide you smoothly through five fundamental stages of focus and clarity.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Left Column: Interactive State Selector */}
            <div className="lg:col-span-5 flex flex-col gap-3">
              {journeySteps.map((step, index) => (
                <button
                  key={index}
                  onClick={() => setActiveJourneyStep(index)}
                  className={`w-full text-left p-5 rounded-xl border transition-all duration-300 flex items-center justify-between cursor-pointer ${
                    activeJourneyStep === index
                      ? "bg-card border-accent text-foreground shadow-sm"
                      : "bg-transparent border-transparent text-muted-foreground hover:bg-secondary/40 hover:text-foreground"
                  }`}
                >
                  <div className="flex flex-col gap-1">
                    <span className="font-heading text-lg font-light">{step.title}</span>
                    <span className="font-sans text-[10px] uppercase tracking-wider text-accent font-medium">
                      Stage {index + 1} — {step.tagline}
                    </span>
                  </div>
                  <ArrowRight 
                    size={16} 
                    className={`transition-transform duration-300 ${
                      activeJourneyStep === index ? "translate-x-1 text-accent" : "opacity-0"
                    }`} 
                  />
                </button>
              ))}
            </div>

            {/* Right Column: Display Active Stage details & Temple Art Faded Background */}
            <div className="lg:col-span-7 bg-card border border-border p-8 rounded-xl min-h-[380px] flex flex-col justify-between relative overflow-hidden shadow-sm">
              {/* Active Temple Background faded */}
              <div className="absolute inset-0 opacity-15 dark:opacity-5 pointer-events-none select-none">
                <Image
                  src={journeySteps[activeJourneyStep].temple}
                  alt={journeySteps[activeJourneyStep].title}
                  fill
                  className="object-cover object-right-bottom transition-all duration-500"
                />
              </div>

              <div className="z-10 space-y-6">
                <span className="font-sans text-xs tracking-widest text-accent uppercase font-bold">
                  Temple of {journeySteps[activeJourneyStep].tagline}
                </span>
                <h3 className="font-heading text-4xl font-light">
                  {journeySteps[activeJourneyStep].title}
                </h3>
                <p className="font-sans text-sm text-muted-foreground leading-relaxed max-w-md">
                  {journeySteps[activeJourneyStep].description}
                </p>
              </div>

              <div className="z-10 border-t border-border/40 pt-6 flex justify-between items-center">
                <span className="font-sans text-[10px] text-muted-foreground uppercase tracking-widest">
                  Visual theme updates to match state
                </span>
                <Link
                  href="/signup"
                  className="font-sans text-xs font-semibold text-accent hover:underline flex items-center gap-1.5"
                >
                  Begin state transition <ArrowRight size={12} />
                </Link>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* Section 6 — What Makes Zenkai Different */}
      <section className="py-24 md:py-36 px-8 md:px-16 max-w-5xl mx-auto">
        <div className="text-center mb-16">
          <span className="font-sans text-[10px] tracking-[0.2em] text-accent font-semibold uppercase mb-4 block">
            Comparison
          </span>
          <h2 className="font-heading text-3xl md:text-5xl font-light">
            A Deeper Alignment
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Traditional AI */}
          <div className="p-8 border border-border/50 rounded-xl space-y-6 bg-secondary/10">
            <h3 className="font-heading text-2xl font-light text-muted-foreground uppercase tracking-wider text-sm">
              Standard AI
            </h3>
            <ul className="space-y-4 font-sans text-sm text-muted-foreground">
              <li className="flex items-start gap-3">
                <span className="text-red-500 font-bold mt-0.5">•</span>
                <span>Waits silently for direct instructions or prompts.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-red-500 font-bold mt-0.5">•</span>
                <span>Forgets who you are once a chat thread ends.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-red-500 font-bold mt-0.5">•</span>
                <span>Focuses purely on instant, transactional query answering.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-red-500 font-bold mt-0.5">•</span>
                <span>Adds extra cognitive overhead by forcing you to organize.</span>
              </li>
            </ul>
          </div>

          {/* Zenkai AI */}
          <div className="p-8 border border-accent/40 rounded-xl space-y-6 bg-card shadow-sm">
            <h3 className="font-heading text-2xl font-light text-accent uppercase tracking-wider text-sm font-semibold">
              Zenkai Companion
            </h3>
            <ul className="space-y-4 font-sans text-sm text-foreground">
              <li className="flex items-start gap-3">
                <span className="text-accent font-bold mt-0.5">✓</span>
                <span>Prepares for tomorrow while you are living today.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-accent font-bold mt-0.5">✓</span>
                <span>Maintains an evolving, holistic model of your identity.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-accent font-bold mt-0.5">✓</span>
                <span>Focuses on long-term developmental growth and strategy.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-accent font-bold mt-0.5">✓</span>
                <span>Quietly absorbs and organizes your mental load in background.</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-24 md:py-36 px-8 md:px-16 bg-secondary/10 border-t border-border/20">
        <div className="max-w-6xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="font-sans text-[10px] tracking-[0.2em] text-accent font-semibold uppercase mb-4 block">
              Pricing
            </span>
            <h2 className="font-heading text-3xl md:text-5xl font-light">
              Elevate Your Growth Space
            </h2>
            <p className="font-sans text-sm text-muted-foreground mt-4 leading-relaxed">
              Choose the tier of scheduling intelligence and cognitive profiling that aligns with your life goals.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
            {/* Free Tier */}
            <div className="flex flex-col justify-between p-8 border border-border/30 rounded-2xl bg-background/50 hover:bg-background/80 transition-all duration-300">
              <div className="space-y-6">
                <div>
                  <span className="font-sans text-[10px] tracking-wider text-muted-foreground font-bold uppercase">Basic</span>
                  <h3 className="font-heading text-2xl font-light mt-1">Zenkai Flow</h3>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="font-heading text-3xl font-light">$0</span>
                  <span className="font-sans text-xs text-muted-foreground">/ month</span>
                </div>
                <p className="font-sans text-xs text-muted-foreground leading-relaxed">
                  Essential tools to organize your days and reflect on consistency.
                </p>
                <hr className="border-border/10" />
                <ul className="space-y-3 font-sans text-xs text-muted-foreground">
                  <li className="flex items-start gap-2.5">
                    <Check size={14} className="text-accent shrink-0 mt-0.5" />
                    <span>1 Active Roadmap Goal</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check size={14} className="text-accent shrink-0 mt-0.5" />
                    <span>Standard Companion Chat</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check size={14} className="text-accent shrink-0 mt-0.5" />
                    <span>Daily Availability Slots</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check size={14} className="text-accent shrink-0 mt-0.5" />
                    <span>Basic Memory Storage</span>
                  </li>
                </ul>
              </div>
              <div className="pt-8">
                <Link
                  href="/signup"
                  className="block w-full py-3 rounded-xl border border-border bg-card hover:bg-secondary/40 text-foreground font-sans font-semibold text-xs tracking-wider uppercase text-center transition-all"
                >
                  Start Free
                </Link>
              </div>
            </div>

            {/* Pro Tier */}
            <div className="flex flex-col justify-between p-8 border-2 border-accent rounded-2xl bg-card relative transform md:-translate-y-4 shadow-xl">
              <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-accent text-primary-foreground text-[9px] font-bold tracking-widest uppercase shadow">
                Most Popular
              </span>
              <div className="space-y-6">
                <div>
                  <span className="font-sans text-[10px] tracking-wider text-accent font-bold uppercase">Pro</span>
                  <h3 className="font-heading text-2xl font-light mt-1">Zenkai Ascent</h3>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="font-heading text-3xl font-light">$12</span>
                  <span className="font-sans text-xs text-muted-foreground">/ month</span>
                </div>
                <p className="font-sans text-xs text-muted-foreground leading-relaxed">
                  Advanced re-balancing, calendar syncing, and cognitive depth.
                </p>
                <hr className="border-border/10" />
                <ul className="space-y-3 font-sans text-xs text-foreground">
                  <li className="flex items-start gap-2.5">
                    <Check size={14} className="text-accent shrink-0 mt-0.5" />
                    <span className="font-medium">Unlimited Roadmap Goals</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check size={14} className="text-accent shrink-0 mt-0.5" />
                    <span className="font-medium">Deep-Logic Companion</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check size={14} className="text-accent shrink-0 mt-0.5" />
                    <span className="font-medium">Automated Re-balancing</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check size={14} className="text-accent shrink-0 mt-0.5" />
                    <span className="font-medium">Google Calendar Sync</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check size={14} className="text-accent shrink-0 mt-0.5" />
                    <span className="font-medium">Evolving Cognitive Profiling</span>
                  </li>
                </ul>
              </div>
              <div className="pt-8">
                <Link
                  href="/signup"
                  className="block w-full py-3 rounded-xl bg-accent hover:bg-accent/90 text-primary-foreground font-sans font-semibold text-xs tracking-wider uppercase text-center transition-all shadow"
                >
                  Go Pro
                </Link>
              </div>
            </div>

            {/* Elite Tier */}
            <div className="flex flex-col justify-between p-8 border border-border/30 rounded-2xl bg-background/50 hover:bg-background/80 transition-all duration-300">
              <div className="space-y-6">
                <div>
                  <span className="font-sans text-[10px] tracking-wider text-muted-foreground font-bold uppercase">Elite</span>
                  <h3 className="font-heading text-2xl font-light mt-1">Zenkai Apex</h3>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="font-heading text-3xl font-light">$29</span>
                  <span className="font-sans text-xs text-muted-foreground">/ month</span>
                </div>
                <p className="font-sans text-xs text-muted-foreground leading-relaxed">
                  Custom cognitive parameters, SMS checks, and executive reports.
                </p>
                <hr className="border-border/10" />
                <ul className="space-y-3 font-sans text-xs text-muted-foreground">
                  <li className="flex items-start gap-2.5">
                    <Check size={14} className="text-accent shrink-0 mt-0.5" />
                    <span>Everything in Ascent Pro</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check size={14} className="text-accent shrink-0 mt-0.5" />
                    <span>Custom Cognitive Tuning</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check size={14} className="text-accent shrink-0 mt-0.5" />
                    <span>Proactive SMS Check-ins</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check size={14} className="text-accent shrink-0 mt-0.5" />
                    <span>Weekly Executive Briefs</span>
                  </li>
                </ul>
              </div>
              <div className="pt-8">
                <Link
                  href="/signup"
                  className="block w-full py-3 rounded-xl border border-border bg-card hover:bg-secondary/40 text-foreground font-sans font-semibold text-xs tracking-wider uppercase text-center transition-all"
                >
                  Contact Elite
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 7 — Final CTA */}
      <section className="relative h-screen w-full flex flex-col justify-center items-center px-8 text-center overflow-hidden border-t border-border/20 bg-background">
        {/* Faded background temple of mastery */}
        <div className="absolute inset-0 opacity-20 dark:opacity-10 pointer-events-none select-none z-0">
          <Image
            src="/assets/temples/temple_5_mastery.png"
            alt="Temple of Mastery"
            fill
            className="object-cover object-bottom"
          />
        </div>

        {/* Floating Orb */}
        <div className="z-10 flex flex-col items-center gap-8 max-w-2xl relative">
          <div className="absolute -inset-12 rounded-full bg-accent/5 blur-3xl opacity-50 pointer-events-none" />
          <div className="relative w-36 h-36 md:w-44 md:h-44 animate-float">
            <Image
              src="/assets/orbs/companion_orb.png"
              alt="Companion Orb"
              fill
              sizes="176px"
              className="object-contain drop-shadow-[0_10px_20px_rgba(201,168,106,0.15)]"
            />
          </div>

          <div className="space-y-4">
            <span className="font-sans text-[10px] tracking-[0.25em] text-accent font-semibold uppercase block">
              Step Inside
            </span>
            <h2 className="font-heading text-4xl md:text-6xl font-light text-foreground">
              Enter Your Growth Space
            </h2>
            <p className="font-sans text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
              Quiet the noise, align your daily priorities, and let your companion carry the load.
            </p>
          </div>

          <div className="pt-4 w-full sm:w-auto">
            <Link
              href="/signup"
              className="inline-block py-4 px-10 rounded-full font-sans text-xs tracking-wider uppercase font-semibold bg-primary text-primary-foreground hover:bg-accent hover:text-accent-foreground transition-all duration-300 shadow-md hover:shadow-lg w-full sm:w-auto cursor-pointer"
            >
              Begin Your Journey
            </Link>
          </div>
        </div>
      </section>

      {/* Demo Modal (Watch Demo Placeholder) */}
      {demoOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/90 backdrop-blur-md animate-fade-in">
          <div className="bg-card border border-border p-8 rounded-xl max-w-lg w-full text-center space-y-6 relative shadow-lg">
            <span className="font-sans text-[10px] tracking-[0.2em] text-accent font-semibold uppercase block">
              Preview Video
            </span>
            <h3 className="font-heading text-3xl font-light">
              The Zenkai Experience
            </h3>
            
            {/* Placeholder Visual box */}
            <div className="w-full h-64 bg-secondary rounded-lg flex flex-col justify-center items-center gap-4 text-muted-foreground border border-border/50 relative overflow-hidden">
              {/* Subtle visual simulation of companion orb */}
              <div className="relative w-20 h-20 animate-pulse opacity-40">
                <Image
                  src="/assets/orbs/companion_orb.png"
                  alt="Orb simulation"
                  fill
                  sizes="80px"
                  className="object-contain"
                />
              </div>
              <span className="font-sans text-xs tracking-wider">Demo Video Player Placeholder</span>
            </div>

            <p className="font-sans text-xs text-muted-foreground leading-relaxed">
              This preview illustrates the six-agent architecture and conversational interactions of Zenkai. Fully functional interactive companion demo is available inside the application.
            </p>

            <button
              onClick={() => setDemoOpen(false)}
              className="py-2.5 px-6 rounded-full font-sans text-xs tracking-wider uppercase font-semibold bg-secondary border border-border/60 hover:bg-secondary/80 text-foreground transition-all duration-200 cursor-pointer"
            >
              Close Preview
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
