"use client";

import React from "react";
import { cn } from "@/lib/utils";

export interface FocusFormValues {
  schedulingStyle: "Strict" | "Flexible" | "Balanced";
  focusDuration: number;
}

interface FocusFormProps {
  value: FocusFormValues;
  onChange: (newValue: FocusFormValues) => void;
}

export default function FocusForm({ value, onChange }: FocusFormProps) {
  const updateField = <K extends keyof FocusFormValues>(field: K, val: FocusFormValues[K]) => {
    onChange({ ...value, [field]: val });
  };

  return (
    <div className="space-y-6 w-full max-w-md mx-auto text-left animate-in fade-in duration-300">
      
      {/* Scheduling Style */}
      <div className="space-y-3">
        <label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground block">
          Scheduling Style
        </label>
        <div className="grid grid-cols-3 gap-2.5">
          {[
            { key: "Strict" as const, label: "Strict", desc: "Rigid blocks" },
            { key: "Flexible" as const, label: "Flexible", desc: "Adaptable slots" },
            { key: "Balanced" as const, label: "Balanced", desc: "Structured breathing" }
          ].map((style) => {
            const isSelected = value.schedulingStyle === style.key;
            return (
              <button
                key={style.key}
                type="button"
                onClick={() => updateField("schedulingStyle", style.key)}
                className={cn(
                  "flex flex-col items-center justify-center p-4 rounded-2xl border text-center cursor-pointer transition-all duration-200 outline-none select-none hover:scale-[1.01] active:scale-[0.99]",
                  isSelected
                    ? "bg-primary border-primary text-primary-foreground shadow-md"
                    : "bg-card border-border/70 hover:bg-secondary/40 text-muted-foreground hover:text-foreground"
                )}
              >
                <span className="text-xs font-bold font-sans">{style.label}</span>
                <span className={cn("text-[9px] opacity-75 mt-1 font-sans", isSelected ? "text-primary-foreground" : "text-muted-foreground")}>{style.desc}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Focus Duration */}
      <div className="space-y-3">
        <label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground block">
          Preferred Focus Duration
        </label>
        <div className="grid grid-cols-4 gap-2.5">
          {[25, 45, 60, 90].map((dur) => {
            const isSelected = value.focusDuration === dur;
            return (
              <button
                key={dur}
                type="button"
                onClick={() => updateField("focusDuration", dur)}
                className={cn(
                  "py-3.5 rounded-xl border text-center text-xs font-semibold cursor-pointer transition-colors outline-none select-none",
                  isSelected
                    ? "bg-primary border-primary text-primary-foreground shadow-sm"
                    : "bg-card border-border/70 hover:bg-secondary/40 text-muted-foreground hover:text-foreground"
                )}
              >
                {dur}m
              </button>
            );
          })}
        </div>
      </div>

    </div>
  );
}
