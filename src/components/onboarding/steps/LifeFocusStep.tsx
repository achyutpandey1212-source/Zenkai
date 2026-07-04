"use client";

import React from "react";
import { FOCUS_AREA_OPTIONS } from "@/config/onboarding-options";
import OptionCard from "../components/OptionCard";
import StepLayout from "../layouts/StepLayout";

interface LifeFocusStepProps {
  selectedAreas: string[];
  onChange: (newValue: string[]) => void;
  onNext: () => void;
  onBack: () => void;
}

export default function LifeFocusStep({
  selectedAreas,
  onChange,
  onNext,
  onBack,
}: LifeFocusStepProps) {
  const handleToggle = (label: string) => {
    if (selectedAreas.includes(label)) {
      onChange(selectedAreas.filter((x) => x !== label));
    } else {
      onChange([...selectedAreas, label]);
    }
  };

  return (
    <StepLayout
      title="What are you trying to build?"
      subtitle="Select the primary areas of your life where you want to execute."
      onNext={onNext}
      onBack={onBack}
      nextDisabled={selectedAreas.length === 0}
    >
      <div className="space-y-4 max-h-[350px] overflow-y-auto pr-1 scrollbar-none">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {FOCUS_AREA_OPTIONS.map((opt) => {
            const isSelected = selectedAreas.includes(opt.label);
            return (
              <OptionCard
                key={opt.id}
                title={opt.label}
                selected={isSelected}
                onClick={() => handleToggle(opt.label)}
              />
            );
          })}
        </div>
      </div>
    </StepLayout>
  );
}
