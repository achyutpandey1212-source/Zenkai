import React from "react";
import { cn } from "@/lib/utils";

interface SummaryCardProps {
  title: string;
  value: string | string[];
  icon?: string;
  className?: string;
}

export default function SummaryCard({ title, value, icon, className }: SummaryCardProps) {
  const isArray = Array.isArray(value);

  return (
    <div className={cn("p-4 rounded-2xl border border-border bg-card shadow-sm space-y-2", className)}>
      <div className="flex items-center gap-2 text-[10px] uppercase font-bold tracking-widest text-muted-foreground">
        {icon && <span>{icon}</span>}
        <span>{title}</span>
      </div>
      <div className="text-xs font-semibold text-foreground leading-normal">
        {isArray ? (
          <div className="flex flex-wrap gap-1">
            {value.map((item, idx) => (
              <span key={idx} className="bg-secondary/40 px-2 py-0.5 rounded-lg border border-border/30">
                {item}
              </span>
            ))}
          </div>
        ) : (
          <span>{value}</span>
        )}
      </div>
    </div>
  );
}
