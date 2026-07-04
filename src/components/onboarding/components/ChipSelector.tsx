import React from "react";
import { cn } from "@/lib/utils";

interface ChipOption {
  id: string;
  label: string;
  icon?: string;
}

interface ChipSelectorProps {
  options: ChipOption[];
  selectedIds: string[];
  onChange: (selectedIds: string[]) => void;
  maxSelections?: number;
  className?: string;
}

export default function ChipSelector({
  options,
  selectedIds,
  onChange,
  maxSelections,
  className,
}: ChipSelectorProps) {
  const handleToggle = (id: string) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((item) => item !== id));
    } else {
      if (maxSelections && selectedIds.length >= maxSelections) {
        // Replace first selection or ignore
        if (maxSelections === 1) {
          onChange([id]);
        }
        return;
      }
      onChange([...selectedIds, id]);
    }
  };

  return (
    <div className={cn("flex flex-wrap gap-2 justify-center w-full max-w-xl mx-auto pt-2", className)}>
      {options.map((opt) => {
        const isSelected = selectedIds.includes(opt.id);
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => handleToggle(opt.id)}
            className={cn(
              "py-2.5 px-4 rounded-full border text-xs font-semibold tracking-wide font-sans transition-all duration-200 cursor-pointer flex items-center gap-1.5 hover:scale-[1.03] select-none",
              isSelected
                ? "bg-primary border-primary text-primary-foreground shadow-sm"
                : "bg-card border-border/70 hover:bg-secondary/40 text-muted-foreground hover:text-foreground"
            )}
          >
            {opt.icon && <span>{opt.icon}</span>}
            <span>{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
