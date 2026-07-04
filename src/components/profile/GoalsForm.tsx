"use client";

import React, { useState } from "react";
import { GOAL_PRESETS } from "@/config/onboarding-options";
import OptionCard from "../onboarding/components/OptionCard";
import { Plus, Trash2 } from "lucide-react";

export interface GoalItem {
  title: string;
  priority: number;
}

interface GoalsFormProps {
  value: GoalItem[];
  onChange: (newValue: GoalItem[]) => void;
}

export default function GoalsForm({ value, onChange }: GoalsFormProps) {
  const [customGoalText, setCustomGoalText] = useState("");
  const [showCustomInput, setShowCustomInput] = useState(false);

  const handleTogglePreset = (label: string) => {
    const exists = value.find((g) => g.title === label);
    if (exists) {
      // Remove
      const filtered = value.filter((g) => g.title !== label);
      // Re-index priority
      onChange(filtered.map((g, idx) => ({ ...g, priority: idx + 1 })));
    } else {
      // Add
      onChange([...value, { title: label, priority: value.length + 1 }]);
    }
  };

  const handleAddCustomGoal = () => {
    if (!customGoalText.trim()) return;
    const exists = value.find((g) => g.title.toLowerCase() === customGoalText.trim().toLowerCase());
    if (!exists) {
      onChange([...value, { title: customGoalText.trim(), priority: value.length + 1 }]);
    }
    setCustomGoalText("");
    setShowCustomInput(false);
  };

  const handleRemoveGoal = (title: string) => {
    const filtered = value.filter((g) => g.title !== title);
    onChange(filtered.map((g, idx) => ({ ...g, priority: idx + 1 })));
  };

  return (
    <div className="space-y-6 w-full max-w-xl mx-auto text-left animate-in fade-in duration-300">
      
      {/* List of currently selected goals */}
      {value.length > 0 && (
        <div className="space-y-2">
          <label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground block">
            Selected Goals ({value.length})
          </label>
          <div className="flex flex-col gap-2 max-h-40 overflow-y-auto pr-1 scrollbar-custom">
            {value.map((goal, idx) => (
              <div
                key={idx}
                className="flex justify-between items-center bg-secondary/30 border border-border/40 px-3.5 py-2.5 rounded-xl text-xs"
              >
                <div className="flex items-center gap-2.5">
                  <span className="h-5 w-5 bg-accent/20 border border-accent/30 rounded-full flex items-center justify-center text-accent text-[10px] font-bold">
                    {idx + 1}
                  </span>
                  <span className="font-semibold text-foreground">{goal.title}</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveGoal(goal.title)}
                  className="text-muted-foreground hover:text-destructive p-1 transition-colors cursor-pointer"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Grid of Preset Goals */}
      <div className="space-y-3">
        <label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground block">
          Preset Ambitions
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {GOAL_PRESETS.map((preset) => {
            const isSelected = value.some((g) => g.title === preset.label);
            return (
              <OptionCard
                key={preset.id}
                title={preset.label}
                icon={preset.icon}
                selected={isSelected}
                onClick={() => handleTogglePreset(preset.label)}
              />
            );
          })}

          {/* Custom Goal Card trigger / input inline */}
          {!showCustomInput ? (
            <button
              type="button"
              onClick={() => setShowCustomInput(true)}
              className="w-full text-left p-5 rounded-2xl border border-dashed border-border hover:border-accent hover:bg-secondary/20 transition-all duration-300 outline-none flex items-center gap-4 cursor-pointer select-none text-muted-foreground hover:text-foreground"
            >
              <span className="text-xl shrink-0 flex items-center justify-center h-10 w-10 bg-secondary/30 rounded-xl">
                <Plus size={16} />
              </span>
              <div>
                <h4 className="font-sans text-sm font-semibold tracking-wide">
                  Custom Goal
                </h4>
                <p className="font-sans text-[10px] text-muted-foreground/80 mt-0.5">
                  Type your own unique goal
                </p>
              </div>
            </button>
          ) : (
            <div className="w-full p-4 rounded-2xl border border-accent bg-accent/5 flex flex-col gap-2.5 animate-in fade-in duration-200">
              <input
                type="text"
                autoFocus
                placeholder="What is your goal?"
                value={customGoalText}
                onChange={(e) => setCustomGoalText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddCustomGoal()}
                className="w-full bg-card border border-border rounded-xl px-3 py-2 text-xs outline-none focus:border-accent font-sans"
              />
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setShowCustomInput(false)}
                  className="py-1.5 px-3 text-[10px] font-semibold text-muted-foreground hover:text-foreground rounded-lg hover:bg-secondary/40 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAddCustomGoal}
                  disabled={!customGoalText.trim()}
                  className="py-1.5 px-3 text-[10px] font-semibold bg-primary text-primary-foreground hover:bg-accent hover:text-accent-foreground disabled:bg-secondary disabled:text-muted-foreground rounded-lg transition-all cursor-pointer"
                >
                  Add
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
