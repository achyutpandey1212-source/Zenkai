"use client";

import React from "react";
import GoalsForm, { GoalItem } from "../../profile/GoalsForm";
import StepLayout from "../layouts/StepLayout";

interface GoalsStepProps {
  value: GoalItem[];
  onChange: (newValue: GoalItem[]) => void;
  onNext: () => void;
  onBack: () => void;
}

export default function GoalsStep({ value, onChange, onNext, onBack }: GoalsStepProps) {
  const isNextDisabled = value.length === 0;

  return (
    <StepLayout
      title="What are you trying to achieve?"
      subtitle="Define your immediate objectives. You can prioritize or add your own custom goals."
      onNext={onNext}
      onBack={onBack}
      nextDisabled={isNextDisabled}
    >
      <div className="max-h-[360px] overflow-y-auto pr-1 scrollbar-none">
        <GoalsForm value={value} onChange={onChange} />
      </div>
    </StepLayout>
  );
}
