"use client";

import React from "react";
import { Compass, ShieldCheck, Heart, UserMinus } from "lucide-react";

export default function Identity() {
  const identityTraits = [
    { name: "Builder", confidence: 92, desc: "Expresses thoughts through code, builds functional systems, and learns by shipping prototypes." },
    { name: "Learner", confidence: 85, desc: "Consistently researches core details before starting implementation; deeply values conceptual clarity." },
    { name: "Goal-Oriented", confidence: 88, desc: "Motivated by long-term impact rather than short-term convenience. Projects reflect deep commitment." }
  ];

  const principles = [
    "Growth Over Comfort",
    "Long-Term Thinking",
    "Sustainable Pace"
  ];

  const patterns = [
    { label: "Peak Focus", value: "Evening" },
    { label: "Work Preference", value: "Deep Work Blocks" },
    { label: "Learning Style", value: "Hands-on Prototyping" }
  ];

  return (
    <div className="h-full w-full overflow-y-auto p-8 md:p-16 flex flex-col items-center bg-background">
      
      <div className="max-w-2xl w-full flex flex-col gap-12 mt-8">
        
        {/* Header Section */}
        <header className="flex flex-col gap-3">
          <span className="font-sans text-xs tracking-[0.25em] text-accent font-semibold uppercase">
            Self Awareness
          </span>
          <h1 className="font-heading text-4xl md:text-5xl font-light text-foreground">
            Evolving Identity
          </h1>
          <p className="font-sans text-sm text-muted-foreground leading-relaxed">
            Zenkai refines its understanding of you after every conversation. This blueprint reflects your core patterns.
          </p>
        </header>

        {/* Core Aspiration Card */}
        <section className="bg-secondary/40 border border-border p-8 rounded-2xl flex flex-col gap-4 relative overflow-hidden">
          {/* Subtle gold watermark */}
          <div className="absolute right-0 bottom-0 translate-x-12 translate-y-12 opacity-5 pointer-events-none">
            <Compass size={180} className="text-accent" />
          </div>
          
          <span className="font-sans text-[10px] tracking-[0.2em] text-accent font-bold uppercase">
            Aspiration
          </span>
          <h2 className="font-heading text-3xl font-light text-foreground">
            AI Entrepreneur & Software Engineer
          </h2>
          <p className="font-sans text-xs text-muted-foreground leading-relaxed max-w-lg">
            Dedicated to creating systems that reduce cognitive load and resolve real-world complexity, with a primary focus on agentic automation.
          </p>
        </section>

        {/* Current Identity & Confidence Section */}
        <section className="space-y-6">
          <span className="font-sans text-[10px] tracking-[0.2em] text-accent/80 font-bold uppercase block">
            Core Traits & Confidence
          </span>
          
          <div className="space-y-4">
            {identityTraits.map((trait) => (
              <div 
                key={trait.name} 
                className="bg-card border border-border p-6 rounded-xl flex flex-col gap-3 hover:border-accent/30 transition-all duration-300"
              >
                <div className="flex justify-between items-center">
                  <span className="font-heading text-xl font-medium text-foreground">{trait.name}</span>
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck size={14} className="text-accent" />
                    <span className="font-sans text-xs font-semibold text-accent">{trait.confidence}% Confidence</span>
                  </div>
                </div>
                <p className="font-sans text-xs text-muted-foreground leading-relaxed">
                  {trait.desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Operating Principles and Patterns */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* Principles */}
          <section className="space-y-4">
            <span className="font-sans text-[10px] tracking-[0.2em] text-accent/80 font-bold uppercase block">
              Operating Principles
            </span>
            <div className="bg-card border border-border p-6 rounded-xl space-y-3">
              {principles.map((pr, idx) => (
                <div key={pr} className="flex items-center gap-3">
                  <span className="font-heading text-sm text-accent">0{idx + 1}.</span>
                  <span className="font-sans text-xs text-foreground font-medium tracking-wide">{pr}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Behavioral Patterns */}
          <section className="space-y-4">
            <span className="font-sans text-[10px] tracking-[0.2em] text-accent/80 font-bold uppercase block">
              Behavioral Patterns
            </span>
            <div className="bg-card border border-border p-6 rounded-xl space-y-4">
              {patterns.map((pt) => (
                <div key={pt.label} className="flex justify-between items-center border-b border-border/40 pb-2.5 last:border-b-0 last:pb-0">
                  <span className="font-sans text-xs text-muted-foreground">{pt.label}</span>
                  <span className="font-sans text-xs font-semibold text-foreground tracking-wide">{pt.value}</span>
                </div>
              ))}
            </div>
          </section>

        </div>

      </div>

    </div>
  );
}
