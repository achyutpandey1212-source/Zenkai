"use client";

import React from "react";

interface SettingsCardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export default function SettingsCard({ children, className = "", onClick }: SettingsCardProps) {
  return (
    <div
      onClick={onClick}
      className={`bg-card/50 border border-border/60 rounded-xl p-5 transition-all duration-300 ${
        onClick ? "cursor-pointer hover:bg-card hover:-translate-y-0.5 hover:shadow-[0_0_20px_rgba(201,168,106,0.06)] hover:border-accent/40" : ""
      } ${className}`}
    >
      {children}
    </div>
  );
}
