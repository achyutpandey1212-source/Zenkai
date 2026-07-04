import React from "react";
import QuestionTitle from "../components/QuestionTitle";
import NavigationButtons from "../components/NavigationButtons";
import { cn } from "@/lib/utils";

interface StepLayoutProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  onNext: () => void;
  onBack?: () => void;
  onSkip?: () => void;
  nextDisabled?: boolean;
  nextLabel?: string;
  className?: string;
}

export default function StepLayout({
  title,
  subtitle,
  children,
  onNext,
  onBack,
  onSkip,
  nextDisabled = false,
  nextLabel = "Continue",
  className,
}: StepLayoutProps) {
  return (
    <div className={cn("w-full max-w-3xl mx-auto flex flex-col justify-between h-full min-h-[400px]", className)}>
      <div className="space-y-6 flex-1 flex flex-col justify-center">
        <QuestionTitle title={title} subtitle={subtitle} />
        <div className="flex-1 flex flex-col justify-center w-full">
          {children}
        </div>
      </div>
      <NavigationButtons
        onNext={onNext}
        onBack={onBack}
        onSkip={onSkip}
        nextDisabled={nextDisabled}
        nextLabel={nextLabel}
      />
    </div>
  );
}
