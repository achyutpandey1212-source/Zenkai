"use client";

import React from "react";
import { Sparkles, Calendar, Clock, Compass, Activity, Brain, User, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { IProfile } from "@/models/Profile";

interface OverviewTabProps {
  profile: IProfile | null;
  latestTrait?: { trait: string; reason: string } | null;
  latestReflection?: { title: string; summary: string } | null;
  onSwitchTab: (tab: any) => void;
}

export default function OverviewTab({
  profile,
  latestTrait,
  latestReflection,
  onSwitchTab,
}: OverviewTabProps) {
  
  // Real-time calculation of profile completeness
  const calculateCompletion = () => {
    let score = 0;
    const checklist: { label: string; action: string; val: number; done: boolean; tab: string }[] = [];

    // 1. Identity
    const hasIdentity = !!profile?.primaryIdentity;
    if (hasIdentity) score += 20;
    checklist.push({
      label: "Specify your primary life identity",
      action: "+20% Identity Details",
      val: 20,
      done: hasIdentity,
      tab: "profile",
    });

    // 2. Focus Areas
    const hasFocus = !!profile?.focusAreas && profile.focusAreas.length > 0;
    if (hasFocus) score += 20;
    checklist.push({
      label: "Select your main focus areas",
      action: "+20% Focus Areas",
      val: 20,
      done: hasFocus,
      tab: "profile",
    });

    // 3. Routine Timings
    const hasRoutine = !!profile?.wakeUpTime && !!profile?.sleepTime;
    if (hasRoutine) score += 20;
    checklist.push({
      label: "Configure sleep and wake boundaries",
      action: "+20% Routine Schedule",
      val: 20,
      done: hasRoutine,
      tab: "profile",
    });

    // 4. Goals
    const hasGoals = !!profile?.goals && profile.goals.length > 0;
    if (hasGoals) score += 20;
    checklist.push({
      label: "Set your target milestones & goals",
      action: "+20% Goals Mapping",
      val: 20,
      done: hasGoals,
      tab: "profile",
    });

    // 5. Challenges
    const hasChallenges = !!profile?.productivityChallenges && profile.productivityChallenges.length > 0;
    if (hasChallenges) score += 20;
    checklist.push({
      label: "Add your productivity distractions",
      action: "+20% Challenges Log",
      val: 20,
      done: hasChallenges,
      tab: "profile",
    });

    return { score, checklist };
  };

  const { score, checklist } = calculateCompletion();

  // Helper format time
  const formatTime = (timeStr?: string) => {
    if (!timeStr) return "Not set";
    const [hours, minutes] = timeStr.split(":");
    const h = parseInt(hours, 10);
    const ampm = h >= 12 ? "PM" : "AM";
    const displayHour = h % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300 w-full">
      {/* Overview Grid Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Left Column - Completeness and Dynamic Checklist */}
        <div className="md:col-span-2 space-y-6">
          
          {/* Profile Completion Card */}
          <div className="bg-card border border-border/75 rounded-3xl p-6 relative overflow-hidden shadow-sm">
            <div className="absolute -right-24 -top-24 w-48 h-48 rounded-full bg-accent/5 blur-3xl pointer-events-none" />
            
            <div className="flex justify-between items-start mb-4">
              <div className="space-y-1">
                <h4 className="font-heading text-xl font-light text-foreground">
                  Your Digital Twin completeness
                </h4>
                <p className="font-sans text-[11px] text-muted-foreground">
                  Complete your profile to align Zenkai's cognitive scheduling.
                </p>
              </div>
              <span className="font-heading text-4xl font-light text-accent tracking-tighter">
                {score}%
              </span>
            </div>

            {/* Progress bar */}
            <div className="w-full h-2 bg-secondary rounded-full overflow-hidden mb-6">
              <div
                className="h-full bg-accent transition-all duration-700 ease-out"
                style={{ width: `${score}%` }}
              />
            </div>

            {/* Suggestions Checklist */}
            {score < 100 && (
              <div className="space-y-3 pt-2">
                <span className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground block">
                  Recommended improvements
                </span>
                <div className="flex flex-col gap-2.5">
                  {checklist
                    .filter((c) => !c.done)
                    .map((item, idx) => (
                      <button
                        key={idx}
                        onClick={() => onSwitchTab(item.tab)}
                        className="flex justify-between items-center text-xs bg-secondary/20 hover:bg-secondary/40 border border-border/40 hover:border-border px-4 py-3 rounded-2xl transition-all cursor-pointer text-left w-full"
                      >
                        <span className="text-foreground font-medium flex items-center gap-2">
                          <span className="h-1.5 w-1.5 bg-accent rounded-full shrink-0" />
                          {item.label}
                        </span>
                        <span className="text-[10px] font-bold text-accent shrink-0">
                          {item.action}
                        </span>
                      </button>
                    ))}
                </div>
              </div>
            )}
            
            {score === 100 && (
              <div className="text-xs text-accent bg-accent/15 border border-accent/20 p-4 rounded-2xl flex items-center gap-3">
                <Sparkles size={16} className="text-accent shrink-0" />
                <span className="font-semibold">Your Digital Twin profile is fully initialized! Zenkai holds perfect synchronization.</span>
              </div>
            )}
          </div>

          {/* Flexible Dashboard Card Section: Goals, Focus & Routine */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            
            {/* Routine summary card */}
            <div className="bg-card border border-border/75 rounded-3xl p-6 space-y-4">
              <div className="flex items-center gap-2 text-accent">
                <Clock size={16} />
                <span className="text-[10px] uppercase font-bold tracking-widest">
                  Daily Rhythm
                </span>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-baseline border-b border-border/40 pb-2">
                  <span className="text-xs text-muted-foreground">Sleep Schedule</span>
                  <span className="text-xs font-semibold text-foreground">
                    {profile?.sleepTime ? `${formatTime(profile.sleepTime)} - ${formatTime(profile.wakeUpTime)}` : "Not set"}
                  </span>
                </div>
                <div className="flex justify-between items-baseline border-b border-border/40 pb-2">
                  <span className="text-xs text-muted-foreground">Peak Energy Window</span>
                  <span className="text-xs font-semibold text-foreground">
                    {profile?.deepWorkTime || "Morning"}
                  </span>
                </div>
                <div className="flex justify-between items-baseline">
                  <span className="text-xs text-muted-foreground">Focus Target</span>
                  <span className="text-xs font-semibold text-foreground">
                    {profile?.focusDuration || 45} mins / block
                  </span>
                </div>
              </div>
            </div>

            {/* Current Focus Areas card */}
            <div className="bg-card border border-border/75 rounded-3xl p-6 space-y-4">
              <div className="flex items-center gap-2 text-accent">
                <Compass size={16} />
                <span className="text-[10px] uppercase font-bold tracking-widest">
                  Active Focus Areas
                </span>
              </div>
              {profile?.focusAreas && profile.focusAreas.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {profile.focusAreas.map((area, idx) => (
                    <span
                      key={idx}
                      className="px-2.5 py-1 rounded-full bg-secondary/50 text-[10px] font-semibold border border-border/40 text-foreground"
                    >
                      {area}
                    </span>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-muted-foreground/60 py-2">
                  No active focus areas configured yet.
                </div>
              )}
            </div>

          </div>

          {/* Current Goals List Card */}
          <div className="bg-card border border-border/75 rounded-3xl p-6 space-y-4">
            <div className="flex items-center gap-2 text-accent">
              <Activity size={16} />
              <span className="text-[10px] uppercase font-bold tracking-widest">
                Target Goals
              </span>
            </div>
            {profile?.goals && profile.goals.length > 0 ? (
              <div className="space-y-2">
                {profile.goals.map((goal, idx) => (
                  <div
                    key={idx}
                    className="flex justify-between items-center bg-secondary/10 px-4 py-2.5 border border-border/40 rounded-2xl text-xs"
                  >
                    <span className="font-semibold text-foreground">{goal.title}</span>
                    <span className="text-[10px] font-bold text-accent uppercase tracking-wider">
                      Priority {goal.priority}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-muted-foreground/60 py-4 text-center">
                No goals added. Update your profile tab to map objectives.
              </div>
            )}
          </div>

        </div>

        {/* Right Column - Latest Identity & Insights Evolution Previews */}
        <div className="space-y-6 col-span-1">
          
          {/* Identity Insight Preview Card */}
          <div className="bg-card border border-border/75 rounded-3xl p-6 space-y-4">
            <div className="flex items-center gap-2 text-accent">
              <Brain size={16} />
              <span className="text-[10px] uppercase font-bold tracking-widest">
                Identity Profile
              </span>
            </div>
            
            {latestTrait ? (
              <div className="space-y-3">
                <div className="bg-accent/10 border border-accent/20 p-4 rounded-2xl">
                  <h5 className="font-heading font-light text-foreground text-base mb-1">
                    {latestTrait.trait}
                  </h5>
                  <p className="font-sans text-[11px] text-muted-foreground leading-relaxed">
                    {latestTrait.reason}
                  </p>
                </div>
                <button
                  onClick={() => onSwitchTab("identity")}
                  className="w-full text-center py-2 bg-secondary/30 hover:bg-secondary/50 border border-border/60 rounded-xl text-[10px] font-semibold uppercase tracking-wider text-foreground cursor-pointer transition-all"
                >
                  View Full Traits
                </button>
              </div>
            ) : (
              <div className="text-xs text-muted-foreground/60 py-4">
                Identity model is gathering task logs to map active character traits.
              </div>
            )}
          </div>

          {/* Reflections Summary Card */}
          <div className="bg-card border border-border/75 rounded-3xl p-6 space-y-4">
            <div className="flex items-center gap-2 text-accent">
              <Activity size={16} />
              <span className="text-[10px] uppercase font-bold tracking-widest">
                Latest Reflection
              </span>
            </div>

            {latestReflection ? (
              <div className="space-y-3">
                <div className="border border-border/60 p-4 rounded-2xl space-y-1">
                  <h5 className="font-semibold text-foreground text-xs">
                    {latestReflection.title}
                  </h5>
                  <p className="font-sans text-[11px] text-muted-foreground leading-relaxed line-clamp-3">
                    {latestReflection.summary}
                  </p>
                </div>
                <button
                  onClick={() => onSwitchTab("reflection")}
                  className="w-full text-center py-2 bg-secondary/30 hover:bg-secondary/50 border border-border/60 rounded-xl text-[10px] font-semibold uppercase tracking-wider text-foreground cursor-pointer transition-all"
                >
                  View Insights List
                </button>
              </div>
            ) : (
              <div className="text-xs text-muted-foreground/60 py-4">
                Complete daily/weekly reviews to compile performance reflection summaries.
              </div>
            )}
          </div>

          {/* Quick Stats Summary */}
          <div className="bg-card border border-border/75 rounded-3xl p-6 space-y-3">
            <div className="flex items-center gap-2 text-accent">
              <User size={16} />
              <span className="text-[10px] uppercase font-bold tracking-widest">
                Active Context
              </span>
            </div>
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Role</span>
                <span className="font-semibold text-foreground capitalize">
                  {profile?.primaryIdentity || "Not set"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Opt Style</span>
                <span className="font-semibold text-foreground">
                  {profile?.schedulingStyle || "Balanced"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Country</span>
                <span className="font-semibold text-foreground">
                  {profile?.country || "Not set"}
                </span>
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
