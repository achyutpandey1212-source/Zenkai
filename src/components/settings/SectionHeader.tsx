"use client";

import React from "react";

interface SectionHeaderProps {
  title: string;
  description?: string;
  badge?: string;
}

export default function SectionHeader({ title, description, badge }: SectionHeaderProps) {
  return (
    <div className="flex flex-col gap-1 border-b border-border/40 pb-4 mb-6">
      <div className="flex items-center gap-2">
        <h3 className="font-heading text-xl md:text-2xl font-light tracking-wide text-foreground">
          {title}
        </h3>
        {badge && (
          <span className="px-2 py-0.5 border border-accent/30 text-accent bg-accent/5 rounded-full text-[8px] font-bold uppercase tracking-wider">
            {badge}
          </span>
        )}
      </div>
      {description && (
        <p className="font-sans text-xs text-muted-foreground leading-relaxed">
          {description}
        </p>
      )}
    </div>
  );
}
