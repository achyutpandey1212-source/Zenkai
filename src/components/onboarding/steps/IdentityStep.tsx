"use client";

import React from "react";
import IdentityForm, { IdentityFormValues } from "../../profile/IdentityForm";
import StepLayout from "../layouts/StepLayout";

interface IdentityStepProps {
  value: IdentityFormValues;
  onChange: (newValue: IdentityFormValues) => void;
  onNext: () => void;
  onBack: () => void;
}

export default function IdentityStep({ value, onChange, onNext, onBack }: IdentityStepProps) {
  const isNextDisabled = !value.primaryIdentity;

  return (
    <StepLayout
      title="What best describes your current life?"
      subtitle="Help Zen understand your daily context."
      onNext={onNext}
      onBack={onBack}
      nextDisabled={isNextDisabled}
    >
      <IdentityForm value={value} onChange={onChange} disableInlineSwitch={true} />
    </StepLayout>
  );
}
