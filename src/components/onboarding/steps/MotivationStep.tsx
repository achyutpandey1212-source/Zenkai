"use client";

import React, { useState } from "react";
import { MOTIVATION_OPTIONS } from "@/config/onboarding-options";
import OptionCard from "../components/OptionCard";
import StepLayout from "../layouts/StepLayout";

interface MotivationStepProps {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  customValue: string;
  onCustomValueChange: (val: string) => void;
  onNext: () => void;
  onBack: () => void;
}

export default function MotivationStep({
  selectedIds,
  onChange,
  customValue,
  onCustomValueChange,
  onNext,
  onBack,
}: MotivationStepProps) {
  const [showOtherInput, setShowOtherInput] = useState(selectedIds.includes("other"));

  const handleToggle = (id: string) => {
    let nextIds = [...selectedIds];
    if (selectedIds.includes(id)) {
      nextIds = selectedIds.filter((x) => x !== id);
      if (id === "other") {
        setShowOtherInput(false);
        onCustomValueChange("");
      }
    } else {
      nextIds.push(id);
      if (id === "other") {
        setShowOtherInput(true);
      }
    }
    onChange(nextIds);
  };

  const isNextDisabled = selectedIds.length === 0 || (selectedIds.includes("other") && !customValue.trim());

  return (
    <StepLayout
      title="Why did you install Zen?"
      subtitle="Help us understand the emotional driver behind your coaching needs."
      onNext={onNext}
      onBack={onBack}
      nextDisabled={isNextDisabled}
    >
      <div className="space-y-4 max-h-[360px] overflow-y-auto pr-1 scrollbar-none">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {MOTIVATION_OPTIONS.map((opt) => {
            const isSelected = selectedIds.includes(opt.id);
            return (
              <OptionCard
                key={opt.id}
                title={opt.label}
                selected={isSelected}
                onClick={() => handleToggle(opt.id)}
              />
            );
          })}
        </div>

        {showOtherInput && (
          <div className="pt-2 animate-in fade-in duration-200">
            <label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground block mb-2">
              Tell us more (Optional)
            </label>
            <input
              type="text"
              autoFocus
              placeholder="e.g. I want to build a writing habit or track code quality"
              value={customValue}
              onChange={(e) => onCustomValueChange(e.target.value)}
              className="w-full bg-card border border-border rounded-xl px-4 py-2.5 text-xs outline-none focus:border-accent font-sans"
            />
          </div>
        )}
      </div>
    </StepLayout>
  );
}
