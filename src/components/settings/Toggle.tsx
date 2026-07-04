"use client";

import React from "react";

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

export default function Toggle({ checked, onChange, disabled = false }: ToggleProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border border-border/60 transition-colors duration-300 [transition-timing-function:cubic-bezier(0.34,1.56,0.64,1)] outline-none focus:ring-1 focus:ring-accent/40 ${
        checked ? "bg-accent" : "bg-secondary/60 hover:bg-secondary"
      } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
    >
      <span
        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-background shadow-sm ring-0 transition duration-300 [transition-timing-function:cubic-bezier(0.34,1.56,0.64,1)] ${
          checked ? "translate-x-4" : "translate-x-0"
        }`}
      />
    </button>
  );
}
