"use client";

import React from "react";
import CommitmentsForm from "../../profile/CommitmentsForm";
import StepLayout from "../layouts/StepLayout";
import { ICommitment } from "@/models/Profile";

interface CommitmentsStepProps {
  value: ICommitment[];
  onChange: (newValue: ICommitment[]) => void;
  onNext: () => void;
  onBack: () => void;
}

export default function CommitmentsStep({ value, onChange, onNext, onBack }: CommitmentsStepProps) {
  return (
    <StepLayout
      title="Any fixed weekly commitments?"
      subtitle="Office hours, gym slots, college classes, or recurring meetings. Zenkai schedules daily tasks around these."
      onNext={onNext}
      onBack={onBack}
      nextLabel={value.length === 0 ? "Skip for now" : "Continue"}
    >
      <div className="max-h-[350px] overflow-y-auto pr-1 scrollbar-none">
        <CommitmentsForm value={value} onChange={onChange} />
      </div>
    </StepLayout>
  );
}
