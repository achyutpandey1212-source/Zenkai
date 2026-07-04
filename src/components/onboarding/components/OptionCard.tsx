import React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface OptionCardProps {
  title: string;
  description?: string;
  icon?: string | React.ReactNode;
  selected: boolean;
  onClick: () => void;
  className?: string;
}

export default function OptionCard({
  title,
  description,
  icon,
  selected,
  onClick,
  className,
}: OptionCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative w-full text-left p-5 rounded-2xl border transition-all duration-300 outline-none flex items-start gap-4 cursor-pointer select-none",
        "bg-card hover:bg-secondary/40 hover:scale-[1.02] active:scale-[0.99]",
        selected
          ? "border-accent shadow-[0_0_20px_rgba(201,168,106,0.15)] bg-accent/5"
          : "border-border/70 shadow-sm hover:shadow-md",
        className
      )}
    >
      {icon && (
        <span className="text-2xl shrink-0 flex items-center justify-center h-10 w-10 bg-secondary/50 rounded-xl">
          {icon}
        </span>
      )}
      <div className="flex-1 pr-6">
        <h4 className="font-sans text-sm font-semibold text-foreground tracking-wide">
          {title}
        </h4>
        {description && (
          <p className="font-sans text-xs text-muted-foreground mt-1 leading-normal">
            {description}
          </p>
        )}
      </div>

      <div
        className={cn(
          "absolute right-4 top-4 h-5 w-5 rounded-full border flex items-center justify-center transition-all duration-300",
          selected
            ? "bg-accent border-accent text-accent-foreground scale-100"
            : "border-border text-transparent scale-90"
        )}
      >
        <Check size={10} className="stroke-[3]" />
      </div>
    </button>
  );
}
