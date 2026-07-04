"use client";

import React, { useState } from "react";
import SectionHeader from "./SectionHeader";

interface CompanionSettingsProps {
  autonomy: "minimal" | "balanced" | "proactive";
  setAutonomy: (val: "minimal" | "balanced" | "proactive") => void;
  commStyle: "quiet" | "direct" | "collaborative" | "balanced";
  setCommStyle: (val: "quiet" | "direct" | "collaborative" | "balanced") => void;
}

export default function CompanionSettings({
  autonomy,
  setAutonomy,
  commStyle,
  setCommStyle,
}: CompanionSettingsProps) {
  const [depth, setDepth] = useState<"short" | "normal" | "deep">("normal");

  const autonomyLevels = [
    {
      id: "minimal" as const,
      label: "Minimal",
      desc: "Zenkai only acts on direct requests.",
    },
    {
      id: "balanced" as const,
      label: "Balanced",
      desc: "Proactively suggests daily schedules & flags clashes.",
    },
    {
      id: "proactive" as const,
      label: "Proactive",
      desc: "Automatically reschedules conflicts & checks in frequently.",
    },
  ];

  const commStyles = [
    { id: "quiet" as const, label: "Quiet", desc: "Minimalist, concise updates only when prompted." },
    { id: "direct" as const, label: "Direct", desc: "No fluff, straight to actionables and goals." },
    { id: "balanced" as const, label: "Balanced", desc: "Blends structured checks with supportive prose." },
    { id: "collaborative" as const, label: "Collaborative", desc: "Highly interactive brainstorming assistant." },
  ];

  const depths = [
    { id: "short" as const, label: "Short", desc: "Under 100 words per response." },
    { id: "normal" as const, label: "Normal", desc: "Standard details and reasoning." },
    { id: "deep" as const, label: "Deep", desc: "Full cognitive maps and breakdowns." },
  ];

  return (
    <div className="flex flex-col gap-8 w-full max-w-2xl animate-in fade-in duration-200">
      <SectionHeader
        title="Companion Personality Parameters"
        description="Fine-tune Zenkai's cognitive level, autonomy preferences, and dialogue styles."
      />

      {/* Autonomy Level */}
      <div className="space-y-3">
        <label className="font-sans text-xs font-semibold text-foreground tracking-wide block">
          Planning Behaviour (Autonomy Level)
        </label>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {autonomyLevels.map((lvl) => (
            <button
              key={lvl.id}
              type="button"
              onClick={() => setAutonomy(lvl.id)}
              className={`text-left p-4 rounded-xl border font-sans transition-all duration-300 ${
                autonomy === lvl.id
                  ? "bg-secondary border-accent text-foreground shadow-sm"
                  : "border-border/60 text-muted-foreground hover:bg-secondary/40 hover:text-foreground"
              }`}
            >
              <div className="text-xs font-semibold mb-1">{lvl.label}</div>
              <div className="text-[10px] opacity-80 leading-normal">{lvl.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Communication Style */}
      <div className="space-y-3">
        <label className="font-sans text-xs font-semibold text-foreground tracking-wide block">
          Communication Style
        </label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {commStyles.map((style) => (
            <button
              key={style.id}
              type="button"
              onClick={() => setCommStyle(style.id)}
              className={`text-left p-4 rounded-xl border font-sans transition-all duration-300 ${
                commStyle === style.id
                  ? "bg-secondary border-accent text-foreground shadow-sm"
                  : "border-border/60 text-muted-foreground hover:bg-secondary/40 hover:text-foreground"
              }`}
            >
              <div className="text-xs font-semibold mb-1">{style.label}</div>
              <div className="text-[10px] opacity-80 leading-normal">{style.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Conversation Depth */}
      <div className="space-y-3">
        <label className="font-sans text-xs font-semibold text-foreground tracking-wide block">
          Conversation Depth
        </label>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {depths.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => setDepth(d.id)}
              className={`text-left p-4 rounded-xl border font-sans transition-all duration-300 ${
                depth === d.id
                  ? "bg-secondary border-accent text-foreground shadow-sm"
                  : "border-border/60 text-muted-foreground hover:bg-secondary/40 hover:text-foreground"
              }`}
            >
              <div className="text-xs font-semibold mb-1">{d.label}</div>
              <div className="text-[10px] opacity-80 leading-normal">{d.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Feature Teasers / Coming Soon */}
      <div className="space-y-4 border-t border-border/20 pt-6">
        <span className="font-sans text-[10px] tracking-[0.2em] text-accent/80 font-bold uppercase block select-none">
          Upcoming Cognitive Enhancements
        </span>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Voice Mode */}
          <div className="p-4 rounded-xl border border-border/30 bg-secondary/5 opacity-60 flex flex-col gap-2 relative">
            <span className="absolute top-3 right-3 bg-accent/10 border border-accent/20 text-accent text-[8px] font-bold tracking-widest px-2 py-0.5 rounded-full uppercase">
              Coming Soon
            </span>
            <span className="font-sans text-xs font-semibold text-foreground mt-2">
              Voice Mode
            </span>
            <p className="font-sans text-[10px] text-muted-foreground leading-normal">
              Talk to Zenkai in real-time with sub-100ms conversational response latency.
            </p>
          </div>

          {/* Memory Recall Style */}
          <div className="p-4 rounded-xl border border-border/30 bg-secondary/5 opacity-60 flex flex-col gap-2 relative">
            <span className="absolute top-3 right-3 bg-accent/10 border border-accent/20 text-accent text-[8px] font-bold tracking-widest px-2 py-0.5 rounded-full uppercase">
              Coming Soon
            </span>
            <span className="font-sans text-xs font-semibold text-foreground mt-2">
              Memory Recall
            </span>
            <p className="font-sans text-[10px] text-muted-foreground leading-normal">
              Adjust how companion searches your historical thoughts, dreams, and tasks.
            </p>
          </div>

          {/* Reasoning Level */}
          <div className="p-4 rounded-xl border border-border/30 bg-secondary/5 opacity-60 flex flex-col gap-2 relative">
            <span className="absolute top-3 right-3 bg-accent/10 border border-accent/20 text-accent text-[8px] font-bold tracking-widest px-2 py-0.5 rounded-full uppercase">
              Coming Soon
            </span>
            <span className="font-sans text-xs font-semibold text-foreground mt-2">
              Reasoning Level
            </span>
            <p className="font-sans text-[10px] text-muted-foreground leading-normal">
              Configure deep reasoning thinking tokens for complex architectural challenges.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
