"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { ArrowLeft, ArrowRight, Sparkles } from "lucide-react";

interface OnboardingProps {
  onComplete: (data: OnboardingData) => void;
}

export interface OnboardingData {
  name: string;
  profession: string;
  longTermGoal: string;
  currentFocus: string;
  motivation: string;
  dailyAvailability: string;
  workStyle: string;
  biggestChallenge: string;
}

export default function Onboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState(0);
  const [fade, setFade] = useState(true);
  const [data, setData] = useState<OnboardingData>({
    name: "",
    profession: "",
    longTermGoal: "",
    currentFocus: "",
    motivation: "",
    dailyAvailability: "",
    workStyle: "",
    biggestChallenge: "",
  });

  const totalSteps = 10; // Welcome (0) to AI Intro (9)

  const handleNext = () => {
    if (step < totalSteps - 1) {
      setFade(false);
      setTimeout(() => {
        setStep((prev) => prev + 1);
        setFade(true);
      }, 300);
    } else {
      // Final step complete
      onComplete(data);
    }
  };

  const handleBack = () => {
    if (step > 0) {
      setFade(false);
      setTimeout(() => {
        setStep((prev) => prev - 1);
        setFade(true);
      }, 300);
    }
  };

  const updateField = (field: keyof OnboardingData, value: string) => {
    setData((prev) => ({ ...prev, [field]: value }));
  };

  // Keyboard navigation support (Enter to continue)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter" && isStepValid()) {
        // Prevent enter on textareas or if it's the welcome/final screen
        if (step !== 0 && step !== 9) {
          handleNext();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [step, data]);

  const isStepValid = () => {
    switch (step) {
      case 1: // Name
        return data.name.trim().length > 0;
      case 2: // Profession
        return data.profession !== "";
      case 3: // Long-term Goal
        return data.longTermGoal.trim().length > 0;
      case 4: // Current Focus
        return data.currentFocus.trim().length > 0;
      case 5: // Motivation
        return data.motivation.trim().length > 0;
      case 6: // Available Time
        return data.dailyAvailability !== "";
      case 7: // Working Style
        return data.workStyle !== "";
      case 8: // Biggest Challenge
        return data.biggestChallenge !== "";
      default:
        return true;
    }
  };

  // Progress Bar percentage (excludes Welcome step)
  const getProgressPercentage = () => {
    if (step === 0) return 0;
    return (step / (totalSteps - 1)) * 100;
  };

  return (
    <div className="h-screen w-full bg-background flex flex-col justify-between p-6 md:p-12 relative overflow-hidden select-none text-foreground transition-colors duration-300">
      {/* Background Decorative Temple Art (extremely subtle) */}
      <div className="absolute inset-0 opacity-5 pointer-events-none select-none z-0">
        <Image
          src="/assets/temples/temple_1_focus.png"
          alt="Temple Background"
          fill
          className="object-cover object-bottom"
        />
      </div>

      {/* Progress Header */}
      <header className="w-full flex flex-col gap-3 z-10 max-w-3xl mx-auto">
        <div className="flex justify-between items-center text-xs tracking-widest text-accent uppercase font-bold">
          <span>Zenkai Alignment</span>
          {step > 0 && (
            <span>
              Step {step} of {totalSteps - 1}
            </span>
          )}
        </div>
        <div className="w-full h-[2px] bg-secondary rounded-full overflow-hidden">
          <div
            className="h-full bg-accent transition-all duration-500 ease-out"
            style={{ width: `${getProgressPercentage()}%` }}
          />
        </div>
      </header>

      {/* Conversational Screen Area */}
      <main className="flex-1 flex flex-col justify-center items-center z-10 w-full max-w-2xl mx-auto py-12">
        <div
          className={`w-full flex flex-col items-center text-center gap-8 transition-opacity duration-300 ${
            fade ? "opacity-100" : "opacity-0"
          }`}
        >
          {/* Welcome Screen */}
          {step === 0 && (
            <div className="space-y-6 flex flex-col items-center">
              <div className="relative w-24 h-24 mb-4 animate-float">
                <Image
                  src="/assets/orbs/companion_orb.png"
                  alt="Companion Orb"
                  fill
                  className="object-contain drop-shadow-[0_8px_20px_rgba(201,168,106,0.12)]"
                />
              </div>
              <h1 className="font-heading text-4xl md:text-6xl font-light text-foreground">
                Welcome to Zenkai.
              </h1>
              <p className="font-sans text-sm text-muted-foreground max-w-sm leading-relaxed">
                Before we begin, I'd like to understand who you are and where you want to go.
              </p>
              <button
                onClick={handleNext}
                className="mt-6 py-3.5 px-10 rounded-full bg-primary text-primary-foreground hover:bg-accent hover:text-accent-foreground font-sans text-xs tracking-wider uppercase font-semibold transition-all duration-300 shadow cursor-pointer"
              >
                Let's Begin
              </button>
            </div>
          )}

          {/* Name Screen */}
          {step === 1 && (
            <div className="space-y-6 w-full flex flex-col items-center">
              <span className="font-sans text-[10px] tracking-[0.25em] text-accent font-semibold uppercase">
                Identity
              </span>
              <h2 className="font-heading text-3xl md:text-5xl font-light text-foreground">
                What should I call you?
              </h2>
              <div className="w-full max-w-md pt-4">
                <input
                  type="text"
                  placeholder="Enter your name"
                  value={data.name}
                  onChange={(e) => updateField("name", e.target.value)}
                  autoFocus
                  className="w-full bg-transparent text-center border-b border-border/80 focus:border-accent outline-none text-2xl md:text-4xl font-heading font-light py-2 text-foreground placeholder:text-muted-foreground/30 transition-all duration-300"
                />
              </div>
            </div>
          )}

          {/* Profession Screen */}
          {step === 2 && (
            <div className="space-y-6 w-full flex flex-col items-center">
              <span className="font-sans text-[10px] tracking-[0.25em] text-accent font-semibold uppercase">
                Context
              </span>
              <h2 className="font-heading text-3xl md:text-5xl font-light text-foreground">
                Which best describes you today?
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 w-full max-w-xl pt-4">
                {[
                  "Student",
                  "Working Professional",
                  "Freelancer",
                  "Founder",
                  "Creator",
                  "Looking for Opportunities",
                  "Other",
                ].map((option) => (
                  <button
                    key={option}
                    onClick={() => {
                      updateField("profession", option);
                      // Slight delay for visual select response before auto advancing
                      setTimeout(handleNext, 250);
                    }}
                    className={`py-3.5 px-4 rounded-xl border text-xs font-semibold tracking-wide font-sans transition-all duration-200 cursor-pointer ${
                      data.profession === option
                        ? "bg-primary border-primary text-primary-foreground shadow-sm"
                        : "bg-card border-border/70 hover:bg-secondary/40 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Long-term Goal Screen */}
          {step === 3 && (
            <div className="space-y-6 w-full flex flex-col items-center">
              <span className="font-sans text-[10px] tracking-[0.25em] text-accent font-semibold uppercase">
                Aspiration
              </span>
              <h2 className="font-heading text-3xl md:text-5xl font-light text-foreground">
                What do you want to become?
              </h2>
              <div className="w-full max-w-md pt-2">
                <input
                  type="text"
                  placeholder="e.g. Software Engineer"
                  value={data.longTermGoal}
                  onChange={(e) => updateField("longTermGoal", e.target.value)}
                  autoFocus
                  className="w-full bg-transparent text-center border-b border-border/80 focus:border-accent outline-none text-xl md:text-2xl font-sans font-light py-2 text-foreground placeholder:text-muted-foreground/30 transition-all duration-300"
                />
              </div>
              <div className="flex flex-wrap justify-center gap-2 max-w-md pt-2">
                {[
                  "Software Engineer",
                  "IAS Officer",
                  "Entrepreneur",
                  "Doctor",
                  "YouTuber",
                  "AI Researcher",
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => updateField("longTermGoal", suggestion)}
                    className="py-1.5 px-3 rounded-full border border-border/60 hover:border-accent/40 bg-secondary/30 hover:bg-secondary/70 text-[10px] font-sans text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Current Focus Screen */}
          {step === 4 && (
            <div className="space-y-6 w-full flex flex-col items-center">
              <span className="font-sans text-[10px] tracking-[0.25em] text-accent font-semibold uppercase">
                Focus
              </span>
              <h2 className="font-heading text-3xl md:text-5xl font-light text-foreground">
                What are you working on right now?
              </h2>
              <div className="w-full max-w-md pt-2">
                <input
                  type="text"
                  placeholder="e.g. Preparing for placements"
                  value={data.currentFocus}
                  onChange={(e) => updateField("currentFocus", e.target.value)}
                  autoFocus
                  className="w-full bg-transparent text-center border-b border-border/80 focus:border-accent outline-none text-xl md:text-2xl font-sans font-light py-2 text-foreground placeholder:text-muted-foreground/30 transition-all duration-300"
                />
              </div>
              <div className="flex flex-wrap justify-center gap-2 max-w-lg pt-2">
                {[
                  "Preparing for placements",
                  "Building a startup",
                  "Learning React",
                  "Preparing for UPSC",
                  "Semester exams",
                  "Creating content",
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => updateField("currentFocus", suggestion)}
                    className="py-1.5 px-3 rounded-full border border-border/60 hover:border-accent/40 bg-secondary/30 hover:bg-secondary/70 text-[10px] font-sans text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Motivation Screen */}
          {step === 5 && (
            <div className="space-y-6 w-full flex flex-col items-center">
              <span className="font-sans text-[10px] tracking-[0.25em] text-accent font-semibold uppercase">
                Purpose
              </span>
              <h2 className="font-heading text-3xl md:text-5xl font-light text-foreground">
                Why is this goal important to you?
              </h2>
              <div className="w-full max-w-md pt-2">
                <input
                  type="text"
                  placeholder="e.g. Financial freedom"
                  value={data.motivation}
                  onChange={(e) => updateField("motivation", e.target.value)}
                  autoFocus
                  className="w-full bg-transparent text-center border-b border-border/80 focus:border-accent outline-none text-xl md:text-2xl font-sans font-light py-2 text-foreground placeholder:text-muted-foreground/30 transition-all duration-300"
                />
              </div>
              <div className="flex flex-wrap justify-center gap-2 max-w-lg pt-2">
                {[
                  "Financial freedom",
                  "Helping my family",
                  "Building something meaningful",
                  "Creative freedom",
                  "Personal growth",
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => updateField("motivation", suggestion)}
                    className="py-1.5 px-3 rounded-full border border-border/60 hover:border-accent/40 bg-secondary/30 hover:bg-secondary/70 text-[10px] font-sans text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Available Time Screen */}
          {step === 6 && (
            <div className="space-y-6 w-full flex flex-col items-center">
              <span className="font-sans text-[10px] tracking-[0.25em] text-accent font-semibold uppercase">
                Availability
              </span>
              <h2 className="font-heading text-3xl md:text-5xl font-light text-foreground">
                How much focused time can you realistically dedicate each day?
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 w-full max-w-xl pt-4">
                {[
                  "Less than 30 minutes",
                  "30–60 minutes",
                  "1–2 hours",
                  "2–4 hours",
                  "More than 4 hours",
                ].map((option) => (
                  <button
                    key={option}
                    onClick={() => {
                      updateField("dailyAvailability", option);
                      setTimeout(handleNext, 250);
                    }}
                    className={`py-3.5 px-4 rounded-xl border text-xs font-semibold tracking-wide font-sans transition-all duration-200 cursor-pointer ${
                      data.dailyAvailability === option
                        ? "bg-primary border-primary text-primary-foreground shadow-sm"
                        : "bg-card border-border/70 hover:bg-secondary/40 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Working Style Screen */}
          {step === 7 && (
            <div className="space-y-6 w-full flex flex-col items-center">
              <span className="font-sans text-[10px] tracking-[0.25em] text-accent font-semibold uppercase">
                Methodology
              </span>
              <h2 className="font-heading text-3xl md:text-5xl font-light text-foreground">
                How do you usually like to work?
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 w-full max-w-xl pt-4">
                {[
                  "Deep Focus",
                  "Structured Planning",
                  "Flexible",
                  "Short Bursts",
                  "Still Figuring It Out",
                ].map((option) => (
                  <button
                    key={option}
                    onClick={() => {
                      updateField("workStyle", option);
                      setTimeout(handleNext, 250);
                    }}
                    className={`py-3.5 px-4 rounded-xl border text-xs font-semibold tracking-wide font-sans transition-all duration-200 cursor-pointer ${
                      data.workStyle === option
                        ? "bg-primary border-primary text-primary-foreground shadow-sm"
                        : "bg-card border-border/70 hover:bg-secondary/40 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Biggest Challenge Screen */}
          {step === 8 && (
            <div className="space-y-6 w-full flex flex-col items-center">
              <span className="font-sans text-[10px] tracking-[0.25em] text-accent font-semibold uppercase">
                Barriers
              </span>
              <h2 className="font-heading text-3xl md:text-5xl font-light text-foreground">
                What usually gets in your way?
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 w-full max-w-xl pt-4">
                {[
                  "Procrastination",
                  "Distractions",
                  "Lack of clarity",
                  "Inconsistency",
                  "Overthinking",
                  "Time management",
                  "Other",
                ].map((option) => (
                  <button
                    key={option}
                    onClick={() => {
                      updateField("biggestChallenge", option);
                      setTimeout(handleNext, 250);
                    }}
                    className={`py-3.5 px-4 rounded-xl border text-xs font-semibold tracking-wide font-sans transition-all duration-200 cursor-pointer ${
                      data.biggestChallenge === option
                        ? "bg-primary border-primary text-primary-foreground shadow-sm"
                        : "bg-card border-border/70 hover:bg-secondary/40 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* AI Introduction Screen */}
          {step === 9 && (
            <div className="space-y-8 flex flex-col items-center">
              <div className="relative w-32 h-32 animate-pulse">
                {/* Background active glow for talking orb */}
                <div className="absolute -inset-8 rounded-full bg-accent/15 blur-2xl opacity-80" />
                <Image
                  src="/assets/orbs/companion_orb.png"
                  alt="Companion Orb"
                  fill
                  className="object-contain drop-shadow-[0_10px_25px_rgba(201,168,106,0.2)]"
                />
              </div>

              <div className="space-y-4 max-w-md">
                <span className="font-sans text-[10px] tracking-[0.25em] text-accent font-bold uppercase flex items-center justify-center gap-1.5 animate-pulse">
                  <Sparkles size={12} className="text-accent" />
                  Zenkai Awakening
                </span>
                <h2 className="font-heading text-3xl font-light text-foreground">
                  Thank you, {data.name}.
                </h2>
                <div className="space-y-2 text-muted-foreground font-sans text-sm max-w-xs mx-auto leading-relaxed">
                  <p>From now on, I won't just answer your questions.</p>
                  <p className="font-medium text-foreground">
                    I'll quietly help you become the person you want to be.
                  </p>
                </div>
              </div>

              <button
                onClick={handleNext}
                className="mt-4 py-3.5 px-10 rounded-full bg-primary text-primary-foreground hover:bg-accent hover:text-accent-foreground font-sans text-xs tracking-wider uppercase font-semibold transition-all duration-300 shadow cursor-pointer"
              >
                Enter Growth Space
              </button>
            </div>
          )}
        </div>
      </main>

      {/* Footer Navigation */}
      <footer className="w-full flex justify-between items-center z-10 max-w-3xl mx-auto pt-6 border-t border-border/20">
        {step > 0 && step < totalSteps - 1 ? (
          <button
            onClick={handleBack}
            className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <ArrowLeft size={14} />
            <span>Back</span>
          </button>
        ) : (
          <div /> // Spacer
        )}

        {step > 0 && step < totalSteps - 1 ? (
          <button
            onClick={handleNext}
            disabled={!isStepValid()}
            className="flex items-center gap-2 py-3 px-6 rounded-full text-xs font-semibold uppercase tracking-wider bg-primary text-primary-foreground disabled:bg-secondary disabled:text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            <span>Continue</span>
            <ArrowRight size={14} />
          </button>
        ) : (
          <div /> // Spacer
        )}
      </footer>
    </div>
  );
}
