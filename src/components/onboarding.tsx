"use client";

import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import {
  ArrowLeft,
  ArrowRight,
  Sparkles,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Check,
  FileText,
  UploadCloud,
  Loader2,
  Calendar,
  Clock,
  Briefcase
} from "lucide-react";
import ThemeToggle from "./theme-toggle";

interface OnboardingProps {
  onComplete: () => void;
}

export interface Commitment {
  name: string;
  startTime: string;
  endTime: string;
  days: string[];
}

export interface Goal {
  title: string;
  priority: number;
}

export interface ImportedItem {
  id: string;
  selected: boolean;
  title: string;
  description: string;
  date: string;
  startTime: string;
  endTime: string;
  category: "Goal" | "Constraint" | "Task";
}

export default function Onboarding({ onComplete }: OnboardingProps) {
  // Wizard steps: 0 (Welcome) -> 1 (Identity) -> 2 (Life Structure) -> 3 (Goals) -> 4 (Preferences) -> 5 (Import) -> 6 (AI Generation)
  const [step, setStep] = useState(0);
  const [fade, setFade] = useState(true);

  // Section 1: Identity
  const [name, setName] = useState("");
  const [profession, setProfession] = useState("");
  const [age, setAge] = useState("");
  const [country, setCountry] = useState("");
  const [locale, setLocale] = useState("");
  const [timezone, setTimezone] = useState("");

  // Section 2: Life Structure
  const [wakeUpTime, setWakeUpTime] = useState("07:00");
  const [sleepTime, setSleepTime] = useState("23:00");
  const [commitments, setCommitments] = useState<Commitment[]>([]);
  // Commitment builder temp state
  const [tempCommitmentName, setTempCommitmentName] = useState("");
  const [tempCommitmentStart, setTempCommitmentStart] = useState("09:00");
  const [tempCommitmentEnd, setTempCommitmentEnd] = useState("17:00");
  const [tempCommitmentDays, setTempCommitmentDays] = useState<string[]>(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]);

  // Section 3: Goals
  const [goals, setGoals] = useState<Goal[]>([]);
  const [tempGoalTitle, setTempGoalTitle] = useState("");

  // Section 4: Planning Preferences
  const [schedulingStyle, setSchedulingStyle] = useState<"Strict" | "Flexible" | "Balanced">("Balanced");
  const [focusDuration, setFocusDuration] = useState<number>(45);
  const [deepWorkTime, setDeepWorkTime] = useState<"Morning" | "Afternoon" | "Evening" | "Night">("Morning");

  // Section 5: Import
  const [calendarConnected, setCalendarConnected] = useState(false);
  const [calendarEmail, setCalendarEmail] = useState("");
  const [importedItems, setImportedItems] = useState<ImportedItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [parseError, setParseError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Section 6: Generation Stream
  const [streamMessages, setStreamMessages] = useState<string[]>([]);
  const [currentGenerationStage, setCurrentGenerationStage] = useState<string>("");
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generationError, setGenerationError] = useState("");
  const [generationStats, setGenerationStats] = useState<any | null>(null);
  const [lastUsedMode, setLastUsedMode] = useState<"create" | "merge" | "replace">("create");

  // Rerun detection
  const [hasExistingProfile, setHasExistingProfile] = useState(false);
  const [showRerunModal, setShowRerunModal] = useState(false);

  // Auto-detect timezone/locale and load drafts
  useEffect(() => {
    if (typeof window !== "undefined") {
      setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
      setLocale(navigator.language || "en-US");

      // Load draft from localStorage
      const savedDraft = localStorage.getItem("zenkai_onboarding_draft");
      if (savedDraft) {
        try {
          const draft = JSON.parse(savedDraft);
          if (draft.name) setName(draft.name);
          if (draft.profession) setProfession(draft.profession);
          if (draft.age) setAge(draft.age);
          if (draft.country) setCountry(draft.country);
          if (draft.wakeUpTime) setWakeUpTime(draft.wakeUpTime);
          if (draft.sleepTime) setSleepTime(draft.sleepTime);
          if (draft.commitments) setCommitments(draft.commitments);
          if (draft.goals) setGoals(draft.goals);
          if (draft.schedulingStyle) setSchedulingStyle(draft.schedulingStyle);
          if (draft.focusDuration) setFocusDuration(draft.focusDuration);
          if (draft.deepWorkTime) setDeepWorkTime(draft.deepWorkTime);
          if (draft.step) setStep(draft.step);
        } catch (e) {
          console.error("Failed to parse onboarding draft:", e);
        }
      }
    }

    // Check if user already has an existing profile or Google calendar connected
    async function checkStatus() {
      try {
        const resProfile = await fetch("/api/user/profile");
        if (resProfile.ok) {
          setHasExistingProfile(true);
        }
      } catch (err) {
        console.log("Profile check error:", err);
      }

      try {
        const resMe = await fetch("/api/auth/me");
        if (resMe.ok) {
          const data = await resMe.json();
          if (data.user?.googleCalendarSettings?.connected) {
            setCalendarConnected(true);
            setCalendarEmail(data.user.googleCalendarSettings.email || "");
          }
        }
      } catch (err) {
        console.log("Auth me check error:", err);
      }
    }
    checkStatus();
  }, []);

  // Save drafts when state changes
  useEffect(() => {
    if (step > 0 && step < 6) {
      const draft = {
        name,
        profession,
        age,
        country,
        wakeUpTime,
        sleepTime,
        commitments,
        goals,
        schedulingStyle,
        focusDuration,
        deepWorkTime,
        step
      };
      localStorage.setItem("zenkai_onboarding_draft", JSON.stringify(draft));
    }
  }, [step, name, profession, age, country, wakeUpTime, sleepTime, commitments, goals, schedulingStyle, focusDuration, deepWorkTime]);

  const handleNext = () => {
    if (step === 5) {
      if (hasExistingProfile) {
        setShowRerunModal(true);
      } else {
        triggerGeneration("create");
      }
    } else {
      setFade(false);
      setTimeout(() => {
        setStep((prev) => prev + 1);
        setFade(true);
      }, 250);
    }
  };

  const handleBack = () => {
    if (step > 0) {
      setFade(false);
      setTimeout(() => {
        setStep((prev) => prev - 1);
        setFade(true);
      }, 250);
    }
  };

  // Commitment Management
  const addCommitment = () => {
    if (!tempCommitmentName.trim()) return;
    const newCommitment: Commitment = {
      name: tempCommitmentName.trim(),
      startTime: tempCommitmentStart,
      endTime: tempCommitmentEnd,
      days: [...tempCommitmentDays],
    };
    setCommitments((prev) => [...prev, newCommitment]);
    setTempCommitmentName("");
  };

  const removeCommitment = (index: number) => {
    setCommitments((prev) => prev.filter((_, i) => i !== index));
  };

  const toggleDayInTempCommitment = (day: string) => {
    setTempCommitmentDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  // Goals Management
  const addGoal = () => {
    if (!tempGoalTitle.trim()) return;
    const newGoal: Goal = {
      title: tempGoalTitle.trim(),
      priority: goals.length + 1,
    };
    setGoals((prev) => [...prev, newGoal]);
    setTempGoalTitle("");
  };

  const removeGoal = (index: number) => {
    setGoals((prev) => {
      const filtered = prev.filter((_, i) => i !== index);
      // Re-index priority
      return filtered.map((g, idx) => ({ ...g, priority: idx + 1 }));
    });
  };

  const moveGoal = (index: number, direction: "up" | "down") => {
    if (direction === "up" && index === 0) return;
    if (direction === "down" && index === goals.length - 1) return;
    const targetIdx = direction === "up" ? index - 1 : index + 1;
    const updated = [...goals];
    const temp = updated[index];
    updated[index] = updated[targetIdx];
    updated[targetIdx] = temp;
    // Re-index priority
    setGoals(updated.map((g, idx) => ({ ...g, priority: idx + 1 })));
  };

  // Google Calendar Integration
  const connectCalendar = async () => {
    try {
      const res = await fetch("/api/auth/google/url");
      if (res.ok) {
        const data = await res.json();
        if (data.url) {
          // Redirect user, draft is saved in localStorage so it persists!
          window.location.href = data.url;
        }
      }
    } catch (err) {
      console.error("Failed to connect Google Calendar:", err);
    }
  };

  // Timetable parser upload handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setParseError("");

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/onboarding/import", {
        method: "POST",
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.items) {
          setImportedItems(
            data.items.map((item: any, idx: number) => ({
              id: `imported-${idx}-${Date.now()}`,
              selected: true,
              title: item.title || "",
              description: item.description || "",
              date: item.date || "",
              startTime: item.startTime || "",
              endTime: item.endTime || "",
              category: item.category || "Constraint",
            }))
          );
        } else {
          setParseError(data.error || "Failed to parse document");
        }
      } else {
        setParseError("Server error parsing document");
      }
    } catch (err) {
      setParseError("Network error parsing document");
    } finally {
      setUploading(false);
    }
  };

  const toggleImportedItem = (id: string) => {
    setImportedItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, selected: !item.selected } : item))
    );
  };

  // Trigger streaming workspace generation
  const triggerGeneration = async (mode: "create" | "merge" | "replace") => {
    setLastUsedMode(mode);
    setGenerationStats(null);
    setShowRerunModal(false);
    setStep(6); // Go to generation screen
    setGenerationProgress(5);
    setGenerationError("");
    setStreamMessages(["Initiating connection..."]);

    const payload = {
      name,
      profile: {
        profession,
        longTermGoal: goals.length > 0 ? goals[0].title : "",
        currentFocus: goals.length > 0 ? goals[0].title : "",
        motivation: "",
        dailyAvailability: "",
        workStyle: "",
        biggestChallenge: "",
        timezone,
        age: age ? Number(age) : undefined,
        country: country || undefined,
        locale: locale || undefined,
        wakeUpTime,
        sleepTime,
        schedulingStyle,
        focusDuration,
        deepWorkTime,
      },
      commitments,
      goals,
      mode,
      importedItems: importedItems.filter((item) => item.selected),
    };

    try {
      const res = await fetch("/api/onboarding/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.body) {
        throw new Error("API did not return a stream");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      let rawBuffer = "";

      // List of generation stages in order
      const stageProgressMap: Record<string, number> = {
        learning: 15,
        identity: 30,
        routines: 45,
        roadmap: 60,
        weekly_schedule: 75,
        agenda: 85,
        workspace: 95,
        calendar: 98,
        complete: 100,
      };

      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        if (done) break;

        rawBuffer += decoder.decode(value, { stream: true });
        const lines = rawBuffer.split("\n\n");
        // Keep the last partial line in the buffer
        rawBuffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const event = JSON.parse(line.slice(6));
              if (event.stage) {
                setCurrentGenerationStage(event.stage);
                if (stageProgressMap[event.stage]) {
                  setGenerationProgress(stageProgressMap[event.stage]);
                }
              }
              if (event.message) {
                setStreamMessages((prev) => [...prev, event.message]);
              }
              if (event.status === "error") {
                setGenerationError(event.message || "Generation failed.");
              }
              if (event.status === "success" && event.stage === "complete") {
                // Clear draft from localStorage
                localStorage.removeItem("zenkai_onboarding_draft");
                setGenerationStats(event.stats);
                setGenerationProgress(100);
              }
            } catch (e) {
              console.error("Failed to parse SSE line:", line);
            }
          }
        }
      }
    } catch (err: any) {
      setGenerationError(err.message || "Failed to generate workspace.");
    }
  };

  const isStepValid = () => {
    switch (step) {
      case 1:
        return name.trim().length > 0 && profession !== "";
      case 3:
        return goals.length > 0;
      default:
        return true;
    }
  };

  const getProgressPercentage = () => {
    return (step / 6) * 100;
  };

  // Generation stages labels
  const generationStages = [
    { key: "learning", label: "Learning about you" },
    { key: "identity", label: "Building your identity" },
    { key: "routines", label: "Understanding your routines" },
    { key: "roadmap", label: "Designing your roadmap" },
    { key: "weekly_schedule", label: "Planning your week" },
    { key: "agenda", label: "Creating today's agenda" },
    { key: "workspace", label: "Preparing your workspace" },
    { key: "calendar", label: "Synchronizing your calendar" },
  ];

  return (
    <div className="h-screen w-full bg-background flex flex-col justify-between p-6 md:p-12 relative overflow-hidden select-none text-foreground transition-colors duration-300">
      {/* Theme Toggle in top-right corner */}
      <div className="absolute right-6 top-6 z-50">
        <ThemeToggle />
      </div>

      {/* Decorative Orb Glow */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-accent/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-accent/5 blur-[120px] pointer-events-none" />

      {/* Progress Header */}
      {step < 6 && (
        <header className="w-full flex flex-col gap-3 z-10 max-w-3xl mx-auto">
          <div className="flex justify-between items-center text-xs tracking-widest text-accent uppercase font-bold">
            <span>Zenkai Alignment</span>
            {step > 0 && (
              <span>
                Step {step} of 5
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
      )}

      {/* Conversational Screen Area */}
      <main className="flex-1 flex flex-col justify-center items-center z-10 w-full max-w-3xl mx-auto py-6 overflow-y-auto scrollbar-none">
        <div
          className={`w-full flex flex-col items-center text-center gap-6 transition-all duration-300 ${
            fade ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        >
          {/* Welcome Screen */}
          {step === 0 && (
            <div className="space-y-6 flex flex-col items-center max-w-md">
              <div className="relative w-28 h-28 mb-2 animate-float">
                <Image
                  src="/assets/orbs/companion_orb.png"
                  alt="Companion Orb"
                  fill
                  className="object-contain drop-shadow-[0_8px_24px_rgba(201,168,106,0.15)]"
                />
              </div>
              <h1 className="font-heading text-4xl md:text-5xl font-light tracking-wide text-foreground">
                Welcome to Zenkai.
              </h1>
              <p className="font-sans text-sm text-muted-foreground leading-relaxed">
                I am your companion. Rather than just tracking your calendar, we will construct a **Life Model** to align your aspirations, commitments, and focus patterns.
              </p>
              <button
                onClick={handleNext}
                className="mt-6 py-3.5 px-10 rounded-full bg-primary text-primary-foreground hover:bg-accent hover:text-accent-foreground font-sans text-xs tracking-wider uppercase font-semibold transition-all duration-300 shadow cursor-pointer"
              >
                Build Your Model
              </button>
            </div>
          )}

          {/* Section 1: Identity */}
          {step === 1 && (
            <div className="space-y-6 w-full max-w-xl flex flex-col items-center">
              <span className="font-sans text-[10px] tracking-[0.25em] text-accent font-semibold uppercase">
                Section 1 — Identity
              </span>
              <h2 className="font-heading text-3xl md:text-4xl font-light text-foreground">
                Who are you?
              </h2>

              <div className="w-full space-y-5 pt-4">
                <div className="flex flex-col gap-2">
                  <input
                    type="text"
                    placeholder="What should I call you?"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoFocus
                    className="w-full bg-transparent text-center border-b border-border/80 focus:border-accent outline-none text-2xl font-heading font-light py-2 text-foreground placeholder:text-muted-foreground/30 transition-all duration-300"
                  />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-2">
                  {[
                    "Student",
                    "College Student",
                    "Working Professional",
                    "Entrepreneur",
                    "Freelancer",
                    "Creator",
                    "Job Seeker",
                    "Other",
                  ].map((role) => (
                    <button
                      key={role}
                      onClick={() => setProfession(role)}
                      className={`py-3 px-4 rounded-xl border text-xs font-semibold tracking-wide font-sans transition-all duration-200 cursor-pointer ${
                        profession === role
                          ? "bg-primary border-primary text-primary-foreground shadow-sm"
                          : "bg-card border-border/70 hover:bg-secondary/40 text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {role}
                    </button>
                  ))}
                </div>

                <div className="flex gap-4 w-full pt-4">
                  <div className="flex-1 flex flex-col gap-1.5 text-left">
                    <label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Age (Optional)</label>
                    <input
                      type="number"
                      placeholder="e.g. 24"
                      value={age}
                      onChange={(e) => setAge(e.target.value)}
                      className="w-full bg-card border border-border rounded-xl px-4 py-2.5 text-xs outline-none focus:border-accent font-sans"
                    />
                  </div>
                  <div className="flex-1 flex flex-col gap-1.5 text-left">
                    <label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Country (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. India"
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      className="w-full bg-card border border-border rounded-xl px-4 py-2.5 text-xs outline-none focus:border-accent font-sans"
                    />
                  </div>
                </div>

                <div className="text-[10px] text-muted-foreground/60 flex items-center justify-center gap-2 pt-2">
                  <span>Detected Timezone: <span className="text-foreground font-mono">{timezone}</span></span>
                  <span>•</span>
                  <span>Locale: <span className="text-foreground font-mono">{locale}</span></span>
                </div>
              </div>
            </div>
          )}

          {/* Section 2: Life Structure */}
          {step === 2 && (
            <div className="space-y-6 w-full max-w-xl flex flex-col items-center">
              <span className="font-sans text-[10px] tracking-[0.25em] text-accent font-semibold uppercase">
                Section 2 — Life Structure
              </span>
              <h2 className="font-heading text-3xl md:text-4xl font-light text-foreground">
                What are your daily boundaries?
              </h2>
              <p className="text-xs text-muted-foreground max-w-md">
                Zenkai schedules focus blocks around your biological boundaries (sleep) and fixed weekly commitments.
              </p>

              <div className="w-full space-y-6 pt-2">
                {/* Sleep boundaries */}
                <div className="flex gap-4 justify-center bg-card border border-border p-4 rounded-2xl">
                  <div className="flex-1 flex flex-col gap-1 items-center">
                    <span className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold flex items-center gap-1">
                      <Clock size={10} /> Wake-up time
                    </span>
                    <input
                      type="time"
                      value={wakeUpTime}
                      onChange={(e) => setWakeUpTime(e.target.value)}
                      className="bg-transparent border-none text-xl font-heading text-foreground outline-none cursor-pointer"
                    />
                  </div>
                  <div className="w-[1px] bg-border" />
                  <div className="flex-1 flex flex-col gap-1 items-center">
                    <span className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold flex items-center gap-1">
                      <Clock size={10} /> Sleep time
                    </span>
                    <input
                      type="time"
                      value={sleepTime}
                      onChange={(e) => setSleepTime(e.target.value)}
                      className="bg-transparent border-none text-xl font-heading text-foreground outline-none cursor-pointer"
                    />
                  </div>
                </div>

                {/* Commitments Builder */}
                <div className="space-y-3 text-left">
                  <span className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Weekly Commitments</span>
                  
                  {commitments.length > 0 && (
                    <div className="flex flex-col gap-2 max-h-36 overflow-y-auto pr-1">
                      {commitments.map((c, idx) => (
                        <div key={idx} className="flex justify-between items-center bg-secondary/30 border border-border/40 px-3 py-2 rounded-xl text-xs">
                          <div>
                            <span className="font-semibold">{c.name}</span>
                            <span className="text-[10px] text-muted-foreground ml-2">
                              {c.startTime}–{c.endTime} on {c.days.length === 7 ? "Every Day" : c.days.join(", ")}
                            </span>
                          </div>
                          <button
                            onClick={() => removeCommitment(idx)}
                            className="text-muted-foreground hover:text-destructive p-1 transition-colors"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add Commitment form */}
                  <div className="border border-border/70 p-4 rounded-2xl bg-card/50 space-y-4">
                    <div className="flex flex-col gap-2">
                      <input
                        type="text"
                        placeholder="Commitment name (e.g. Office, Gym, College, Coaching)"
                        value={tempCommitmentName}
                        onChange={(e) => setTempCommitmentName(e.target.value)}
                        className="w-full bg-card border border-border rounded-xl px-3 py-2 text-xs outline-none focus:border-accent"
                      />
                    </div>
                    <div className="flex gap-4">
                      <div className="flex-1 flex flex-col gap-1">
                        <span className="text-[9px] uppercase tracking-widest text-muted-foreground">Start Time</span>
                        <input
                          type="time"
                          value={tempCommitmentStart}
                          onChange={(e) => setTempCommitmentStart(e.target.value)}
                          className="bg-card border border-border rounded-xl px-3 py-2 text-xs outline-none"
                        />
                      </div>
                      <div className="flex-1 flex flex-col gap-1">
                        <span className="text-[9px] uppercase tracking-widest text-muted-foreground">End Time</span>
                        <input
                          type="time"
                          value={tempCommitmentEnd}
                          onChange={(e) => setTempCommitmentEnd(e.target.value)}
                          className="bg-card border border-border rounded-xl px-3 py-2 text-xs outline-none"
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-1.5">
                      <span className="text-[9px] uppercase tracking-widest text-muted-foreground">Recurrence Days</span>
                      <div className="flex flex-wrap gap-1">
                        {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map((d) => {
                          const isSelected = tempCommitmentDays.includes(d);
                          return (
                            <button
                              key={d}
                              type="button"
                              onClick={() => toggleDayInTempCommitment(d)}
                              className={`py-1 px-2.5 rounded-full border text-[9px] font-sans font-medium transition-colors ${
                                isSelected
                                  ? "bg-primary border-primary text-primary-foreground"
                                  : "bg-card border-border hover:bg-secondary/40 text-muted-foreground"
                              }`}
                            >
                              {d.slice(0, 3)}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={!tempCommitmentName.trim()}
                      onClick={addCommitment}
                      className="w-full py-2 bg-primary hover:bg-accent text-primary-foreground hover:text-accent-foreground disabled:bg-secondary disabled:text-muted-foreground rounded-xl text-xs font-semibold tracking-wider font-sans transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Plus size={14} /> Add Commitment
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Section 3: Goals */}
          {step === 3 && (
            <div className="space-y-6 w-full max-w-xl flex flex-col items-center">
              <span className="font-sans text-[10px] tracking-[0.25em] text-accent font-semibold uppercase">
                Section 3 — Goals
              </span>
              <h2 className="font-heading text-3xl md:text-4xl font-light text-foreground">
                What are you trying to achieve?
              </h2>
              <p className="text-xs text-muted-foreground max-w-md">
                Add one or more goals you want to tackle. Order them by priority (top is highest).
              </p>

              <div className="w-full space-y-4 pt-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g. Crack GATE, Grow YouTube, Learn DSA, Lose Weight"
                    value={tempGoalTitle}
                    onChange={(e) => setTempGoalTitle(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addGoal()}
                    className="flex-1 bg-card border border-border rounded-xl px-4 py-2.5 text-xs outline-none focus:border-accent font-sans"
                  />
                  <button
                    onClick={addGoal}
                    className="py-2.5 px-4 rounded-xl bg-primary text-primary-foreground hover:bg-accent hover:text-accent-foreground text-xs font-semibold flex items-center justify-center cursor-pointer transition-colors"
                  >
                    Add
                  </button>
                </div>

                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {goals.map((g, idx) => (
                    <div
                      key={idx}
                      className="flex justify-between items-center bg-card border border-border p-3.5 rounded-xl text-xs"
                    >
                      <div className="flex items-center gap-3">
                        <span className="h-5 w-5 bg-accent/25 rounded-full flex items-center justify-center text-accent text-[10px] font-bold">
                          {idx + 1}
                        </span>
                        <span className="font-semibold text-foreground text-left">{g.title}</span>
                      </div>
                      
                      <div className="flex items-center gap-1.5">
                        <button
                          disabled={idx === 0}
                          onClick={() => moveGoal(idx, "up")}
                          className="text-muted-foreground hover:text-foreground disabled:opacity-30 p-1"
                        >
                          <ChevronUp size={14} />
                        </button>
                        <button
                          disabled={idx === goals.length - 1}
                          onClick={() => moveGoal(idx, "down")}
                          className="text-muted-foreground hover:text-foreground disabled:opacity-30 p-1"
                        >
                          <ChevronDown size={14} />
                        </button>
                        <div className="w-[1px] h-4 bg-border mx-1" />
                        <button
                          onClick={() => removeGoal(idx)}
                          className="text-muted-foreground hover:text-destructive p-1 transition-colors"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                  {goals.length === 0 && (
                    <div className="text-center py-6 text-xs text-muted-foreground italic border border-dashed border-border rounded-xl">
                      No goals added yet. Add at least one goal to proceed.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Section 4: Planning Preferences */}
          {step === 4 && (
            <div className="space-y-6 w-full max-w-xl flex flex-col items-center">
              <span className="font-sans text-[10px] tracking-[0.25em] text-accent font-semibold uppercase">
                Section 4 — Planning Preferences
              </span>
              <h2 className="font-heading text-3xl md:text-4xl font-light text-foreground">
                How do you prefer to execute?
              </h2>

              <div className="w-full space-y-6 pt-2 text-left">
                {/* Scheduling Style */}
                <div className="space-y-2">
                  <span className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Scheduling Style</span>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { key: "Strict" as const, label: "Strict", desc: "Rigid blocks" },
                      { key: "Flexible" as const, label: "Flexible", desc: "Adaptable slots" },
                      { key: "Balanced" as const, label: "Balanced", desc: "Structured breathing" }
                    ].map((style) => (
                      <button
                        key={style.key}
                        onClick={() => setSchedulingStyle(style.key)}
                        className={`flex flex-col items-center justify-center p-4 rounded-2xl border text-center cursor-pointer transition-all ${
                          schedulingStyle === style.key
                            ? "bg-primary border-primary text-primary-foreground shadow-md"
                            : "bg-card border-border/70 hover:bg-secondary/40 text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <span className="text-xs font-bold font-sans">{style.label}</span>
                        <span className="text-[9px] opacity-70 mt-1 font-sans">{style.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Focus Duration */}
                <div className="space-y-2">
                  <span className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Preferred Focus Duration</span>
                  <div className="grid grid-cols-4 gap-2">
                    {[25, 45, 60, 90].map((dur) => (
                      <button
                        key={dur}
                        onClick={() => setFocusDuration(dur)}
                        className={`py-3 rounded-xl border text-center text-xs font-semibold cursor-pointer transition-colors ${
                          focusDuration === dur
                            ? "bg-primary border-primary text-primary-foreground shadow-sm"
                            : "bg-card border-border/70 hover:bg-secondary/40 text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {dur} mins
                      </button>
                    ))}
                  </div>
                </div>

                {/* Deep Work Time */}
                <div className="space-y-2">
                  <span className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Preferred Deep Work Time</span>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { key: "Morning" as const, label: "Morning" },
                      { key: "Afternoon" as const, label: "Afternoon" },
                      { key: "Evening" as const, label: "Evening" },
                      { key: "Night" as const, label: "Night" }
                    ].map((time) => (
                      <button
                        key={time.key}
                        onClick={() => setDeepWorkTime(time.key)}
                        className={`py-3 rounded-xl border text-center text-[10px] font-semibold cursor-pointer transition-colors ${
                          deepWorkTime === time.key
                            ? "bg-primary border-primary text-primary-foreground shadow-sm"
                            : "bg-card border-border/70 hover:bg-secondary/40 text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {time.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Section 5: Import */}
          {step === 5 && (
            <div className="space-y-6 w-full max-w-xl flex flex-col items-center">
              <span className="font-sans text-[10px] tracking-[0.25em] text-accent font-semibold uppercase">
                Section 5 — Import Information
              </span>
              <h2 className="font-heading text-3xl md:text-4xl font-light text-foreground">
                Import existing details
              </h2>
              <p className="text-xs text-muted-foreground max-w-md">
                Google Calendar or timetable files can be optionally imported. Zenkai extracts tasks and commitments automatically.
              </p>

              <div className="w-full space-y-6 pt-2 text-left">
                {/* Google Calendar Connection */}
                <div className="bg-card border border-border rounded-2xl p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Calendar className="text-accent shrink-0" size={24} />
                    <div>
                      <span className="text-xs font-semibold block">Google Calendar Connection</span>
                      <span className="text-[10px] text-muted-foreground">
                        {calendarConnected
                          ? `Connected as ${calendarEmail}`
                          : "Connect to sync schedules and tasks"}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={connectCalendar}
                    className={`py-2 px-4 rounded-xl text-xs font-semibold font-sans transition-all cursor-pointer ${
                      calendarConnected
                        ? "bg-secondary text-foreground hover:bg-border/60"
                        : "bg-accent/15 text-accent border border-accent/30 hover:bg-accent/25"
                    }`}
                  >
                    {calendarConnected ? "Connected ✓" : "Connect"}
                  </button>
                </div>

                {/* Timetable parsing */}
                <div className="space-y-2">
                  <span className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Timetable, Syllabus, or Schedule PDF / Image</span>
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-border hover:border-accent rounded-2xl p-6 bg-card/30 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all hover:bg-card/65"
                  >
                    <UploadCloud className="text-muted-foreground" size={32} />
                    <span className="text-xs font-semibold">Click to upload file</span>
                    <span className="text-[10px] text-muted-foreground">Supports PDF, JPG, PNG schedules</span>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="application/pdf, image/*"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </div>
                  
                  {uploading && (
                    <div className="flex items-center justify-center gap-2 py-3 text-xs text-accent">
                      <Loader2 className="animate-spin" size={14} />
                      <span>Gemini is extracting tasks and commitments...</span>
                    </div>
                  )}

                  {parseError && (
                    <div className="text-xs text-destructive bg-destructive/10 border border-destructive/20 p-2.5 rounded-xl">
                      {parseError}
                    </div>
                  )}

                  {/* Parse Results Preview */}
                  {importedItems.length > 0 && (
                    <div className="space-y-2 pt-2">
                      <span className="text-[9px] uppercase font-bold tracking-widest text-muted-foreground">Extracted Items ({importedItems.length})</span>
                      <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-1">
                        {importedItems.map((item) => (
                          <div
                            key={item.id}
                            onClick={() => toggleImportedItem(item.id)}
                            className={`flex gap-3 items-start border p-3 rounded-xl cursor-pointer transition-colors ${
                              item.selected
                                ? "bg-accent/5 border-accent/60"
                                : "bg-card/40 border-border/50 hover:bg-card"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={item.selected}
                              onChange={() => {}} // handled by parent click
                              className="mt-0.5 accent-accent"
                            />
                            <div className="flex-1 text-xs">
                              <div className="flex justify-between items-center">
                                <span className="font-semibold text-foreground">{item.title}</span>
                                <span className="text-[9px] uppercase tracking-wider bg-secondary/80 px-2 py-0.5 rounded text-muted-foreground">
                                  {item.category}
                                </span>
                              </div>
                              {item.description && (
                                <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">{item.description}</p>
                              )}
                              <div className="flex gap-2 text-[9px] text-muted-foreground/80 mt-1 font-mono">
                                {item.date && <span>Date: {item.date}</span>}
                                {item.startTime && (
                                  <span>Time: {item.startTime}–{item.endTime || "?"}</span>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Section 6: Streaming Generation UI / Welcome Summary */}
          {step === 6 && (
            <div className="space-y-8 w-full max-w-xl flex flex-col items-center py-6 animate-in fade-in duration-300">
              {generationStats ? (
                /* Welcome Summary Card */
                <div className="w-full bg-card/70 border border-accent/40 rounded-3xl p-6 md:p-8 shadow-2xl space-y-6 text-left relative overflow-hidden animate-in zoom-in-95 duration-300">
                  <div className="absolute -right-16 -top-16 w-36 h-36 rounded-full bg-accent/10 blur-3xl pointer-events-none" />
                  
                  <div className="space-y-2">
                    <span className="font-sans text-[10px] tracking-[0.25em] text-accent font-bold uppercase block">
                      Workspace Ready
                    </span>
                    <h3 className="font-heading text-2xl md:text-3xl font-light text-foreground">
                      Your first workspace is ready.
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-2">
                    <div className="flex items-center gap-2.5 text-xs text-foreground/90">
                      <span className="h-5 w-5 rounded-full bg-accent/20 border border-accent/35 text-accent flex items-center justify-center text-[10px] font-bold">✓</span>
                      <span>1 Roadmap</span>
                    </div>
                    <div className="flex items-center gap-2.5 text-xs text-foreground/90">
                      <span className="h-5 w-5 rounded-full bg-accent/20 border border-accent/35 text-accent flex items-center justify-center text-[10px] font-bold">✓</span>
                      <span>{generationStats.milestonesCount} Milestones</span>
                    </div>
                    <div className="flex items-center gap-2.5 text-xs text-foreground/90">
                      <span className="h-5 w-5 rounded-full bg-accent/20 border border-accent/35 text-accent flex items-center justify-center text-[10px] font-bold">✓</span>
                      <span>{generationStats.tasksCount} Tasks</span>
                    </div>
                    <div className="flex items-center gap-2.5 text-xs text-foreground/90">
                      <span className="h-5 w-5 rounded-full bg-accent/20 border border-accent/35 text-accent flex items-center justify-center text-[10px] font-bold">✓</span>
                      <span>{generationStats.scheduleDays}-Day Schedule</span>
                    </div>
                    <div className="flex items-center gap-2.5 text-xs text-foreground/90">
                      <span className="h-5 w-5 rounded-full bg-accent/20 border border-accent/35 text-accent flex items-center justify-center text-[10px] font-bold">✓</span>
                      <span>Today's Agenda</span>
                    </div>
                    <div className="flex items-center gap-2.5 text-xs text-foreground/90">
                      <span className="h-5 w-5 rounded-full bg-accent/20 border border-accent/35 text-accent flex items-center justify-center text-[10px] font-bold">✓</span>
                      <span>{generationStats.calendarConnected ? "Google Calendar Synced" : "Calendar can be connected later"}</span>
                    </div>
                  </div>

                  <div className="border-t border-border/20 pt-4 space-y-2">
                    <span className="text-[10px] uppercase font-bold tracking-widest text-accent/80 block">
                      Remember
                    </span>
                    <p className="font-sans text-xs text-muted-foreground leading-relaxed">
                      This is only your first draft. As you chat with Zenkai, complete tasks, and make decisions, your plans will continuously adapt to you.
                    </p>
                  </div>

                  <button
                    onClick={onComplete}
                    className="w-full py-3 bg-primary text-primary-foreground hover:bg-accent hover:text-accent-foreground text-xs font-semibold uppercase tracking-wider font-sans rounded-xl transition-all duration-300 shadow-md cursor-pointer flex items-center justify-center gap-2"
                  >
                    <span>Enter Workspace</span>
                    <ArrowRight size={14} />
                  </button>
                </div>
              ) : (
                /* Existing Loading Progress Screen */
                <>
                  <div className="relative w-36 h-36">
                    <div className="absolute -inset-10 rounded-full bg-accent/20 blur-3xl opacity-80 animate-pulse" />
                    <Image
                      src="/assets/orbs/companion_orb.png"
                      alt="Companion Orb"
                      fill
                      className="object-contain drop-shadow-[0_12px_32px_rgba(201,168,106,0.25)] animate-float"
                    />
                  </div>

                  <div className="w-full space-y-5 text-center">
                    <span className="font-sans text-[10px] tracking-[0.25em] text-accent font-bold uppercase flex items-center justify-center gap-2 animate-pulse">
                      <Sparkles size={13} className="text-accent" />
                      Zenkai Awakening
                    </span>
                    
                    <h3 className="font-heading text-2xl font-light text-foreground">
                      Synchronizing Workspace
                    </h3>

                    {/* Progress bar */}
                    <div className="w-full max-w-md mx-auto h-[3px] bg-secondary rounded-full overflow-hidden">
                      <div
                        className="h-full bg-accent transition-all duration-500 ease-out"
                        style={{ width: `${generationProgress}%` }}
                      />
                    </div>
                    
                    {/* Stages tracking checklist */}
                    <div className="w-full max-w-sm mx-auto text-left space-y-2.5 pt-2">
                      {generationStages.map((stage) => {
                        const stageIndex = generationStages.findIndex(s => s.key === stage.key);
                        const currentIndex = generationStages.findIndex(s => s.key === currentGenerationStage);
                        const isCompleted = stageIndex < currentIndex || (currentGenerationStage === "complete");
                        const isActive = currentGenerationStage === stage.key && !isCompleted;

                        return (
                          <div
                            key={stage.key}
                            className={`flex items-center gap-3 text-xs transition-opacity duration-300 ${
                              isCompleted ? "opacity-100 text-foreground" : isActive ? "opacity-100 text-accent font-semibold" : "opacity-40 text-muted-foreground"
                            }`}
                          >
                            <div className={`h-4.5 w-4.5 rounded-full flex items-center justify-center border text-[9px] ${
                              isCompleted
                                ? "bg-accent/20 border-accent text-accent font-bold"
                                : isActive
                                ? "border-accent text-accent animate-pulse"
                                : "border-border text-muted-foreground"
                            }`}>
                              {isCompleted ? "✓" : isActive ? "●" : ""}
                            </div>
                            <span>{stage.label}</span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Logs message terminal */}
                    <div className="w-full max-w-md mx-auto bg-secondary/35 border border-border/40 rounded-2xl p-4 h-32 overflow-y-auto text-left text-[11px] font-mono text-muted-foreground/90 space-y-1.5 scrollbar-thin">
                      {streamMessages.map((msg, i) => (
                        <div key={i} className="flex gap-1.5 items-start">
                          <span className="text-accent shrink-0 select-none">&gt;</span>
                          <span className="leading-relaxed">{msg}</span>
                        </div>
                      ))}
                      {generationError && (
                        <div className="text-destructive font-semibold">&gt; Error: {generationError}</div>
                      )}
                    </div>

                    {/* Graceful Failure actions panel */}
                    {generationError && (
                      <div className="w-full max-w-md mx-auto flex gap-3.5 pt-2 animate-in slide-in-from-bottom-2 duration-300">
                        <button
                          onClick={() => triggerGeneration(lastUsedMode)}
                          className="flex-1 py-2.5 px-4 bg-primary text-primary-foreground hover:bg-accent hover:text-accent-foreground text-xs font-semibold rounded-xl transition-all cursor-pointer font-sans"
                        >
                          Retry failed steps
                        </button>
                        <button
                          onClick={async () => {
                            try {
                              await fetch("/api/onboarding/complete", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                  name,
                                  profession,
                                  longTermGoal: goals.length > 0 ? goals[0].title : "Success",
                                  currentFocus: goals.length > 0 ? goals[0].title : "Success",
                                  motivation: "",
                                  dailyAvailability: "",
                                  workStyle: "",
                                  biggestChallenge: "",
                                }),
                              });
                            } catch (e) {
                              console.error("Bypass failed:", e);
                            }
                            onComplete();
                          }}
                          className="flex-1 py-2.5 px-4 border border-border bg-card hover:bg-secondary/40 text-muted-foreground hover:text-foreground text-xs font-semibold rounded-xl transition-all cursor-pointer font-sans"
                        >
                          Continue anyway
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Footer Navigation */}
      {step < 6 && (
        <footer className="w-full flex justify-between items-center z-10 max-w-3xl mx-auto pt-6 border-t border-border/20">
          {step > 0 ? (
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

          {step > 0 ? (
            <button
              onClick={handleNext}
              disabled={!isStepValid()}
              className="flex items-center gap-2 py-3 px-6 rounded-full text-xs font-semibold uppercase tracking-wider bg-primary text-primary-foreground disabled:bg-secondary disabled:text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <span>{step === 5 ? "Generate Workspace" : "Continue"}</span>
              <ArrowRight size={14} />
            </button>
          ) : (
            <div /> // Spacer
          )}
        </footer>
      )}

      {/* Rerun Merge/Replace Modal */}
      {showRerunModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <h3 className="font-heading text-2xl font-light text-foreground text-center">
              Existing Workspace Detected
            </h3>
            <p className="font-sans text-xs text-muted-foreground text-center leading-relaxed">
              We found existing plans, goals, and schedules in your Zenkai workspace. How would you like to proceed?
            </p>
            
            <div className="grid grid-cols-1 gap-2.5 pt-2">
              <button
                onClick={() => triggerGeneration("merge")}
                className="w-full py-3 px-4 rounded-xl border border-accent/30 bg-accent/15 hover:bg-accent/35 text-foreground text-xs font-semibold font-sans tracking-wide transition-all cursor-pointer text-center"
              >
                Merge (Keep existing data, append new model)
              </button>
              <button
                onClick={() => triggerGeneration("replace")}
                className="w-full py-3 px-4 rounded-xl border border-destructive/30 bg-destructive/10 hover:bg-destructive/20 text-destructive text-xs font-semibold font-sans tracking-wide transition-all cursor-pointer text-center"
              >
                Replace (Nuke workspace, generate fresh)
              </button>
              <button
                onClick={() => setShowRerunModal(false)}
                className="w-full py-3 px-4 rounded-xl border border-border bg-card hover:bg-secondary/40 text-muted-foreground text-xs font-semibold font-sans tracking-wide transition-all cursor-pointer text-center"
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
