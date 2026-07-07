"use client";

import React, { useState, useEffect } from "react";
import ThemeToggle from "./theme-toggle";
import { IDENTITY_OPTIONS, MOTIVATION_OPTIONS } from "@/config/onboarding-options";

// Steps Imports
import WelcomeStep from "./onboarding/steps/WelcomeStep";
import MotivationStep from "./onboarding/steps/MotivationStep";
import IdentityStep from "./onboarding/steps/IdentityStep";
import IdentityDetailsStep from "./onboarding/steps/IdentityDetailsStep";
import LifeFocusStep from "./onboarding/steps/LifeFocusStep";
import RoutineStep from "./onboarding/steps/RoutineStep";
import CommitmentsStep from "./onboarding/steps/CommitmentsStep";
import GoalsStep from "./onboarding/steps/GoalsStep";
import ChallengesStep from "./onboarding/steps/ChallengesStep";
import SummaryStep from "./onboarding/steps/SummaryStep";
import IntegrationsStep from "./onboarding/steps/IntegrationsStep";
import LoadingStep from "./onboarding/steps/LoadingStep";

// layouts
import ProgressHeader from "./onboarding/layouts/ProgressHeader";

import { IdentityFormValues } from "./profile/IdentityForm";
import { RoutineFormValues } from "./profile/RoutineForm";
import { GoalItem } from "./profile/GoalsForm";
import { FocusFormValues } from "./profile/FocusForm";
import { ICommitment } from "@/models/Profile";

interface OnboardingProps {
  onComplete: () => void;
}

