"use client";

import React from "react";
import Image from "next/image";

export type OrbState =
  | "idle"
  | "listening"
  | "typing"
  | "thinking"
  | "writing"
  | "memory_retrieval"
  | "planning"
  | "execution"
  | "identity_update"
  | "reflection"
  | "completion";

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

  // Determine glow animation class matching Phase 9 requirements
  const glowClasses = {
    idle: "bg-accent/10 animate-glow-idle",
    listening: "bg-accent/15 animate-glow-listening",
    typing: "bg-accent/20 animate-glow-typing",
    thinking: "bg-accent/25 animate-glow-thinking",
    writing: "bg-accent/20 animate-glow-writing",
    memory_retrieval: "bg-teal-500/20 animate-glow-memory",
    planning: "bg-amber-500/25 animate-glow-planning",
    execution: "bg-accent/30 animate-glow-execution",
    identity_update: "bg-yellow-500/20 animate-glow-identity animate-pulse",
    reflection: "bg-indigo-500/15 animate-glow-reflection",
    completion: "bg-green-500/30 animate-glow-completion",
  }[state];

  // Determine orb movement/rotation classes
  const orbClasses = {
    idle: "animate-orb-float",
    listening: "animate-orb-listening",
    typing: "animate-orb-float",
    thinking: "animate-orb-rotate-slow",
    writing: "animate-orb-rotate-writing",
    memory_retrieval: "animate-orb-memory-inward",
    planning: "animate-orb-planning-rings",
    execution: "animate-orb-execution-orbit",
    identity_update: "animate-orb-identity-shimmer",
    reflection: "animate-orb-reflection-glow",
    completion: "animate-orb-completion-pulse",
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
