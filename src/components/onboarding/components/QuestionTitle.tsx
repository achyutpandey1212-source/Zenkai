import React from "react";

interface QuestionTitleProps {
  title: string;
  subtitle?: string;
}

export default function QuestionTitle({ title, subtitle }: QuestionTitleProps) {
  return (
    <div className="space-y-2 text-center max-w-xl mx-auto mb-6">
      <h2 className="font-heading text-3xl md:text-4xl font-light tracking-wide text-foreground leading-tight">
        {title}
      </h2>
      {subtitle && (
        <p className="font-sans text-sm text-muted-foreground leading-relaxed max-w-md mx-auto">
          {subtitle}
        </p>
      )}
    </div>
  );
}
