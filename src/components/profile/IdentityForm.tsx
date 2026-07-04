"use client";

import React, { useState, useEffect } from "react";
import { IDENTITY_OPTIONS } from "@/config/onboarding-options";
import OptionCard from "../onboarding/components/OptionCard";
import ChipSelector from "../onboarding/components/ChipSelector";
import { cn } from "@/lib/utils";

export interface IdentityFormValues {
  primaryIdentity: string;
  country: string;
  state?: string;
  branchContext: Record<string, string>;
}

interface IdentityFormProps {
  value: IdentityFormValues;
  onChange: (newValue: IdentityFormValues) => void;
  // During onboarding, we might want to split this form into multiple sub-steps/views (e.g. Identity choice first, then details)
  // We can pass `showOnly` prop to control which part is visible, or let it handle its own internal state.
  showBranchOnly?: boolean;
}

export default function IdentityForm({ value, onChange, showBranchOnly = false }: IdentityFormProps) {
  const [showCountryInput, setShowCountryInput] = useState(
    value.country && value.country.toLowerCase() !== "india"
  );

  // Sync state if country is empty, default to India
  useEffect(() => {
    if (!value.country) {
      onChange({ ...value, country: "India" });
    }
  }, [value.country]);

  const updateField = (field: keyof IdentityFormValues, val: any) => {
    onChange({ ...value, [field]: val });
  };

  const updateBranchContext = (key: string, val: string) => {
    onChange({
      ...value,
      branchContext: {
        ...value.branchContext,
        [key]: val,
      },
    });
  };

  const handleIdentitySelect = (id: string) => {
    // Reset branch context on identity change to avoid mixed properties
    onChange({
      ...value,
      primaryIdentity: id,
      branchContext: {},
    });
  };

  const renderIdentitySelect = () => {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-xl mx-auto animate-in fade-in duration-300">
        {IDENTITY_OPTIONS.map((opt) => (
          <OptionCard
            key={opt.id}
            title={opt.label}
            icon={opt.icon}
            selected={value.primaryIdentity === opt.id}
            onClick={() => handleIdentitySelect(opt.id)}
          />
        ))}
      </div>
    );
  };

  const renderBranchQuestions = () => {
    const isIndian = value.country && value.country.toLowerCase() === "india";

    const countrySection = (
      <div className="space-y-3 pt-2">
        <label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground block">
          Country
        </label>
        {!showCountryInput ? (
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-foreground bg-secondary/40 px-3.5 py-2 rounded-xl border border-border">
              🇮🇳 India
            </span>
            <button
              type="button"
              onClick={() => {
                setShowCountryInput(true);
                updateField("country", "");
              }}
              className="text-xs text-accent hover:underline"
            >
              Not from India?
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <input
              type="text"
              placeholder="Enter your country"
              value={value.country}
              onChange={(e) => updateField("country", e.target.value)}
              className="w-full max-w-xs bg-card border border-border rounded-xl px-4 py-2.5 text-xs outline-none focus:border-accent font-sans"
            />
            <button
              type="button"
              onClick={() => {
                setShowCountryInput(false);
                updateField("country", "India");
              }}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Reset to India
            </button>
          </div>
        )}
      </div>
    );

    switch (value.primaryIdentity) {
      case "school":
        return (
          <div className="space-y-6 w-full max-w-md mx-auto text-left animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* Class */}
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">
                Current Class
              </label>
              <div className="flex flex-wrap gap-2">
                {["8", "9", "10", "11", "12"].map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => updateBranchContext("class", c)}
                    className={cn(
                      "py-2 px-4 rounded-xl border text-xs font-semibold tracking-wide transition-all cursor-pointer",
                      value.branchContext.class === c
                        ? "bg-primary border-primary text-primary-foreground"
                        : "bg-card border-border/70 text-muted-foreground hover:bg-secondary/40"
                    )}
                  >
                    Class {c}
                  </button>
                ))}
              </div>
            </div>

            {/* Board */}
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">
                Board of Education
              </label>
              <div className="flex flex-wrap gap-2">
                {["CBSE", "ICSE", "State Board", "Other"].map((b) => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => updateBranchContext("board", b)}
                    className={cn(
                      "py-2 px-4 rounded-xl border text-xs font-semibold tracking-wide transition-all cursor-pointer",
                      value.branchContext.board === b
                        ? "bg-primary border-primary text-primary-foreground"
                        : "bg-card border-border/70 text-muted-foreground hover:bg-secondary/40"
                    )}
                  >
                    {b}
                  </button>
                ))}
              </div>
            </div>

            {/* Target Exam */}
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">
                Target Exam
              </label>
              <div className="flex flex-wrap gap-2">
                {["JEE", "NEET", "Olympiads", "Boards", "None"].map((ex) => (
                  <button
                    key={ex}
                    type="button"
                    onClick={() => updateBranchContext("targetExam", ex)}
                    className={cn(
                      "py-2 px-4 rounded-xl border text-xs font-semibold tracking-wide transition-all cursor-pointer",
                      value.branchContext.targetExam === ex
                        ? "bg-primary border-primary text-primary-foreground"
                        : "bg-card border-border/70 text-muted-foreground hover:bg-secondary/40"
                    )}
                  >
                    {ex}
                  </button>
                ))}
              </div>
            </div>

            {/* State */}
            {isIndian && (
              <div className="space-y-2">
                <label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">
                  State (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Maharashtra, Karnataka"
                  value={value.state || ""}
                  onChange={(e) => updateField("state", e.target.value)}
                  className="w-full bg-card border border-border rounded-xl px-4 py-2.5 text-xs outline-none focus:border-accent font-sans"
                />
              </div>
            )}

            {countrySection}
          </div>
        );

      case "college":
        return (
          <div className="space-y-6 w-full max-w-md mx-auto text-left animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* University Searchable dropdown (acts as searchable input) */}
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">
                University
              </label>
              <input
                type="text"
                placeholder="Search or enter your university"
                value={value.branchContext.university || ""}
                onChange={(e) => updateBranchContext("university", e.target.value)}
                className="w-full bg-card border border-border rounded-xl px-4 py-2.5 text-xs outline-none focus:border-accent font-sans"
              />
            </div>

            {/* Degree */}
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">
                Degree
              </label>
              <div className="grid grid-cols-3 gap-2">
                {["B.Tech", "BCA", "BBA", "MBA", "BA", "MBBS", "Other"].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => updateBranchContext("degree", d)}
                    className={cn(
                      "py-2 px-3 rounded-xl border text-xs font-semibold tracking-wide transition-all cursor-pointer text-center",
                      value.branchContext.degree === d
                        ? "bg-primary border-primary text-primary-foreground"
                        : "bg-card border-border/70 text-muted-foreground hover:bg-secondary/40"
                    )}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            {/* Semester */}
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">
                Current Semester
              </label>
              <div className="flex flex-wrap gap-2">
                {["1", "2", "3", "4", "5", "6", "7", "8"].map((sem) => (
                  <button
                    key={sem}
                    type="button"
                    onClick={() => updateBranchContext("semester", sem)}
                    className={cn(
                      "py-2 px-3.5 rounded-xl border text-xs font-semibold tracking-wide transition-all cursor-pointer",
                      value.branchContext.semester === sem
                        ? "bg-primary border-primary text-primary-foreground"
                        : "bg-card border-border/70 text-muted-foreground hover:bg-secondary/40"
                    )}
                  >
                    Sem {sem}
                  </button>
                ))}
              </div>
            </div>

            {/* Hosteller / Day Scholar */}
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">
                Housing Status
              </label>
              <div className="flex gap-2">
                {["Hosteller", "Day Scholar"].map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => updateBranchContext("hostellerStatus", type)}
                    className={cn(
                      "flex-1 py-2 px-4 rounded-xl border text-xs font-semibold tracking-wide transition-all cursor-pointer text-center",
                      value.branchContext.hostellerStatus === type
                        ? "bg-primary border-primary text-primary-foreground"
                        : "bg-card border-border/70 text-muted-foreground hover:bg-secondary/40"
                    )}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            {countrySection}
          </div>
        );

      case "professional":
        return (
          <div className="space-y-6 w-full max-w-md mx-auto text-left animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* Industry */}
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">
                Industry
              </label>
              <input
                type="text"
                placeholder="e.g. Software, Design, Marketing, Finance"
                value={value.branchContext.industry || ""}
                onChange={(e) => updateBranchContext("industry", e.target.value)}
                className="w-full bg-card border border-border rounded-xl px-4 py-2.5 text-xs outline-none focus:border-accent font-sans"
              />
            </div>

            {/* Experience */}
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">
                Years of Experience
              </label>
              <div className="flex flex-wrap gap-2">
                {["< 1 Year", "1-3 Years", "3-5 Years", "5+ Years"].map((exp) => (
                  <button
                    key={exp}
                    type="button"
                    onClick={() => updateBranchContext("experience", exp)}
                    className={cn(
                      "py-2 px-4 rounded-xl border text-xs font-semibold tracking-wide transition-all cursor-pointer",
                      value.branchContext.experience === exp
                        ? "bg-primary border-primary text-primary-foreground"
                        : "bg-card border-border/70 text-muted-foreground hover:bg-secondary/40"
                    )}
                  >
                    {exp}
                  </button>
                ))}
              </div>
            </div>

            {/* Work Mode */}
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">
                Work Mode
              </label>
              <div className="flex gap-2">
                {["Remote", "Hybrid", "Office"].map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => updateBranchContext("workMode", mode)}
                    className={cn(
                      "flex-1 py-2 px-4 rounded-xl border text-xs font-semibold tracking-wide transition-all cursor-pointer text-center",
                      value.branchContext.workMode === mode
                        ? "bg-primary border-primary text-primary-foreground"
                        : "bg-card border-border/70 text-muted-foreground hover:bg-secondary/40"
                    )}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>

            {/* Work Hours */}
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">
                Typical Work Hours
              </label>
              <input
                type="text"
                placeholder="e.g. 9 AM - 5 PM"
                value={value.branchContext.workHours || ""}
                onChange={(e) => updateBranchContext("workHours", e.target.value)}
                className="w-full bg-card border border-border rounded-xl px-4 py-2.5 text-xs outline-none focus:border-accent font-sans"
              />
            </div>

            {countrySection}
          </div>
        );

      case "founder":
        return (
          <div className="space-y-6 w-full max-w-md mx-auto text-left animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* Industry */}
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">
                Industry
              </label>
              <input
                type="text"
                placeholder="e.g. AI, SaaS, E-commerce, EdTech"
                value={value.branchContext.industry || ""}
                onChange={(e) => updateBranchContext("industry", e.target.value)}
                className="w-full bg-card border border-border rounded-xl px-4 py-2.5 text-xs outline-none focus:border-accent font-sans"
              />
            </div>

            {/* Startup Stage */}
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">
                Startup Stage
              </label>
              <div className="grid grid-cols-2 gap-2">
                {["Idea", "MVP", "Revenue", "Funding"].map((stage) => (
                  <button
                    key={stage}
                    type="button"
                    onClick={() => updateBranchContext("startupStage", stage)}
                    className={cn(
                      "py-2 px-4 rounded-xl border text-xs font-semibold tracking-wide transition-all cursor-pointer text-center",
                      value.branchContext.startupStage === stage
                        ? "bg-primary border-primary text-primary-foreground"
                        : "bg-card border-border/70 text-muted-foreground hover:bg-secondary/40"
                    )}
                  >
                    {stage}
                  </button>
                ))}
              </div>
            </div>

            {/* Team Size */}
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">
                Team Size
              </label>
              <div className="flex flex-wrap gap-2">
                {["Solo (1)", "2-5 people", "5-20 people", "20+ people"].map((size) => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => updateBranchContext("teamSize", size)}
                    className={cn(
                      "py-2 px-4 rounded-xl border text-xs font-semibold tracking-wide transition-all cursor-pointer",
                      value.branchContext.teamSize === size
                        ? "bg-primary border-primary text-primary-foreground"
                        : "bg-card border-border/70 text-muted-foreground hover:bg-secondary/40"
                    )}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>

            {countrySection}
          </div>
        );

      case "creator":
        return (
          <div className="space-y-6 w-full max-w-md mx-auto text-left animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* Primary Platform */}
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">
                Primary Platform
              </label>
              <input
                type="text"
                placeholder="e.g. YouTube, Twitter, Substack, LinkedIn"
                value={value.branchContext.primaryPlatform || ""}
                onChange={(e) => updateBranchContext("primaryPlatform", e.target.value)}
                className="w-full bg-card border border-border rounded-xl px-4 py-2.5 text-xs outline-none focus:border-accent font-sans"
              />
            </div>
            {countrySection}
          </div>
        );

      case "aspirant":
        return (
          <div className="space-y-6 w-full max-w-md mx-auto text-left animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* Target Exam */}
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">
                Target Exam
              </label>
              <input
                type="text"
                placeholder="e.g. UPSC, GATE, CAT, JEE, NEET"
                value={value.branchContext.targetExam || ""}
                onChange={(e) => updateBranchContext("targetExam", e.target.value)}
                className="w-full bg-card border border-border rounded-xl px-4 py-2.5 text-xs outline-none focus:border-accent font-sans"
              />
            </div>
            {countrySection}
          </div>
        );

      default:
        // something_else
        return (
          <div className="space-y-6 w-full max-w-md mx-auto text-left animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">
                What do you work on?
              </label>
              <input
                type="text"
                placeholder="Briefly describe your focus"
                value={value.branchContext.customFocus || ""}
                onChange={(e) => updateBranchContext("customFocus", e.target.value)}
                className="w-full bg-card border border-border rounded-xl px-4 py-2.5 text-xs outline-none focus:border-accent font-sans"
              />
            </div>
            {countrySection}
          </div>
        );
    }
  };

  if (showBranchOnly) {
    return renderBranchQuestions();
  }

  return value.primaryIdentity ? (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => handleIdentitySelect("")}
        className="text-xs text-accent hover:underline mb-2 flex items-center gap-1 font-semibold"
      >
        ← Change role selection ({IDENTITY_OPTIONS.find((o) => o.id === value.primaryIdentity)?.label})
      </button>
      {renderBranchQuestions()}
    </div>
  ) : (
    renderIdentitySelect()
  );
}
