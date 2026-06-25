"use client";

import React, { useState } from "react";
import { Shield, Sparkles, User, Bell } from "lucide-react";

export default function Settings() {
  const [autonomy, setAutonomy] = useState<"minimal" | "balanced" | "proactive">("balanced");
  const [commStyle, setCommStyle] = useState<"quiet" | "direct" | "collaborative">("collaborative");
  const [morningBrief, setMorningBrief] = useState(true);
  const [nightReflection, setNightReflection] = useState(true);

  return (
    <div className="h-full w-full overflow-y-auto p-8 md:p-16 flex flex-col items-center bg-background">
      
      <div className="max-w-2xl w-full flex flex-col gap-12 mt-8">
        
        {/* Header Section */}
        <header className="flex flex-col gap-3">
          <span className="font-sans text-xs tracking-[0.25em] text-accent font-semibold uppercase">
            Control Panel
          </span>
          <h1 className="font-heading text-4xl md:text-5xl font-light text-foreground">
            Settings
          </h1>
          <p className="font-sans text-sm text-muted-foreground leading-relaxed">
            Customize Zenkai's behavior, communication style, and privacy boundaries.
          </p>
        </header>

        {/* Companion Settings */}
        <section className="space-y-6">
          <span className="font-sans text-[10px] tracking-[0.2em] text-accent/80 font-bold uppercase flex items-center gap-1.5">
            <Sparkles size={12} className="text-accent" />
            Companion Parameters
          </span>

          <div className="bg-card border border-border p-6 rounded-xl space-y-6">
            
            {/* Autonomy Level */}
            <div className="space-y-3">
              <label className="font-sans text-xs font-semibold text-foreground tracking-wide block">
                Autonomy Preference
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
                {(["minimal", "balanced", "proactive"] as const).map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setAutonomy(level)}
                    className={`py-3 px-4 rounded-lg font-sans text-xs font-medium border capitalize transition-all duration-200 ${
                      autonomy === level
                        ? "bg-primary border-primary text-primary-foreground shadow"
                        : "border-border/60 text-muted-foreground hover:bg-secondary hover:text-foreground"
                    }`}
                  >
                    {level}
                  </button>
                ))}
              </div>
              <p className="font-sans text-[10px] text-muted-foreground leading-relaxed">
                {autonomy === "minimal" && "Zenkai only acts on direct requests."}
                {autonomy === "balanced" && "Zenkai proactively suggests daily schedules and highlights potential clashes."}
                {autonomy === "proactive" && "Zenkai automatically reschedules conflicting items and checks in frequently."}
              </p>
            </div>

            {/* Communication Style */}
            <div className="space-y-3">
              <label className="font-sans text-xs font-semibold text-foreground tracking-wide block">
                Communication Style
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
                {(["quiet", "direct", "collaborative"] as const).map((style) => (
                  <button
                    key={style}
                    type="button"
                    onClick={() => setCommStyle(style)}
                    className={`py-3 px-4 rounded-lg font-sans text-xs font-medium border capitalize transition-all duration-200 ${
                      commStyle === style
                        ? "bg-primary border-primary text-primary-foreground shadow"
                        : "border-border/60 text-muted-foreground hover:bg-secondary hover:text-foreground"
                    }`}
                  >
                    {style}
                  </button>
                ))}
              </div>
            </div>

          </div>
        </section>

        {/* Notifications (Email-based) */}
        <section className="space-y-6">
          <span className="font-sans text-[10px] tracking-[0.2em] text-accent/80 font-bold uppercase flex items-center gap-1.5">
            <Bell size={12} className="text-accent" />
            Notifications & Digests
          </span>

          <div className="bg-card border border-border p-6 rounded-xl space-y-4">
            
            {/* Morning Brief */}
            <div className="flex items-center justify-between py-2 border-b border-border/40 last:border-0 last:pb-0">
              <div className="flex flex-col gap-0.5">
                <span className="font-sans text-xs font-semibold text-foreground tracking-wide">
                  Morning Briefing Email
                </span>
                <span className="font-sans text-[10px] text-muted-foreground">
                  Receive a daily focus roadmap at 7:00 AM.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setMorningBrief(prev => !prev)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out outline-none ${
                  morningBrief ? "bg-accent" : "bg-secondary"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-background shadow ring-0 transition duration-200 ease-in-out ${
                    morningBrief ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {/* Night Reflection */}
            <div className="flex items-center justify-between py-2">
              <div className="flex flex-col gap-0.5">
                <span className="font-sans text-xs font-semibold text-foreground tracking-wide">
                  Nightly Reflection Reminder
                </span>
                <span className="font-sans text-[10px] text-muted-foreground">
                  Receive a review email at 9:00 PM to log daily wins.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setNightReflection(prev => !prev)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out outline-none ${
                  nightReflection ? "bg-accent" : "bg-secondary"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-background shadow ring-0 transition duration-200 ease-in-out ${
                    nightReflection ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

          </div>
        </section>

        {/* Privacy & Account Controls */}
        <section className="space-y-6">
          <span className="font-sans text-[10px] tracking-[0.2em] text-accent/80 font-bold uppercase flex items-center gap-1.5">
            <Shield size={12} className="text-accent" />
            Privacy Boundaries
          </span>

          <div className="bg-card border border-border p-6 rounded-xl space-y-4">
            <div className="flex flex-col md:flex-row gap-3">
              <button
                type="button"
                className="flex-1 py-3 px-4 rounded-lg font-sans text-xs font-medium border border-border/80 hover:bg-secondary/40 text-muted-foreground hover:text-foreground transition-all duration-200"
              >
                Export My Data
              </button>
              <button
                type="button"
                className="flex-1 py-3 px-4 rounded-lg font-sans text-xs font-medium border border-red-500/20 dark:border-red-500/40 hover:bg-red-500/10 dark:hover:bg-red-500/20 text-red-600 dark:text-red-400 dark:shadow-[0_0_15px_rgba(239,68,68,0.25)] hover:text-red-700 transition-all duration-200"
              >
                Clear Reflections
              </button>
              <button
                type="button"
                className="flex-1 py-3 px-4 rounded-lg font-sans text-xs font-medium border border-red-500/20 dark:border-red-500/40 hover:bg-red-500/10 dark:hover:bg-red-500/20 text-red-600 dark:text-red-400 dark:shadow-[0_0_15px_rgba(239,68,68,0.25)] hover:text-red-700 transition-all duration-200"
              >
                Delete Memories
              </button>
            </div>
            <p className="font-sans text-[9px] text-muted-foreground text-center">
              Zenkai stores memory using local and mongoDB layers. Deleting memory cannot be undone.
            </p>
          </div>
        </section>

      </div>

    </div>
  );
}
