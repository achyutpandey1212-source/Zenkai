"use client";

import React from "react";
import IdentityForm, { IdentityFormValues } from "../../profile/IdentityForm";
import StepLayout from "../layouts/StepLayout";

interface IdentityDetailsStepProps {
  value: IdentityFormValues;
  onChange: (newValue: IdentityFormValues) => void;
  onNext: () => void;
  onBack: () => void;
}

export default function IdentityDetailsStep({
  value,
  onChange,
  onNext,
  onBack,
}: IdentityDetailsStepProps) {
  
  const getStepTitle = (id: string) => {
    switch (id) {
      case "school":
        return "Tell us about your school";
      case "college":
        return "Tell us about your college";
      case "professional":
        return "Tell us about your work";
      case "founder":
        return "Tell us about your startup";
      case "creator":
        return "Tell us about your platform";
      case "aspirant":
        return "Tell us about your exam preparation";
      default:
        return "Tell us about your focus";
    }
  };

  const getValidationErrors = (): boolean => {
    const ctx = value.branchContext || {};
    switch (value.primaryIdentity) {
      case "school":
        return !ctx.class || !ctx.board || !ctx.targetExam;
      case "college":
        return !ctx.university || !ctx.degree || !ctx.semester || !ctx.hostellerStatus;
      case "professional":
        return !ctx.industry || !ctx.experience || !ctx.workMode || !ctx.workHours;
      case "founder":
        return !ctx.startupStage || !ctx.teamSize || !ctx.industry;
      case "creator":
        return !ctx.primaryPlatform;
      case "aspirant":
        return !ctx.targetExam;
      default:
        return false; // Something else focus can be optional
    }
  };

  const title = getStepTitle(value.primaryIdentity);
  const nextDisabled = getValidationErrors() || !value.country;

  return (
    <StepLayout
      title={title}
      subtitle="Help Zen personalize your calendar and scheduling slots."
      onNext={onNext}
      onBack={onBack}
      nextDisabled={nextDisabled}
    >
      <IdentityForm value={value} onChange={onChange} showBranchOnly={true} />
    </StepLayout>
  );
}
