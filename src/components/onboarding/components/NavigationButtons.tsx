import React from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface NavigationButtonsProps {
  onNext: () => void;
  onBack?: () => void;
  onSkip?: () => void;
  nextDisabled?: boolean;
  nextLabel?: string;
  className?: string;
}

export default function NavigationButtons({
  onNext,
  onBack,
  onSkip,
  nextDisabled = false,
  nextLabel = "Continue",
  className,
}: NavigationButtonsProps) {
  return (
    <div className={cn("w-full flex items-center justify-between mt-8 pt-4 border-t border-border/20", className)}>
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors cursor-pointer select-none py-2 px-3 rounded-lg hover:bg-secondary/20"
        >
          <ArrowLeft size={14} />
          <span>Back</span>
        </button>
      ) : (
        <div /> // Spacer
      )}

      <div className="flex items-center gap-4">
        {onSkip && (
          <button
            type="button"
            onClick={onSkip}
            className="text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors cursor-pointer select-none py-2 px-3 rounded-lg hover:bg-secondary/20"
          >
            Skip
          </button>
        )}
        <button
          type="button"
          onClick={onNext}
          disabled={nextDisabled}
          className="flex items-center gap-2 py-3 px-6 rounded-full text-xs font-semibold uppercase tracking-wider bg-primary text-primary-foreground disabled:bg-secondary disabled:text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer select-none shadow-sm hover:shadow"
        >
          <span>{nextLabel}</span>
          <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}
