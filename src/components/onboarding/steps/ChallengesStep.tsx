"use client";

import React from "react";
import ChallengesForm from "../../profile/ChallengesForm";
import StepLayout from "../layouts/StepLayout";

interface ChallengesStepProps {
  value: string[];
  onChange: (newValue: string[]) => void;
  onNext: () => void;
  onBack: () => void;
}

export default function ChallengesStep({ value, onChange, onNext, onBack }: ChallengesStepProps) {
  return (
    <StepLayout
      title="What usually gets in your way?"
      subtitle="Help Zen identify distractions and obstacles so we can schedule around them."
      onNext={onNext}
      onBack={onBack}
    >
      <div className="max-h-[350px] overflow-y-auto pr-1 scrollbar-none">
        <ChallengesForm value={value} onChange={onChange} />
      </div>
    </StepLayout>
  );
}
