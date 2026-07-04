"use client";

import React from "react";
import { IDENTITY_OPTIONS } from "@/config/onboarding-options";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { GoalItem } from "../../profile/GoalsForm";
import { ICommitment } from "@/models/Profile";

interface SummaryStepProps {
  primaryIdentity: string;
  branchContext: Record<string, string>;
  focusAreas: string[];
  deepWorkTime: string;
  wakeTime: string;
  sleepTime: string;
  productivityChallenges: string[];
  goals: GoalItem[];
  commitments: ICommitment[];
  onNext: () => void;
  onBack: () => void;
}

export default function SummaryStep({
  primaryIdentity,
  branchContext,
  focusAreas,
  deepWorkTime,
  wakeTime,
  sleepTime,
  productivityChallenges,
  goals,
  commitments,
  onNext,
  onBack,
}: SummaryStepProps) {
  
  const identityObj = IDENTITY_OPTIONS.find((opt) => opt.id === primaryIdentity);
  const identityLabel = identityObj ? identityObj.label : "Student/Professional";

  const getBranchDetail = () => {
    const ctx = branchContext || {};
    if (primaryIdentity === "college") {
      return `${ctx.degree || ""} (${ctx.hostellerStatus || "Day Scholar"})`;
    }
    if (primaryIdentity === "school") {
      return `Class ${ctx.class || ""} - ${ctx.board || ""}`;
    }
    if (primaryIdentity === "professional") {
      return `${ctx.industry || ""} (${ctx.workMode || ""})`;
    }
    if (primaryIdentity === "founder") {
      return `${ctx.industry || ""} Startup (${ctx.startupStage || ""})`;
    }
    return "";
  };

  const branchDetail = getBranchDetail();
  const goalsText = goals.map((g) => g.title).join(" + ");
  const challengesText = productivityChallenges.join(", ") || "No major challenges";
  const commitmentsText = commitments.map((c) => c.name).join(", ") || "None scheduled";

  // Helper function to format time (e.g. "06:00" -> "6:00 AM")
  const formatTime = (timeStr: string) => {
    if (!timeStr) return "";
    const [hours, minutes] = timeStr.split(":");
    const h = parseInt(hours, 10);
    const ampm = h >= 12 ? "PM" : "AM";
    const displayHour = h % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const summaryItems = [
    { label: identityLabel, detail: branchDetail },
    { label: "Building", detail: goalsText },
    { label: "Peak focus", detail: `${deepWorkTime} energy` },
    { label: "Sleep boundaries", detail: `Sleeps at ${formatTime(sleepTime)} • Wakes at ${formatTime(wakeTime)}` },
    { label: "Challenges", detail: challengesText },
    { label: "Commitments", detail: commitmentsText },
  ];

  return (
    <div className="w-full max-w-xl mx-auto flex flex-col justify-between h-full min-h-[420px] text-left animate-in fade-in duration-500">
      
      <div className="space-y-6 flex-1 flex flex-col justify-center">
        <div className="space-y-2 text-center pb-2">
          <h2 className="font-heading text-4xl font-light tracking-wide text-foreground">
            Here's what Zen understood.
          </h2>
          <p className="font-sans text-xs text-muted-foreground">
            We will now build a personalized roadmap and weekly schedule around this.
          </p>
        </div>

        <div className="bg-card border border-border/80 rounded-3xl p-6 md:p-8 space-y-5 relative overflow-hidden shadow-sm hover:shadow-md transition-all duration-300">
          <div className="absolute -right-20 -top-20 w-44 h-44 rounded-full bg-accent/5 blur-3xl pointer-events-none" />
          
          <div className="space-y-3.5 font-sans text-xs md:text-sm">
            {summaryItems.map((item, idx) => {
              if (!item.detail) return null;
              return (
                <div key={idx} className="flex gap-3 items-start">
                  <span className="text-accent flex items-center justify-center h-4 w-4 rounded-full bg-accent/15 border border-accent/30 mt-0.5 select-none text-[9px] font-bold">
                    ✓
                  </span>
                  <div>
                    <span className="text-muted-foreground font-medium mr-1.5">{item.label}:</span>
                    <span className="text-foreground font-semibold font-sans">{item.detail}</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="border-t border-border/40 pt-4 text-[10px] text-muted-foreground/80 leading-relaxed">
            Zen will automatically configure your coaching modules, planning agents, and memory logs based on these parameters.
          </div>
        </div>
      </div>

      {/* Navigation bottom buttons */}
      <div className="w-full flex items-center justify-between mt-8 pt-4 border-t border-border/20">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors cursor-pointer select-none py-2 px-3 rounded-lg hover:bg-secondary/20"
        >
          <ArrowLeft size={14} />
          <span>Back</span>
        </button>

        <button
          type="button"
          onClick={onNext}
          className="flex items-center gap-2.5 py-3.5 px-8 rounded-full text-xs font-semibold uppercase tracking-wider bg-primary text-primary-foreground hover:bg-accent hover:text-accent-foreground transition-all duration-300 shadow-sm cursor-pointer select-none"
        >
          <span>Create My Workspace</span>
          <ArrowRight size={14} />
        </button>
      </div>

    </div>
  );
}
