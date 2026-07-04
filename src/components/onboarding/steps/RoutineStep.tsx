"use client";

import React from "react";
import RoutineForm, { RoutineFormValues } from "../../profile/RoutineForm";
import StepLayout from "../layouts/StepLayout";

interface RoutineStepProps {
  value: RoutineFormValues;
  onChange: (newValue: RoutineFormValues) => void;
  onNext: () => void;
  onBack: () => void;
}

export default function RoutineStep({ value, onChange, onNext, onBack }: RoutineStepProps) {
  const isNextDisabled = !value.wakeTime || !value.sleepTime || !value.deepWorkTime || !value.dailyAvailability;

  return (
    <StepLayout
      title="What does your day usually look like?"
      subtitle="Zenkai matches your productivity slots to your daily energy levels."
      onNext={onNext}
      onBack={onBack}
      nextDisabled={isNextDisabled}
    >
      <RoutineForm value={value} onChange={onChange} />
    </StepLayout>
  );
}
