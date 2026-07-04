"use client";

import React from "react";
import Image from "next/image";

interface WelcomeStepProps {
  name: string;
  onNameChange: (val: string) => void;
  onNext: () => void;
}

export default function WelcomeStep({ name, onNameChange, onNext }: WelcomeStepProps) {
  return (
    <div className="space-y-6 flex flex-col items-center max-w-md mx-auto text-center py-8 animate-in fade-in duration-500">
      <div className="relative w-28 h-28 mb-2 animate-float">
        <Image
          src="/assets/orbs/companion_orb.webp"
          alt="Companion Orb"
          fill
          priority
          className="object-contain drop-shadow-[0_8px_24px_rgba(201,168,106,0.15)]"
        />
      </div>
      <h1 className="font-heading text-4xl md:text-5xl font-light tracking-wide text-foreground">
        Welcome to Zen
      </h1>
      <p className="font-sans text-sm text-muted-foreground leading-relaxed">
        Let's understand your life so Zen can coach you better. Rather than just tracking your calendar, we will construct a personalized model of your routine, goals, and focus patterns.
      </p>
      
      <div className="w-full max-w-xs space-y-2 pt-2">
        <label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground block text-center">
          What should I call you?
        </label>
        <input
          type="text"
          placeholder="Enter your name"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          className="w-full bg-card border border-border rounded-xl px-4 py-3 text-sm outline-none focus:border-accent font-sans text-center text-foreground placeholder:text-muted-foreground/45"
        />
      </div>

      <button
        onClick={onNext}
        disabled={!name.trim()}
        className="mt-4 py-3.5 px-10 rounded-full bg-primary text-primary-foreground hover:bg-accent hover:text-accent-foreground font-sans text-xs tracking-wider uppercase font-semibold transition-all duration-300 shadow cursor-pointer select-none disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Get Started
      </button>
    </div>
  );
}
