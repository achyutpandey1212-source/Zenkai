"use client";

import React from "react";
import Image from "next/image";

export type OrbState = "idle" | "typing" | "thinking" | "writing" | "generating_agenda" | "completed_task" | "all_completed";

interface CompanionOrbProps {
  state: OrbState;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}

export default function CompanionOrb({ state, size = "md", className = "" }: CompanionOrbProps) {
  // Determine sizing classes
  const sizeClasses = {
    xs: "w-16 h-16 md:w-20 md:h-20",
    sm: "w-24 h-24 md:w-28 md:h-28",
    md: "w-40 h-40 md:w-44 md:h-44",
    lg: "w-44 h-44 md:w-60 md:h-60",
  }[size];

  // Determine glow animation class
  const glowClasses = {
    idle: "bg-accent/10 animate-glow-idle",
    typing: "bg-accent/20 animate-glow-typing",
    thinking: "bg-accent/25 animate-glow-thinking",
    writing: "bg-accent/20 animate-glow-writing",
    generating_agenda: "bg-accent/30 animate-glow-breath",
    completed_task: "bg-accent/40 animate-glow-pulse",
    all_completed: "bg-amber-500/35 animate-glow-golden",
  }[state];

  // Determine orb movement/rotation classes
  const orbClasses = {
    idle: "animate-orb-float",
    typing: "animate-orb-float",
    thinking: "animate-orb-rotate-slow",
    writing: "animate-orb-rotate-writing",
    generating_agenda: "animate-orb-breath",
    completed_task: "animate-orb-pulse-scale",
    all_completed: "animate-orb-float-golden",
  }[state];

  return (
    <div className={`relative flex items-center justify-center shrink-0 ${sizeClasses} ${className}`}>
      {/* Background Glow */}
      <div className={`absolute -inset-8 rounded-full blur-2xl transition-all duration-1000 ${glowClasses}`} />
      
      {/* Orb Image with state-dependent animation */}
      <div className={`relative w-full h-full transition-transform duration-1000 ${orbClasses}`}>
        <Image
          src="/assets/orbs/companion_orb.png"
          alt="Zenkai Companion Orb"
          fill
          priority
          sizes="(max-width: 768px) 160px, 240px"
          className="object-contain drop-shadow-[0_10px_20px_rgba(201,168,106,0.15)] group-hover:drop-shadow-[0_15px_30px_rgba(201,168,106,0.3)] transition-all duration-500"
        />
      </div>
    </div>
  );
}