export default function Onboarding({ onComplete }: OnboardingProps) {
  // Wizard steps: 
  // 0 (Welcome) -> 1 (Motivation) -> 2 (Identity) -> 3 (IdentityDetails) -> 4 (FocusAreas) 
  // -> 5 (Routine) -> 6 (Commitments) -> 7 (Goals) -> 8 (Challenges) -> 9 (Summary) -> 10 (Loading/SSE)
  const [step, setStep] = useState(0);
  const [fade, setFade] = useState(true);

  // States
  const [name, setName] = useState("");
  const [motivationIds, setMotivationIds] = useState<string[]>([]);
  const [customMotivation, setCustomMotivation] = useState("");

  const [identityValues, setIdentityValues] = useState<IdentityFormValues>({
    primaryIdentity: "",
    country: "India",
    state: "",
    branchContext: {},
  });

  const [focusAreas, setFocusAreas] = useState<string[]>([]);

  const [routineValues, setRoutineValues] = useState<RoutineFormValues>({
    wakeTime: "06:00",
    sleepTime: "23:00",
    deepWorkTime: "Morning",
    dailyAvailability: "2-4 Hours",
  });

  const [commitments, setCommitments] = useState<ICommitment[]>([]);

  const [focusValues, setFocusValues] = useState<FocusFormValues>({
    schedulingStyle: "Balanced",
    focusDuration: 45,
  });

  const [goals, setGoals] = useState<GoalItem[]>([]);
  const [challenges, setChallenges] = useState<string[]>([]);

  // Timezone and locale
  const [timezone, setTimezone] = useState("UTC");
  const [locale, setLocale] = useState("en-US");

  // Rerun details
  const [hasExistingProfile, setHasExistingProfile] = useState(false);
  const [showRerunModal, setShowRerunModal] = useState(false);
  const [lastUsedMode, setLastUsedMode] = useState<"create" | "merge" | "replace">("create");

  // Loading SSE states
  const [currentStage, setCurrentStage] = useState<string>("learning");
  const [backendComplete, setBackendComplete] = useState(false);
  const [backendError, setBackendError] = useState<string | null>(null);

  // Auto-detect timezone and load drafts on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
      setLocale(navigator.language || "en-US");

      const savedDraft = localStorage.getItem("zenkai_onboarding_draft");
      if (savedDraft) {
        try {
          const draft = JSON.parse(savedDraft);
          if (draft.name) setName(draft.name);
          if (draft.motivationIds) setMotivationIds(draft.motivationIds);
          if (draft.customMotivation) setCustomMotivation(draft.customMotivation);
          if (draft.identityValues) setIdentityValues(draft.identityValues);
          if (draft.focusAreas) setFocusAreas(draft.focusAreas);
          if (draft.routineValues) setRoutineValues(draft.routineValues);
          if (draft.commitments) setCommitments(draft.commitments);
          if (draft.focusValues) setFocusValues(draft.focusValues);
          if (draft.goals) setGoals(draft.goals);
          if (draft.challenges) setChallenges(draft.challenges);
          if (typeof draft.step === "number") setStep(draft.step);
        } catch (e) {
          console.error("Failed to parse onboarding draft:", e);
        }
      }
    }

    async function checkExistingStatus() {
      try {
        const resProfile = await fetch("/api/user/profile");
        if (resProfile.ok) {
          setHasExistingProfile(true);
        }
      } catch (err) {
        console.log("Profile check error:", err);
      }
    }
    checkExistingStatus();
  }, []);

  // Auto-save draft when state changes
  useEffect(() => {
    if (step > 0 && step < 11) {
      const draft = {
        name,
        motivationIds,
        customMotivation,
        identityValues,
        focusAreas,
        routineValues,
        commitments,
        focusValues,
        goals,
        challenges,
        step,
      };
      localStorage.setItem("zenkai_onboarding_draft", JSON.stringify(draft));
    }
  }, [step, name, motivationIds, customMotivation, identityValues, focusAreas, routineValues, commitments, focusValues, goals, challenges]);

  const handleNext = () => {
    setFade(false);
    setTimeout(() => {
      setStep((prev) => prev + 1);
      setFade(true);
    }, 250);
  };

  const handleBack = () => {
    setFade(false);
    setTimeout(() => {
      setStep((prev) => prev - 1);
      setFade(true);
    }, 250);
  };

  const handleFinishSummary = () => {
    if (hasExistingProfile) {
      setShowRerunModal(true);
    } else {
      triggerWorkspaceGeneration("create");
    }
  };

  // Map dailyAvailability text representation to numeric float hours for schedule densities
  const mapAvailabilityToHours = (avail: string) => {
    switch (avail) {
      case "Less than 1 hour": return "1.0";
      case "1-2 Hours": return "2.0";
      case "2-4 Hours": return "4.0";
      case "4-6 Hours": return "6.0";
      case "6+ Hours": return "8.0";
      default: return "8.0";
    }
  };

  const triggerWorkspaceGeneration = async (mode: "create" | "merge" | "replace") => {
    setLastUsedMode(mode);
    setBackendComplete(false);
    setBackendError(null);
    setCurrentStage("learning");
    setShowRerunModal(false);
    setStep(11); // Go to loading step

    const resolvedMotivation = motivationIds
      .map((id) => {
        if (id === "other" && customMotivation) return customMotivation;
        const opt = MOTIVATION_OPTIONS.find((o) => o.id === id);
        return opt ? opt.label : id;
      })
      .join(", ");

    const payload = {
      name,
      profile: {
        primaryIdentity: identityValues.primaryIdentity,
        profession: IDENTITY_OPTIONS.find((o) => o.id === identityValues.primaryIdentity)?.label || "Other",
        state: identityValues.state,
        branchContext: identityValues.branchContext,
        longTermGoal: goals.length > 0 ? goals[0].title : "Success",
        currentFocus: goals.length > 0 ? goals[0].title : "Success",
        motivation: resolvedMotivation,
        dailyAvailability: mapAvailabilityToHours(routineValues.dailyAvailability),
        workStyle: "",
        biggestChallenge: challenges.length > 0 ? challenges[0] : "",
        timezone,
        country: identityValues.country || undefined,
        locale,
        wakeUpTime: routineValues.wakeTime,
        sleepTime: routineValues.sleepTime,
        schedulingStyle: focusValues.schedulingStyle,
        focusDuration: focusValues.focusDuration,
        deepWorkTime: routineValues.deepWorkTime,
        focusAreas,
        productivityChallenges: challenges,
      },
      commitments,
      goals,
      mode,
      importedItems: [],
    };

    try {
      const res = await fetch("/api/onboarding/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.body) {
        throw new Error("Setup did not return a valid event stream.");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      let rawBuffer = "";

      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        if (done) break;

        rawBuffer += decoder.decode(value, { stream: true });
        const lines = rawBuffer.split("\n\n");
        rawBuffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const event = JSON.parse(line.slice(6));
              if (event.stage) {
                setCurrentStage(event.stage);
              }
              if (event.status === "error") {
                setBackendError(event.message || "An error occurred during strategy generation.");
              }
              if (event.status === "success" && event.stage === "complete") {
                // Done!
                localStorage.removeItem("zenkai_onboarding_draft");
                setBackendComplete(true);
              }
            } catch (e) {
              console.error("SSE parser error:", e);
            }
          }
        }
      }
    } catch (err: any) {
      setBackendError(err.message || "Failed to communicate with setup backend.");
    }
  };

  const renderActiveStep = () => {
    switch (step) {
      case 0:
        return (
          <WelcomeStep
            name={name}
            onNameChange={setName}
            onNext={handleNext}
          />
        );
      case 1:
        return (
          <MotivationStep
            selectedIds={motivationIds}
            onChange={setMotivationIds}
            customValue={customMotivation}
            onCustomValueChange={setCustomMotivation}
            onNext={handleNext}
            onBack={handleBack}
          />
        );
      case 2:
        return (
          <IdentityStep
            value={identityValues}
            onChange={setIdentityValues}
            onNext={handleNext}
            onBack={handleBack}
          />
        );
      case 3:
        return (
          <IdentityDetailsStep
            value={identityValues}
            onChange={setIdentityValues}
            onNext={handleNext}
            onBack={handleBack}
          />
        );
      case 4:
        return (
          <LifeFocusStep
            selectedAreas={focusAreas}
            onChange={setFocusAreas}
            onNext={handleNext}
            onBack={handleBack}
          />
        );
      case 5:
        return (
          <RoutineStep
            value={routineValues}
            onChange={setRoutineValues}
            onNext={handleNext}
            onBack={handleBack}
          />
        );
      case 6:
        return (
          <CommitmentsStep
            value={commitments}
            onChange={setCommitments}
            onNext={handleNext}
            onBack={handleBack}
          />
        );
      case 7:
        return (
          <GoalsStep
            value={goals}
            onChange={setGoals}
            onNext={handleNext}
            onBack={handleBack}
          />
        );
      case 8:
        return (
          <ChallengesStep
            value={challenges}
            onChange={setChallenges}
            onNext={handleNext}
            onBack={handleBack}
          />
        );
      case 9:
        return (
          <IntegrationsStep
            onNext={handleNext}
            onBack={handleBack}
          />
        );
      case 10:
        return (
          <SummaryStep
            primaryIdentity={identityValues.primaryIdentity}
            branchContext={identityValues.branchContext}
            focusAreas={focusAreas}
            deepWorkTime={routineValues.deepWorkTime}
            wakeTime={routineValues.wakeTime}
            sleepTime={routineValues.sleepTime}
            productivityChallenges={challenges}
            goals={goals}
            commitments={commitments}
            onNext={handleFinishSummary}
            onBack={handleBack}
          />
        );
      case 11:
        return (
          <LoadingStep
            currentStage={currentStage}
            backendComplete={backendComplete}
            backendError={backendError}
            onComplete={onComplete}
            onRetry={() => triggerWorkspaceGeneration(lastUsedMode)}
            onBypass={async () => {
              try {
                await fetch("/api/onboarding/complete", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    name,
                    primaryIdentity: identityValues.primaryIdentity,
                    profession: IDENTITY_OPTIONS.find((o) => o.id === identityValues.primaryIdentity)?.label || "Other",
                    state: identityValues.state,
                    branchContext: identityValues.branchContext,
                    commitments,
                    longTermGoal: goals.length > 0 ? goals[0].title : "Success",
                    currentFocus: goals.length > 0 ? goals[0].title : "Success",
                    motivation: customMotivation,
                    dailyAvailability: mapAvailabilityToHours(routineValues.dailyAvailability),
                  }),
                });
              } catch (e) {
                console.error("Bypass setup failed:", e);
              }
              onComplete();
            }}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="h-screen w-full bg-background flex flex-col justify-between p-6 md:p-12 relative overflow-hidden select-none text-foreground transition-colors duration-300">
      <style dangerouslySetInnerHTML={{__html: `
        ::-webkit-scrollbar {
          display: none !important;
        }
        * {
          -ms-overflow-style: none !important;
          scrollbar-width: none !important;
        }
      `}} />
      
      {/* Theme toggle */}
      <div className="absolute right-6 top-6 z-50">
        <ThemeToggle />
      </div>

      {/* Background orbs glow */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-accent/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-accent/5 blur-[120px] pointer-events-none" />

      {/* Progress header */}
      {step < 11 && (
        <ProgressHeader currentStep={step} totalSteps={11} />
      )}

      {/* Conversational step viewport */}
      <main className="flex-1 flex flex-col justify-start items-center z-10 w-full max-w-3xl mx-auto py-8 overflow-y-auto scrollbar-none">
        <div
          className={`w-full transition-all duration-300 ${
            fade ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
          }`}
        >
          {renderActiveStep()}
        </div>
      </main>

      {/* Rerun Modal */}
      {showRerunModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-3xl max-w-md w-full p-6 md:p-8 space-y-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200 text-center">
            <h3 className="font-heading text-2xl font-light text-foreground">
              Existing Workspace Detected
            </h3>
            <p className="font-sans text-xs text-muted-foreground leading-relaxed">
              We found existing plans, goals, and schedules in your Zen workspace. How would you like to proceed?
            </p>
            
            <div className="grid grid-cols-1 gap-3 pt-2">
              <button
                onClick={() => triggerWorkspaceGeneration("merge")}
                className="w-full py-3 px-4 rounded-2xl border border-accent/30 bg-accent/10 hover:bg-accent/25 text-foreground text-xs font-semibold font-sans tracking-wide transition-all cursor-pointer text-center"
              >
                Merge (Keep existing, append new model)
              </button>
              <button
                onClick={() => triggerWorkspaceGeneration("replace")}
                className="w-full py-3 px-4 rounded-2xl border border-destructive/30 bg-destructive/10 hover:bg-destructive/25 text-destructive text-xs font-semibold font-sans tracking-wide transition-all cursor-pointer text-center"
              >
                Replace (Nuke workspace, generate fresh)
              </button>
              <button
                onClick={() => setShowRerunModal(false)}
                className="w-full py-3 px-4 rounded-2xl border border-border bg-card hover:bg-secondary/40 text-muted-foreground text-xs font-semibold font-sans tracking-wide transition-all cursor-pointer text-center"
              >
                Cancel & Review Draft
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
