"use client";

import React, { useState, useEffect } from "react";
import { Check, Clock, AlertCircle, Circle } from "lucide-react";

interface TaskData {
  _id: string;
  title: string;
  description?: string;
  status: "todo" | "in_progress" | "completed" | "missed";
  priority: number;
  estimatedDuration?: string;
  dependencies?: string[];
  completedAt?: string;
}

interface GoalData {
  _id: string;
  title: string;
  description?: string;
  status: "active" | "completed" | "paused" | "cancelled";
  priority: number;
  estimatedDuration?: string;
  progress: number;
  tasks: TaskData[];
}

interface MilestoneData {
  _id: string;
  title: string;
  description?: string;
  status: "todo" | "in_progress" | "completed" | "cancelled";
  priority: number;
  estimatedDuration?: string;
  progress: number;
  goals: GoalData[];
}

interface PlanData {
  _id: string;
  title: string;
  description?: string;
  status: "active" | "completed" | "archived";
  priority: number;
  estimatedDuration?: string;
  progress: number;
  type: string;
  diagnostics?: {
    planningPrompt: string;
    rawGeminiOutput: string;
    normalizedPlan: string;
    executionTimeMs: number;
  };
  milestones: MilestoneData[];
  createdAt: string;
  updatedAt: string;
}

