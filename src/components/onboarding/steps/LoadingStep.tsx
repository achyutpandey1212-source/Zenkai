"use client";

import React from "react";
import Image from "next/image";
import { Sparkles, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface LoadingStepProps {
  currentStage: string;
  backendComplete: boolean;
  backendError: string | null;
  onComplete: () => void;
  onRetry: () => void;
  onBypass: () => void;
}

const CHECKLIST_STEPS = [
  { key: "profile", label: "Creating profile", triggerStages: ["learning"] },
  { key: "goals", label: "Understanding your goals", triggerStages: ["roadmap"] },
  { key: "model", label: "Building life model", triggerStages: ["weekly_schedule"] },
  { key: "roadmap", label: "Generating roadmap", triggerStages: ["agenda"] },
  { key: "schedule", label: "Creating weekly schedule", triggerStages: ["workspace"] },
  { key: "workspace", label: "Preparing workspace", triggerStages: ["calendar", "complete"] },
];

export default function LoadingStep({
  currentStage,
  backendComplete,
  backendError,
  onComplete,
  onRetry,
  onBypass,
}: LoadingStepProps) {
  // Determine if a step is complete or active based on the current backend stage
  const getStepState = (idx: number) => {
    // If backend completed successfully, check everything off
    if (backendComplete) return "completed";

    // Map stages to ordering
    const stageOrder = ["learning", "roadmap", "weekly_schedule", "agenda", "workspace", "calendar", "complete"];
    const currentOrderIdx = stageOrder.indexOf(currentStage);

    const step = CHECKLIST_STEPS[idx];
    const firstTriggerStage = step.triggerStages[0];
    const triggerOrderIdx = stageOrder.indexOf(firstTriggerStage);

    if (currentOrderIdx > triggerOrderIdx) {
      return "completed";
    } else if (currentOrderIdx === triggerOrderIdx) {
      return "active";
    } else {
      return "pending";
    }
  };

  return (
    <div className="space-y-8 w-full max-w-md mx-auto flex flex-col items-center py-8 text-center animate-in fade-in duration-500">
      
      {/* Visual Companion Orb Glow */}
      <div className="relative w-36 h-36">
        <div className="absolute -inset-10 rounded-full bg-accent/20 blur-3xl opacity-80 animate-pulse" />
        <Image
          src="/assets/orbs/companion_orb.png"
          alt="Companion Orb"
          fill
          priority
          className={cn(
            "object-contain drop-shadow-[0_12px_32px_rgba(201,168,106,0.25)] animate-float",
            backendComplete && "scale-105 transition-all duration-700"
          )}
        />
      </div>

      <div className="w-full space-y-5 text-center">
        <span className="font-sans text-[10px] tracking-[0.25em] text-accent font-bold uppercase flex items-center justify-center gap-2 animate-pulse">
          <Sparkles size={13} className="text-accent" />
          Zen Awakening
        </span>
        
        <h3 className="font-heading text-2xl font-light text-foreground">
          {backendComplete ? "Workspace Ready" : "Synchronizing Workspace"}
        </h3>
        
        {/* Real-time Checklist */}
        <div className="w-full max-w-sm mx-auto text-left space-y-3 pt-4">
          {CHECKLIST_STEPS.map((step, idx) => {
            const state = getStepState(idx);
            const isCompleted = state === "completed";
            const isActive = state === "active";

            return (
              <div
                key={step.key}
                className={cn(
                  "flex items-center gap-3.5 text-xs transition-all duration-300",
                  isCompleted ? "opacity-100 text-foreground" : isActive ? "opacity-100 text-accent font-semibold animate-pulse" : "opacity-30 text-muted-foreground"
                )}
              >
                <div
                  className={cn(
                    "h-5 w-5 rounded-full flex items-center justify-center border text-[9px] transition-all duration-300",
                    isCompleted
                      ? "bg-accent/20 border-accent text-accent font-bold scale-100"
                      : isActive
                      ? "border-accent text-accent scale-100"
                      : "border-border text-muted-foreground scale-95"
                  )}
                >
                  {isCompleted ? "✓" : isActive ? "●" : ""}
                </div>
                <span>{step.label}</span>
              </div>
            );
          })}
        </div>

        {/* Success Action Button (Required instead of abrupt auto-redirect) */}
        {backendComplete && (
          <div className="pt-6 w-full max-w-sm mx-auto animate-in fade-in zoom-in-95 slide-in-from-bottom-3 duration-500">
            <button
              onClick={onComplete}
              className="w-full py-4 px-8 rounded-full text-xs font-semibold uppercase tracking-wider bg-primary text-primary-foreground hover:bg-accent hover:text-accent-foreground transition-all duration-300 shadow-md cursor-pointer flex items-center justify-center gap-2 select-none group"
            >
              <span>Take me to my Workspace</span>
              <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        )}

        {/* Error state */}
        {backendError && (
          <div className="w-full max-w-md mx-auto pt-4 space-y-4 animate-in slide-in-from-bottom-2 duration-300">
            <div className="text-xs text-destructive bg-destructive/10 border border-destructive/20 p-3 rounded-2xl text-left font-mono">
              Error setting up workspace: {backendError}
            </div>
            <div className="flex gap-3">
              <button
                onClick={onRetry}
                className="flex-1 py-2.5 px-4 bg-primary text-primary-foreground hover:bg-accent hover:text-accent-foreground text-xs font-semibold rounded-xl transition-all cursor-pointer font-sans"
              >
                Retry Setup
              </button>
              <button
                onClick={onBypass}
                className="flex-1 py-2.5 px-4 border border-border bg-card hover:bg-secondary/40 text-muted-foreground hover:text-foreground text-xs font-semibold rounded-xl transition-all cursor-pointer font-sans"
              >
                Bypass & Continue
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
