"use client";

import React from "react";
import { cn } from "@/lib/utils";

export interface RoutineFormValues {
  wakeTime: string; // HH:mm format e.g. "06:00"
  sleepTime: string; // HH:mm format e.g. "23:00"
  deepWorkTime: "Morning" | "Afternoon" | "Evening" | "Night";
  dailyAvailability: string; // "Less than 1 hour", "1-2 Hours", etc.
}

interface RoutineFormProps {
  value: RoutineFormValues;
  onChange: (newValue: RoutineFormValues) => void;
}

const WAKE_OPTIONS = [
  { label: "4:00 AM", value: "04:00", icon: "🌅" },
  { label: "5:00 AM", value: "05:00", icon: "🌅" },
  { label: "6:00 AM", value: "06:00", icon: "🌅" },
  { label: "7:00 AM", value: "07:00", icon: "☀️" },
  { label: "8:00 AM", value: "08:00", icon: "☀️" },
  { label: "9:00 AM", value: "09:00", icon: "☀️" },
  { label: "10:00 AM", value: "10:00", icon: "☀️" },
];

const SLEEP_OPTIONS = [
  { label: "9:00 PM", value: "21:00", icon: "🌙" },
  { label: "10:00 PM", value: "22:00", icon: "🌙" },
  { label: "11:00 PM", value: "23:00", icon: "🌙" },
  { label: "12:00 AM", value: "00:00", icon: "🌌" },
  { label: "1:00 AM", value: "01:00", icon: "🌌" },
  { label: "2:00 AM", value: "02:00", icon: "🌌" },
  { label: "3:00 AM", value: "03:00", icon: "🌌" },
];

const ENERGY_OPTIONS = [
  { id: "Morning" as const, label: "Morning 🌅", desc: "Best for early focus" },
  { id: "Afternoon" as const, label: "Afternoon ☀️", desc: "Steady midday routine" },
  { id: "Evening" as const, label: "Evening 🌆", desc: "Post-work momentum" },
  { id: "Night" as const, label: "Night 🌙", desc: "Quiet night-owl flow" },
];

const AVAILABILITY_OPTIONS = [
  { value: "Less than 1 hour", label: "⚡ < 1 Hour" },
  { value: "1-2 Hours", label: "🕒 1-2 Hours" },
  { value: "2-4 Hours", label: "🚀 2-4 Hours" },
  { value: "4-6 Hours", label: "💎 4-6 Hours" },
  { value: "6+ Hours", label: "🔥 6+ Hours" },
];

export default function RoutineForm({ value, onChange }: RoutineFormProps) {
  const updateField = <K extends keyof RoutineFormValues>(field: K, val: RoutineFormValues[K]) => {
    onChange({ ...value, [field]: val });
  };

  return (
    <div className="space-y-8 w-full max-w-md mx-auto text-left animate-in fade-in duration-300">
      
      {/* Wake Time Slider/Picker */}
      <div className="space-y-3">
        <label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground block">
          When do you wake up?
        </label>
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none snap-x mask-fade">
          {WAKE_OPTIONS.map((opt) => {
            const isSelected = value.wakeTime === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => updateField("wakeTime", opt.value)}
                className={cn(
                  "snap-center shrink-0 py-3 px-5 rounded-2xl border text-xs font-semibold tracking-wide transition-all cursor-pointer flex flex-col items-center gap-1 select-none min-w-[90px]",
                  isSelected
                    ? "bg-primary border-primary text-primary-foreground scale-105 shadow-md"
                    : "bg-card border-border/70 text-muted-foreground hover:bg-secondary/40"
                )}
              >
                <span className="text-lg">{opt.icon}</span>
                <span>{opt.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Sleep Time Slider/Picker */}
      <div className="space-y-3">
        <label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground block">
          When do you go to sleep?
        </label>
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none snap-x mask-fade">
          {SLEEP_OPTIONS.map((opt) => {
            const isSelected = value.sleepTime === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => updateField("sleepTime", opt.value)}
                className={cn(
                  "snap-center shrink-0 py-3 px-5 rounded-2xl border text-xs font-semibold tracking-wide transition-all cursor-pointer flex flex-col items-center gap-1 select-none min-w-[90px]",
                  isSelected
                    ? "bg-primary border-primary text-primary-foreground scale-105 shadow-md"
                    : "bg-card border-border/70 text-muted-foreground hover:bg-secondary/40"
                )}
              >
                <span className="text-lg">{opt.icon}</span>
                <span>{opt.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Peak Focus selector */}
      <div className="space-y-3">
        <label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground block">
          When is your Peak Energy?
        </label>
        <div className="grid grid-cols-2 gap-2.5">
          {ENERGY_OPTIONS.map((opt) => {
            const isSelected = value.deepWorkTime === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => updateField("deepWorkTime", opt.id)}
                className={cn(
                  "p-4 rounded-2xl border text-left transition-all duration-200 cursor-pointer outline-none select-none hover:scale-[1.01] active:scale-[0.99]",
                  isSelected
                    ? "border-accent bg-accent/5 shadow-[0_0_15px_rgba(201,168,106,0.1)]"
                    : "bg-card border-border/70 hover:bg-secondary/40"
                )}
              >
                <span className="text-sm font-bold text-foreground block">{opt.label}</span>
                <span className="text-[10px] text-muted-foreground mt-0.5 block leading-tight">{opt.desc}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Average Free Time */}
      <div className="space-y-3">
        <label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground block">
          Average Daily Free Time
        </label>
        <div className="flex flex-wrap gap-2">
          {AVAILABILITY_OPTIONS.map((opt) => {
            const isSelected = value.dailyAvailability === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => updateField("dailyAvailability", opt.value)}
                className={cn(
                  "py-2.5 px-4 rounded-full border text-xs font-semibold tracking-wide font-sans transition-all duration-200 cursor-pointer select-none",
                  isSelected
                    ? "bg-primary border-primary text-primary-foreground shadow-sm"
                    : "bg-card border-border/70 hover:bg-secondary/40 text-muted-foreground hover:text-foreground"
                )}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

    </div>
  );
}