export default function Plans() {
  const [plans, setPlans] = useState<PlanData[]>([]);
  const [loading, setLoading] = useState(true);
  const [activePlanId, setActivePlanId] = useState<string | null>(null);
  const [selectedMilestoneId, setSelectedMilestoneId] = useState<string | null>(null);
  const [devMode, setDevMode] = useState(false);
  const [filter, setFilter] = useState<"all" | "completed" | "upcoming">("all");

  const fetchPlans = async () => {
    try {
      const res = await fetch("/api/plans");
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.plans) {
          setPlans(data.plans);
          if (data.plans.length > 0) {
            const active = data.plans.find((p: any) => p.status === "active") || data.plans[0];
            setActivePlanId(active._id);
            if (active.milestones.length > 0) {
              setSelectedMilestoneId(active.milestones[0]._id);
            }
          }
        }
      }
    } catch (err) {
      console.error("Failed to fetch plans:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlans();
  }, []);

  const handleToggleTask = async (taskId: string, currentStatus: string) => {
    const newStatus = currentStatus === "completed" ? "todo" : "completed";
    try {
      // Optimistic update
      setPlans((prevPlans) =>
        prevPlans.map((plan) => ({
          ...plan,
          milestones: plan.milestones.map((m) => ({
            ...m,
            goals: m.goals.map((g) => ({
              ...g,
              tasks: g.tasks.map((t) =>
                t._id === taskId ? { ...t, status: newStatus } : t
              ),
            })),
          })),
        }))
      );

      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (res.ok) {
        // Refetch to synchronize all calculated progress
        await fetchPlans();
      }
    } catch (err) {
      console.error("Failed to update task:", err);
    }
  };

  if (loading) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-6 w-6 rounded-full border-2 border-accent border-t-transparent animate-spin" />
          <span className="font-sans text-xs tracking-wider text-muted-foreground uppercase">Aligning roadmaps...</span>
        </div>
      </div>
    );
  }

  if (plans.length === 0) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center bg-background px-6 text-center">
        <div className="max-w-md flex flex-col gap-5 items-center">
          <span className="text-accent text-3xl">✦</span>
          <h2 className="font-heading text-3xl font-light text-foreground">No active roadmaps</h2>
          <p className="font-sans text-sm text-muted-foreground leading-relaxed">
            Zenkai builds roadmaps automatically based on your aspirations. Start a conversation in the Companion Chat to map out a goal like "crack placements", "learn React", or "lose 10kg".
          </p>
        </div>
      </div>
    );
  }

  const activePlan = plans.find((p) => p._id === activePlanId) || plans[0];
  const activeMilestones = activePlan.milestones || [];
  const selectedMilestone = activeMilestones.find((m) => m._id === selectedMilestoneId) || activeMilestones[0];

  return (
    <div className="h-full w-full overflow-y-auto p-6 md:p-12 lg:p-16 flex flex-col items-center bg-background scrollbar-none">
      <div className="max-w-3xl w-full flex flex-col gap-10 mt-4 pb-24">
        
        {/* Header Block */}
        <header className="flex flex-col gap-2 relative">
          <div className="flex items-center justify-between">
            <span className="font-sans text-[10px] tracking-[0.25em] text-accent font-semibold uppercase">
              STRATEGY ROADMAP
            </span>
            {process.env.NODE_ENV === "development" && (
              <button
                onClick={() => setDevMode(!devMode)}
                className={`font-sans text-[9px] tracking-wider uppercase px-2.5 py-1 rounded border transition-all ${
                  devMode
                    ? "border-accent/40 bg-accent/10 text-accent font-semibold"
                    : "border-border/60 text-muted-foreground/60 hover:text-foreground"
                }`}
              >
                Diagnostics
              </button>
            )}
          </div>
          <h1 className="font-heading text-4xl md:text-5xl font-light text-foreground tracking-wide">
            {activePlan.title}
          </h1>
          <p className="font-sans text-xs text-muted-foreground leading-relaxed">
            {activePlan.description || "A structured execution roadmap automatically designed around your goals."}
          </p>
        </header>

        {/* Overall Progress Block */}
        <section className="bg-secondary/40 border border-border/40 p-6 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex flex-col gap-2">
            <span className="font-sans text-[10px] tracking-wider text-accent font-bold uppercase">
              Current Progress
            </span>
            <div className="font-heading text-3xl font-light text-foreground">
              {activePlan.progress}% <span className="font-sans text-sm text-muted-foreground">completed</span>
            </div>
            <p className="font-sans text-xs text-muted-foreground/80 leading-relaxed">
              Zenkai adjusts tasks based on your weekly rhythm. Focus on current milestones to stay aligned.
            </p>
          </div>
          <div className="relative h-20 w-20 flex items-center justify-center shrink-0">
            <svg className="w-full h-full transform -rotate-90">
              <circle
                cx="40"
                cy="40"
                r="34"
                className="stroke-secondary-foreground/10 fill-none"
                strokeWidth="4"
              />
              <circle
                cx="40"
                cy="40"
                r="34"
                className="stroke-accent fill-none transition-all duration-1000 ease-out"
                strokeWidth="4"
                strokeDasharray={2 * Math.PI * 34}
                strokeDashoffset={2 * Math.PI * 34 * (1 - (activePlan.progress || 0) / 100)}
                strokeLinecap="round"
              />
            </svg>
            <span className="absolute font-sans text-sm font-semibold text-foreground">
              {activePlan.progress}%
            </span>
          </div>
        </section>

        {/* Milestones timeline & priorities */}
        <section className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
          
          {/* Milestones Left Column */}
          <div className="md:col-span-5 flex flex-col gap-5">
            <span className="font-sans text-[10px] tracking-wider text-accent/80 font-bold uppercase">
              Milestones
            </span>
            <div className="relative pl-4 border-l border-border/40 space-y-6">
              {activeMilestones.map((m, index) => {
                const isActive = selectedMilestoneId === m._id;
                return (
                  <div
                    key={m._id}
                    onClick={() => setSelectedMilestoneId(m._id)}
                    className="relative cursor-pointer group flex flex-col gap-1 transition-all"
                  >
                    {/* Node indicator */}
                    <div
                      className={`absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full border transition-all ${
                        isActive
                          ? "bg-accent border-accent scale-125"
                          : m.status === "completed"
                          ? "bg-green-500 border-green-500"
                          : "bg-background border-muted-foreground/30 group-hover:border-accent"
                      }`}
                    />
                    
                    <span className="font-sans text-[9px] tracking-wider text-muted-foreground/50 uppercase">
                      Phase {index + 1} ({m.estimatedDuration || "TBD"})
                    </span>
                    <span
                      className={`font-sans text-sm font-medium tracking-wide transition-all ${
                        isActive
                          ? "text-accent font-semibold"
                          : m.status === "completed"
                          ? "line-through text-muted-foreground/60"
                          : "text-foreground group-hover:text-accent/80"
                      }`}
                    >
                      {m.title}
                    </span>
                    <div className="flex items-center justify-between w-full">
                      <span className="font-sans text-[10px] text-muted-foreground/65">
                        {m.progress || 0}% progress
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Goal & Task detail view Right Column */}
          <div className="md:col-span-7 flex flex-col gap-6">
            {selectedMilestone ? (
              <div className="flex flex-col gap-6">
                
                {/* Milestone Detail Header */}
                <div className="border-b border-border/30 pb-4 flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span className="font-sans text-[10px] font-semibold text-accent uppercase">
                      Active Milestone Focus
                    </span>
                    <span className="font-sans text-[10px] px-2.5 py-0.5 rounded-full bg-secondary/60 text-muted-foreground border border-border/30 uppercase">
                      {selectedMilestone.status}
                    </span>
                  </div>
                  <h3 className="font-heading text-xl text-foreground">
                    {selectedMilestone.title}
                  </h3>
                  <p className="font-sans text-xs text-muted-foreground/80 leading-relaxed">
                    {selectedMilestone.description || "Active milestone objectives."}
                  </p>
                </div>

                {/* Filters */}
                <div className="flex items-center gap-2 border-b border-border/20 pb-3">
                  {(["all", "upcoming", "completed"] as const).map((type) => (
                    <button
                      key={type}
                      onClick={() => setFilter(type)}
                      className={`font-sans text-[10px] tracking-wider uppercase px-3 py-1 rounded-full border transition-all ${
                        filter === type
                          ? "bg-accent/15 border-accent/40 text-accent font-semibold"
                          : "border-transparent text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>

                {/* Goals & Tasks checklist */}
                <div className="space-y-6">
                  {selectedMilestone.goals.map((g) => {
                    const filteredTasks = g.tasks.filter((t) => {
                      if (filter === "completed") return t.status === "completed";
                      if (filter === "upcoming") return t.status !== "completed";
                      return true;
                    });

                    if (filteredTasks.length === 0) return null;

                    return (
                      <div key={g._id} className="bg-card border border-border/50 rounded-2xl p-5 flex flex-col gap-4 shadow-sm">
                        <div className="flex items-center justify-between border-b border-border/20 pb-2">
                          <div className="flex flex-col">
                            <span className="font-sans text-[10px] text-accent/80 font-bold uppercase tracking-wider">
                              Goal Area
                            </span>
                            <span className="font-sans text-sm font-semibold text-foreground tracking-wide mt-0.5">
                              {g.title}
                            </span>
                          </div>
                          <span className="font-sans text-[10px] text-muted-foreground">
                            {g.progress || 0}% complete
                          </span>
                        </div>

                        {/* Task List */}
                        <div className="space-y-3.5">
                          {filteredTasks.map((t) => {
                            const isCompleted = t.status === "completed";
                            return (
                              <div
                                key={t._id}
                                onClick={() => handleToggleTask(t._id, t.status)}
                                className={`flex items-start gap-4 p-3.5 rounded-xl border cursor-pointer transition-all hover:bg-secondary/20 ${
                                  isCompleted
                                    ? "bg-secondary/30 border-border/30 opacity-70"
                                    : "bg-background/40 border-border hover:border-accent/35"
                                }`}
                              >
                                <button
                                  type="button"
                                  className={`h-5 w-5 rounded-full flex items-center justify-center shrink-0 border transition-all duration-300 mt-0.5 ${
                                    isCompleted
                                      ? "bg-accent border-accent text-foreground"
                                      : "border-muted-foreground/30 text-transparent"
                                  }`}
                                >
                                  {isCompleted && <Check size={11} className="text-primary-foreground stroke-[3px]" />}
                                </button>

                                <div className="flex-1 flex flex-col gap-1 min-w-0">
                                  <span
                                    className={`font-sans text-xs font-medium tracking-wide transition-all ${
                                      isCompleted ? "line-through text-muted-foreground" : "text-foreground"
                                    }`}
                                  >
                                    {t.title}
                                  </span>
                                  {t.description && (
                                    <p className="font-sans text-[10px] text-muted-foreground/80 leading-relaxed">
                                      {t.description}
                                    </p>
                                  )}
                                  <div className="flex items-center gap-4 mt-1 text-[9px] text-muted-foreground/60 font-sans">
                                    {t.estimatedDuration && (
                                      <span className="flex items-center gap-1">
                                        <Clock size={10} className="text-accent/80" />
                                        {t.estimatedDuration}
                                      </span>
                                    )}
                                    {t.dependencies && t.dependencies.length > 0 && (
                                      <span>Depends: {t.dependencies.join(", ")}</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>

              </div>
            ) : (
              <div className="h-40 flex items-center justify-center text-muted-foreground font-sans text-xs border border-dashed border-border rounded-2xl">
                Select a milestone to display tasks.
              </div>
            )}
          </div>
        </section>

        {/* Diagnostics Mode */}
        {devMode && activePlan.diagnostics && (
          <section className="border border-red-500/20 bg-red-500/5 rounded-2xl p-6 flex flex-col gap-4">
            <div className="flex items-center gap-2 border-b border-red-500/10 pb-2 text-red-500/80 font-sans text-xs font-bold uppercase tracking-wider">
              <AlertCircle size={14} /> Developer Diagnostics Panel
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-xs font-mono text-muted-foreground border-b border-red-500/10 pb-4">
              <div>Plan ID: {activePlan._id}</div>
              <div>Execution Time: {activePlan.diagnostics.executionTimeMs}ms</div>
              <div>Plan Type: {activePlan.type}</div>
              <div>Milestones In DB: {activePlan.milestones.length}</div>
            </div>

            <div className="flex flex-col gap-2">
              <span className="font-sans text-xs font-semibold text-foreground">Planning Prompt</span>
              <pre className="p-3 bg-background border rounded-lg text-[10px] font-mono overflow-x-auto text-muted-foreground whitespace-pre-wrap max-h-48">
                {activePlan.diagnostics.planningPrompt}
              </pre>
            </div>

            <div className="flex flex-col gap-2">
              <span className="font-sans text-xs font-semibold text-foreground">Raw Gemini Output</span>
              <pre className="p-3 bg-background border rounded-lg text-[10px] font-mono overflow-x-auto text-muted-foreground whitespace-pre-wrap max-h-48">
                {activePlan.diagnostics.rawGeminiOutput}
              </pre>
            </div>

            <div className="flex flex-col gap-2">
              <span className="font-sans text-xs font-semibold text-foreground">Normalized Plan Tree</span>
              <pre className="p-3 bg-background border rounded-lg text-[10px] font-mono overflow-x-auto text-muted-foreground whitespace-pre-wrap max-h-48">
                {activePlan.diagnostics.normalizedPlan}
              </pre>
            </div>
          </section>
        )}

      </div>
    </div>
  );
}
