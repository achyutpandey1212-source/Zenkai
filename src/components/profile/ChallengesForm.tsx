"use client";

import React from "react";
import { CHALLENGE_OPTIONS } from "@/config/onboarding-options";
import OptionCard from "../onboarding/components/OptionCard";

interface ChallengesFormProps {
  value: string[];
  onChange: (newValue: string[]) => void;
}

export default function ChallengesForm({ value, onChange }: ChallengesFormProps) {
  const handleToggle = (label: string) => {
    if (value.includes(label)) {
      onChange(value.filter((item) => item !== label));
    } else {
      onChange([...value, label]);
    }
  };

  return (
    <div className="space-y-4 w-full max-w-xl mx-auto text-left animate-in fade-in duration-300">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {CHALLENGE_OPTIONS.map((opt) => {
          const isSelected = value.includes(opt.label);
          return (
            <OptionCard
              key={opt.id}
              title={opt.label}
              icon={opt.icon}
              selected={isSelected}
              onClick={() => handleToggle(opt.label)}
            />
          );
        })}
      </div>
    </div>
  );
}
