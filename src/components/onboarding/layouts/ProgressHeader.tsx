import React from "react";

interface ProgressHeaderProps {
  currentStep: number;
  totalSteps: number;
}

export default function ProgressHeader({ currentStep, totalSteps }: ProgressHeaderProps) {
  // Map step index to specific naming and percentages
  const getStepDetails = (step: number) => {
    switch (step) {
      case 0:
        return { name: "Welcome", pct: 0 };
      case 1:
        return { name: "Why Zen", pct: 10 };
      case 2:
        return { name: "Your World", pct: 20 };
      case 3:
        return { name: "Your Details", pct: 32 };
      case 4:
        return { name: "Your Focus", pct: 45 };
      case 5:
        return { name: "Your Routine", pct: 58 };
      case 6:
        return { name: "Your Commitments", pct: 70 };
      case 7:
        return { name: "Your Goals", pct: 82 };
      case 8:
        return { name: "Your Obstacles", pct: 92 };
      case 9:
        return { name: "Review Alignment", pct: 98 };
      default:
        return { name: "Awakening", pct: 100 };
    }
  };

  const { name, pct } = getStepDetails(currentStep);

  // Generate visual progress bar characters e.g. "██████░░░"
  const totalBlocks = 10;
  const activeBlocks = Math.round((pct / 100) * totalBlocks);
  const inactiveBlocks = totalBlocks - activeBlocks;
  const progressBarText = "█".repeat(activeBlocks) + "░".repeat(inactiveBlocks);

  return (
    <header className="w-full flex flex-col gap-2 z-10 max-w-xl mx-auto mb-6">
      <div className="flex justify-between items-center text-[10px] tracking-[0.2em] text-accent uppercase font-bold">
        <span>{name}</span>
        <span className="font-mono">{pct}% Completed</span>
      </div>
      <div className="flex items-center gap-3">
        <div className="font-mono text-sm tracking-wider text-accent/80 select-none">
          {progressBarText}
        </div>
        <div className="flex-1 h-[2px] bg-secondary rounded-full overflow-hidden">
          <div
            className="h-full bg-accent transition-all duration-500 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </header>
  );
}
