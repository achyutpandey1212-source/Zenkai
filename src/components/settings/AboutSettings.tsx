"use client";

import React from "react";
import Image from "next/image";

export default function AboutSettings() {
  const handleSayHello = () => {
    window.location.href = "achyutpandey1212@gmail.com?subject=Hello%20from%20Zen";
  };

  const lookingForRoles = [
    {
      title: "Designers",
      desc: "Refine Zen's dark luxury aesthetic, micro-animations, and Cormorant typography templates.",
    },
    {
      title: "Frontend Engineers",
      desc: "Craft high-performance, polished client interfaces using Next.js, Tailwind, and React 19.",
    },
    {
      title: "Backend Engineers",
      desc: "Architect scalable database models, ingestion pipelines, and secure API endpoints.",
    },
    {
      title: "AI Engineers",
      desc: "Develop evolving cognitive profiling models, long-term memory recall, and local prompt layers.",
    },
    {
      title: "Students",
      desc: "Test early builds, report bugs, and shape Zen's features for university/placement workflows.",
    },
    {
      title: "Early Users",
      desc: "Provide raw, honest feedback on daily usage, consistency loops, and scheduling friction.",
    },
    {
      title: "Product Thinkers",
      desc: "Design core engagement loops, behavioral triggers, and psychological growth hooks.",
    },
    {
      title: "Researchers",
      desc: "Investigate time management paradigms, flow states, and cognitive load management.",
    },
  ];

  const roadmapItems = [
    { name: "Onboarding V2", done: true },
    { name: "You Hub (Identity & Reflections)", done: true },
    { name: "Settings V2 (Centered Modals)", done: true },
    { name: "Voice Companion", done: false },
    { name: "Mobile Application", done: false },
    { name: "Agent Marketplace", done: false },
    { name: "Team Mode", done: false },
  ];

  return (
    <div className="flex flex-col gap-10 w-full max-w-3xl animate-in fade-in duration-200">
      {/* Page Header / Mission Pitch */}
      <div className="flex flex-col gap-2.5">
        <span className="font-sans text-[10px] tracking-[0.25em] text-accent font-semibold uppercase">
          Build with Me
        </span>
        <h2 className="font-heading text-3xl md:text-4xl font-light tracking-wide text-foreground">
          Join me in building the future of Zen.
        </h2>
        <p className="font-sans text-xs text-muted-foreground leading-relaxed max-w-2xl italic border-l-2 border-accent/40 pl-3">
          "This isn't just an app. It's a long-term mission. If you're excited by AI, productivity, design, psychology, systems thinking, or building ambitious software—I'd genuinely love to meet you."
        </p>
      </div>

      {/* Building Zen in Public Card */}
      <div className="bg-accent/5 border border-accent/20 rounded-2xl p-5 md:p-6 transition-all duration-300 hover:shadow-[0_0_20px_rgba(201,168,106,0.05)]">
        <div className="flex flex-col gap-2 font-sans">
          <span className="text-[10px] tracking-wider text-accent font-bold uppercase block select-none">
            Building Zen in Public
          </span>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Zen is currently in active development. Every user directly shapes its future. If you've found bugs,
            have product ideas, love design, or simply want to build something ambitious—I'd genuinely love to hear from you.
          </p>
        </div>
      </div>

      {/* About the Builder Section */}
      <div className="space-y-4">
        <span className="font-sans text-[10px] tracking-[0.2em] text-accent/80 font-bold uppercase block select-none">
          About the Builder
        </span>

        <div className="bg-card/50 border border-border/50 rounded-2xl p-5 md:p-6 flex flex-col md:flex-row gap-6 items-center md:items-start text-center md:text-left transition-all duration-300 hover:border-accent/20">
          {/* Avatar Image */}
          <div className="relative h-28 w-28 rounded-full overflow-hidden border-2 border-accent/30 bg-secondary/50 shrink-0 shadow-md">
            <Image
              src="/assets/developer_avatar.svg"
              alt="Achyut Pandey"
              fill
              priority
              className="object-cover"
            />
          </div>

          <div className="flex flex-col gap-4 flex-1">
            <div className="space-y-1">
              <h3 className="font-heading text-2xl font-light text-foreground">Achyut Pandey</h3>
              <p className="font-sans text-xs text-accent font-medium tracking-wide">
                AI Product Builder & Full Stack Developer
              </p>
            </div>

            {/* Badges */}
            <div className="flex flex-wrap gap-2 justify-center md:justify-start">
              {[
                "B.Tech Electronics & Communication",
                "MERN Stack",
                "1.2M+ Views",
                "AI Systems",
                "UI/UX",
                "Product Design",
              ].map((badge) => (
                <span
                  key={badge}
                  className="bg-secondary/40 border border-border/60 text-[10px] font-sans text-muted-foreground px-2.5 py-0.5 rounded-full"
                >
                  {badge}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Why Zen Exists Card */}
      <div className="space-y-4">
        <span className="font-sans text-[10px] tracking-[0.2em] text-accent/80 font-bold uppercase block select-none">
          Why Zen Exists
        </span>
        <div className="bg-card/40 border border-border/40 rounded-2xl p-5 md:p-6 transition-all duration-300 hover:border-accent/20">
          <p className="font-heading text-lg md:text-xl font-light text-foreground/90 italic leading-relaxed text-center max-w-xl mx-auto">
            "I built Zen because I wanted software that understands people—not just schedules them. Calendars organize time. Zen understands ambition."
          </p>
        </div>
      </div>

      {/* Looking For Centerpiece */}
      <div className="space-y-4">
        <span className="font-sans text-[10px] tracking-[0.2em] text-accent/80 font-bold uppercase block select-none">
          Looking For
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {lookingForRoles.map((role) => (
            <div
              key={role.title}
              className="bg-card/30 border border-border/40 rounded-xl p-4 flex flex-col gap-1 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_0_15px_rgba(201,168,106,0.04)] hover:border-accent/20"
            >
              <h4 className="font-sans text-xs font-semibold text-foreground">
                {role.title}
              </h4>
              <p className="font-sans text-[10px] text-muted-foreground leading-normal">
                {role.desc}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Product Roadmap & Open Source */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Timeline */}
        <div className="space-y-4">
          <span className="font-sans text-[10px] tracking-[0.2em] text-accent/80 font-bold uppercase block select-none">
            Development Roadmap
          </span>
          <div className="bg-card/30 border border-border/40 rounded-2xl p-5 space-y-3.5">
            {roadmapItems.map((item) => (
              <div key={item.name} className="flex items-center gap-2.5 font-sans text-xs">
                {item.done ? (
                  <span className="h-4.5 w-4.5 rounded-full bg-green-500/10 border border-green-500/35 text-green-500 flex items-center justify-center text-[9px] font-bold shrink-0">
                    ✓
                  </span>
                ) : (
                  <span className="h-4.5 w-4.5 rounded-full bg-secondary border border-border text-muted-foreground/40 flex items-center justify-center text-[9px] shrink-0">
                    ○
                  </span>
                )}
                <span className={item.done ? "text-foreground/90 font-medium" : "text-muted-foreground/60"}>
                  {item.name}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Open Source Info */}
        <div className="space-y-4 flex flex-col">
          <span className="font-sans text-[10px] tracking-[0.2em] text-accent/80 font-bold uppercase block select-none">
            Open Source Initiative
          </span>
          <div className="bg-card/30 border border-border/40 rounded-2xl p-5 flex-1 flex flex-col justify-between">
            <div className="space-y-2">
              <h4 className="font-sans text-xs font-semibold text-foreground">
                Future Open Source Release
              </h4>
              <p className="font-sans text-[11px] text-muted-foreground leading-relaxed">
                Even though Zen's core codebase is private today, we plan to open-source components, MCP connectors, and psychological traits models.
              </p>
            </div>
            <div className="mt-4">
              <span className="px-3 py-1 border border-accent/25 bg-accent/5 text-accent text-[9px] font-sans font-bold uppercase tracking-wider rounded-full">
                Coming Later
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Connect Block with proper buttons & official icons */}
      <div className="space-y-4 pt-4 border-t border-border/20">
        <span className="font-sans text-[10px] tracking-[0.2em] text-accent/80 font-bold uppercase block select-none text-center">
          Get in Touch
        </span>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full max-w-md mx-auto">
          {/* GitHub Button */}
          <a
            href="https://github.com/achyutpandey1212-source"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:flex-1 py-2.5 px-4 rounded-xl border border-border/60 bg-card hover:bg-secondary/40 hover:border-accent/40 font-sans text-xs text-muted-foreground hover:text-foreground transition-all duration-200 flex items-center justify-center gap-2 group active:scale-95"
          >
            <Image
              src="/assets/icons/github.svg"
              alt="GitHub"
              width={14}
              height={14}
              className="dark:invert transition-all duration-300 shrink-0"
            />
            GitHub
          </a>

          {/* LinkedIn Button */}
          <a
            href="https://www.linkedin.com/in/achyut-pandey-122a87323/"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:flex-1 py-2.5 px-4 rounded-xl border border-border/60 bg-card hover:bg-secondary/40 hover:border-accent/40 font-sans text-xs text-muted-foreground hover:text-foreground transition-all duration-200 flex items-center justify-center gap-2 group active:scale-95"
          >
            <Image
              src="/assets/icons/linkedin.svg"
              alt="LinkedIn"
              width={14}
              height={14}
              className="dark:invert transition-all duration-300 shrink-0"
            />
            LinkedIn
          </a>

          {/* Email Button */}
          <button
            onClick={handleSayHello}
            className="w-full sm:flex-1 py-2.5 px-4 rounded-xl border border-border/60 bg-card hover:bg-secondary/40 hover:border-accent/40 font-sans text-xs text-muted-foreground hover:text-foreground transition-all duration-200 flex items-center justify-center gap-2 group active:scale-95 cursor-pointer"
          >
            <Image
              src="/assets/icons/gmail.svg"
              alt="Gmail"
              width={14}
              height={14}
              className="shrink-0"
            />
            Email
          </button>
        </div>
      </div>

      {/* Tiny Footer */}
      <footer className="text-center py-4 select-none">
        <p className="font-sans text-[9px] text-muted-foreground/60 leading-normal">
          Built with curiosity, late nights, and far too much coffee.
        </p>
        <p className="font-sans text-[9px] text-accent/80 font-bold uppercase tracking-widest mt-1">
          Made in India 🇮🇳
        </p>
      </footer>
    </div>
  );
}
