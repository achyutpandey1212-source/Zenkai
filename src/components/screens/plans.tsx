"use client";

import React, { useState, useEffect } from "react";
import { Check, Clock, AlertCircle, Play, Sparkles } from "lucide-react";

interface TaskData {
  _id: string;
  title: string;
  description?: string;
  status: "todo" | "in_progress" | "completed" | "missed";
  priority: number;
  estimatedDuration?: string;
  dependencies?: string[];
  completedAt?: string;
  suggestedDate?: string;
  timeBlock?: string;
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
  startDate?: string;
  endDate?: string;
  category?: string;
  importance?: number;
  flexibility?: number;
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
    plannerReasoning?: string;
    detectedConstraints?: string;
    mergeStrategy?: string;
    timelineRecalculation?: string;
  };
  history?: Array<{
    timestamp: string;
    changeSummary: string;
    snapshot: string;
  }>;
  milestones: MilestoneData[];
  createdAt: string;
  updatedAt: string;
}

export default function Plans() {
  const [plans, setPlans] = useState<PlanData[]>([]);
  const [loading, setLoading] = useState(true);
  const [activePlanId, setActivePlanId] = useState<string | null>(null);
  const [selectedRevisionIndex, setSelectedRevisionIndex] = useState<number | null>(null);
  const [animatingMilestoneId, setAnimatingMilestoneId] = useState<string | null>(null);
  const [lineAnimationProgress, setLineAnimationProgress] = useState(false);
  const [pulseMilestoneId, setPulseMilestoneId] = useState<string | null>(null);
  const [devMode, setDevMode] = useState(false);
  const [filter, setFilter] = useState<"all" | "upcoming" | "completed">("all");
 
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
 
  useEffect(() => {
    setSelectedRevisionIndex(null);
  }, [activePlanId]);
 
  const handleToggleTask = async (taskId: string, currentStatus: string) => {
    const newStatus = currentStatus === "completed" ? "todo" : "completed";
    
    // Check if this task toggle triggers milestone completion
    let transitioningMilestoneId: string | null = null;
    let nextMilestoneId: string | null = null;
    
    const active = plans.find((p) => p._id === activePlanId) || plans[0];
    const planToUse = selectedRevisionIndex !== null && active.history?.[selectedRevisionIndex]
      ? JSON.parse(active.history[selectedRevisionIndex].snapshot)
      : active;
      
    const activeM = (planToUse.milestones || []).filter(
      (m: any) => selectedRevisionIndex !== null || m.status !== "cancelled"
    );

    const sorted = [...activeM].sort((a: any, b: any) => {
      const dateA = a.startDate ? new Date(a.startDate).getTime() : 0;
      const dateB = b.startDate ? new Date(b.startDate).getTime() : 0;
      return dateA - dateB;
    });

    for (let i = 0; i < sorted.length; i++) {
      const m = sorted[i];
      const task = m.goals.flatMap((g: any) => g.tasks).find((t: any) => t._id === taskId);
      if (task) {
        const allTasks = m.goals.flatMap((g: any) => g.tasks);
        const otherTasksCompleted = allTasks.filter((t: any) => t._id !== taskId).every((t: any) => t.status === "completed");
        if (newStatus === "completed" && otherTasksCompleted) {
          transitioningMilestoneId = m._id;
          if (i < sorted.length - 1) {
            nextMilestoneId = sorted[i + 1]._id;
          }
        }
        break;
      }
    }

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

      // Trigger animations sequentially if milestone is transitioning to completed
      if (transitioningMilestoneId) {
        setAnimatingMilestoneId(transitioningMilestoneId);
        setLineAnimationProgress(false);

        // Phase 1: Node checkmark transition (300ms)
        setTimeout(() => {
          setLineAnimationProgress(true);

          // Phase 2: Connecting branch line fills to next milestone (500ms)
          setTimeout(() => {
            setAnimatingMilestoneId(null);
            setLineAnimationProgress(false);

            // Phase 3: Pulse/Glow the next recommended milestone (2000ms)
            if (nextMilestoneId) {
              setPulseMilestoneId(nextMilestoneId);
              setTimeout(() => {
                setPulseMilestoneId(null);
              }, 2500);
            }
          }, 500);
        }, 300);
      }
 
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
 
  // Version control snapshot mapping
  let planToRender = activePlan;
  if (selectedRevisionIndex !== null && activePlan.history?.[selectedRevisionIndex]) {
    try {
      planToRender = JSON.parse(activePlan.history[selectedRevisionIndex].snapshot);
    } catch (e) {
      console.error("Failed to parse history snapshot:", e);
    }
  }
 
  const activeMilestones = (planToRender.milestones || []).filter(
    (m) => selectedRevisionIndex !== null || m.status !== "cancelled"
  );

  // Chronological Milestone sorting (pure chronological sort)
  const sortedMilestones = [...activeMilestones].sort((a, b) => {
    const dateA = a.startDate ? new Date(a.startDate).getTime() : 0;
    const dateB = b.startDate ? new Date(b.startDate).getTime() : 0;
    return dateA - dateB;
  });

  // Urgency stats & answering questions
  const totalMilestonesCount = sortedMilestones.length;
  const completedMilestonesCount = sortedMilestones.filter((m) => m.status === "completed").length;
  
  // What should I do next? (First incomplete milestone)
  const nextMilestone = sortedMilestones.find((m) => m.status !== "completed" && m.status !== "cancelled");

  // Am I on track?
  const isOnTrack = planToRender.progress > 0 || totalMilestonesCount === 0;

  const categoryIcons: Record<string, string> = {
    Exam: "🎓",
    Study: "📚",
    Hackathon: "🏆",
    Meetup: "🤝",
    "Content Creation": "🎥",
    Content: "🎥",
    Startup: "🚀",
    Reading: "📖",
    Fitness: "🏋",
    Interview: "📝",
    Personal: "👤",
    Coding: "💻"
  };

  const categoryBorders: Record<string, string> = {
    Exam: "border-red-500/30 text-red-400 bg-red-500/5",
    Study: "border-teal-500/30 text-teal-400 bg-teal-500/5",
    Hackathon: "border-amber-500/30 text-amber-400 bg-amber-500/5",
    Meetup: "border-purple-500/30 text-purple-400 bg-purple-500/5",
    "Content Creation": "border-pink-500/30 text-pink-400 bg-pink-500/5",
    Content: "border-pink-500/30 text-pink-400 bg-pink-500/5",
    Startup: "border-emerald-500/30 text-emerald-400 bg-emerald-500/5",
    Reading: "border-indigo-500/30 text-indigo-400 bg-indigo-500/5",
    Fitness: "border-orange-500/30 text-orange-400 bg-orange-500/5",
    Interview: "border-cyan-500/30 text-cyan-400 bg-cyan-500/5",
    Personal: "border-neutral-500/30 text-neutral-400 bg-neutral-500/5",
    Coding: "border-blue-500/30 text-blue-400 bg-blue-500/5"
  };

  const getStars = (importance?: number) => {
    const starCount = Math.max(1, Math.min(5, Math.ceil((importance || 5) / 2)));
    return "★".repeat(starCount) + "☆".repeat(5 - starCount);
  };

  const formatDateLabel = (dateStr?: string) => {
    if (!dateStr) return "TBD";
    const date = new Date(dateStr);
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  return (
    <div className="h-full w-full overflow-y-auto p-6 md:p-12 lg:p-16 flex flex-col items-center bg-background scrollbar-none transition-all duration-1000 animate-slide-down-fade">
      <div className="max-w-3xl w-full flex flex-col gap-10 mt-4 pb-24">
        
        {/* Header Block */}
        <header className="flex flex-col gap-2 relative">
          <div className="flex items-center justify-between">
            <span className="font-sans text-[10px] tracking-[0.25em] text-accent font-semibold uppercase">
              STRATEGY ROADMAP
            </span>
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
          </div>
          <h1 className="font-heading text-4xl md:text-5xl font-light text-foreground tracking-wide">
            {planToRender.title}
          </h1>
          <p className="font-sans text-xs text-muted-foreground leading-relaxed">
            {planToRender.description || "A structured execution roadmap automatically designed around your goals."}
          </p>
        </header>

        {/* Plan Version History Selector */}
        {activePlan.history && activePlan.history.length > 0 && (
          <section className="flex flex-col gap-3 border-b border-border/20 pb-5">
            <span className="font-sans text-[10px] tracking-wider text-accent/80 font-bold uppercase">
              Plan Evolution History
            </span>
            <div className="flex items-center gap-2 overflow-x-auto py-1 scrollbar-none">
              <button
                onClick={() => setSelectedRevisionIndex(null)}
                className={`shrink-0 font-sans text-xs px-3 py-1.5 rounded-full border transition-all ${
                  selectedRevisionIndex === null
                    ? "bg-accent/15 border-accent text-accent font-semibold"
                    : "border-border/60 hover:border-accent text-muted-foreground hover:text-foreground"
                }`}
              >
                Current Active Plan
              </button>
              {activePlan.history.map((rev, index) => {
                const isSelected = selectedRevisionIndex === index;
                const formattedDate = new Date(rev.timestamp).toLocaleDateString([], {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit"
                });
                return (
                  <button
                    key={index}
                    onClick={() => setSelectedRevisionIndex(index)}
                    className={`shrink-0 font-sans text-xs px-3 py-1.5 rounded-full border transition-all flex items-center gap-2 ${
                      isSelected
                        ? "bg-accent/15 border-accent text-accent font-semibold"
                        : "border-border/40 hover:border-accent text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <span className="text-[10px] opacity-60">v{index + 1}</span>
                    <span>{rev.changeSummary}</span>
                    <span className="text-[9px] opacity-50">({formattedDate})</span>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* Cognitive Dashboard: Answers 3 Key Questions */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4 border-b border-border/20 pb-8">
          {/* Question 1: What have I finished? */}
          <div className="bg-secondary/20 border border-border/40 p-4 rounded-xl flex flex-col gap-1.5">
            <span className="font-sans text-[9px] tracking-wider text-muted-foreground uppercase">What have I finished?</span>
            <div className="font-heading text-lg font-light text-foreground">
              {completedMilestonesCount} of {totalMilestonesCount} Milestones
            </div>
            <div className="w-full bg-secondary/80 h-1.5 rounded-full overflow-hidden">
              <div 
                className="bg-green-500 h-full rounded-full transition-all duration-1000"
                style={{ width: `${totalMilestonesCount ? (completedMilestonesCount / totalMilestonesCount) * 100 : 0}%` }}
              />
            </div>
            <span className="font-sans text-[9px] text-muted-foreground/60">{planToRender.progress}% of total tasks completed</span>
          </div>

          {/* Question 2: What should I do next? */}
          <div className="bg-secondary/20 border border-border/40 p-4 rounded-xl flex flex-col gap-1.5 relative overflow-hidden group">
            <span className="font-sans text-[9px] tracking-wider text-muted-foreground uppercase">What should I do next?</span>
            {nextMilestone ? (
              <>
                <div className="font-heading text-[13px] font-medium text-accent tracking-wide line-clamp-1">
                  {nextMilestone.title}
                </div>
                <span className="font-sans text-[9px] text-muted-foreground/80 flex items-center gap-1">
                  <Clock size={10} /> Starting {formatDateLabel(nextMilestone.startDate)}
                </span>
                {/* Pulse indicator */}
                <div className="absolute top-2 right-2 h-1.5 w-1.5 rounded-full bg-accent animate-ping" />
              </>
            ) : (
              <span className="font-sans text-xs text-green-400 italic">All milestones completed!</span>
            )}
          </div>

          {/* Question 3: Am I on track? */}
          <div className="bg-secondary/20 border border-border/40 p-4 rounded-xl flex flex-col gap-1.5 items-start justify-center">
            <span className="font-sans text-[9px] tracking-wider text-muted-foreground uppercase">Am I on track?</span>
            <div className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${isOnTrack ? "bg-green-500 animate-pulse" : "bg-amber-500"}`} />
              <span className="font-heading text-lg font-light text-foreground">
                {isOnTrack ? "On Track" : "Needs Focus"}
              </span>
            </div>
            <span className="font-sans text-[9px] text-muted-foreground/60">Adapting rhythm to your daily availability</span>
          </div>
        </section>

        {/* Unified Chronological Itinerary Timeline */}
        <section className="relative flex flex-col pl-6 space-y-12">
          
          {sortedMilestones.map((m, mIdx) => {
            const isCompleted = m.status === "completed";
            const isCancelled = m.status === "cancelled";
            const isNext = nextMilestone && nextMilestone._id === m._id;
            
            // Check dynamic animation/pulse states
            const isAnimating = animatingMilestoneId === m._id;
            const isPulsing = pulseMilestoneId === m._id;

            const catIcon = categoryIcons[m.category || "Personal"] || "👤";
            const catBorder = categoryBorders[m.category || "Personal"] || "border-border/40 text-muted-foreground";

            // Next focus glow animation state
            const borderGlowClass = isPulsing
              ? "animate-milestone-next-glow shadow-[0_0_20px_rgba(201,168,106,0.2)]"
              : isNext
              ? "border-accent/40 shadow-[0_0_15px_rgba(201,168,106,0.06)]"
              : "border-border/50";

            // Node checkmark color classes
            const timelineNodeColor = (isCompleted || isAnimating)
              ? "bg-green-500 border-green-500 scale-110"
              : isCancelled
              ? "bg-red-500/40 border-red-500/40"
              : (isNext || isPulsing)
              ? "bg-accent border-accent scale-110 shadow-[0_0_12px_rgba(201,168,106,0.65)]"
              : "bg-background border-muted-foreground/30";

            // Flow line progress calculation
            const isLast = mIdx === sortedMilestones.length - 1;
            const isLineCompleted = isCompleted && !isAnimating;
            const lineFillHeight = isLineCompleted
              ? "100%"
              : (isAnimating && lineAnimationProgress)
              ? "100%"
              : "0%";

            return (
              <div 
                key={m._id} 
                className={`relative flex flex-col gap-4 transition-all duration-700 ${
                  isCompleted ? "opacity-60" : "opacity-100"
                }`}
              >
                
                {/* Individual vertical connecting branch segment to next milestone */}
                {!isLast && (
                  <div className="absolute left-[-17px] top-8 bottom-[-56px] w-[2px] bg-border/20 z-0">
                    {/* Animated Green progress fill overlay */}
                    <div 
                      className="w-full bg-green-500 transition-all duration-[500ms] ease-in-out origin-top"
                      style={{ height: lineFillHeight }}
                    />
                  </div>
                )}

                {/* Timeline node checkmark indicator */}
                <div 
                  className={`absolute -left-[24px] top-4 h-4.5 w-4.5 rounded-full border-2 flex items-center justify-center transition-all duration-[300ms] ease-in-out z-10 ${timelineNodeColor}`}
                >
                  {(isCompleted || isAnimating) && (
                    <Check size={9} className="text-primary-foreground stroke-[3.5px] transition-all duration-300 animate-slide-down-fade" />
                  )}
                </div>

                {/* Itinerary Milestone Card */}
                <div 
                  className={`bg-card border rounded-2xl p-6 flex flex-col gap-4 shadow-sm transition-all duration-500 ${borderGlowClass}`}
                >
                  {/* Card Header */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-border/20 pb-3">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-sans text-[10px] tracking-wider text-muted-foreground/80 uppercase font-semibold">
                          {formatDateLabel(m.startDate)} — {formatDateLabel(m.endDate)}
                        </span>
                        {m.category && (
                          <span className={`px-2.5 py-0.5 border rounded-full text-[8px] font-semibold uppercase tracking-wider ${catBorder}`}>
                            {catIcon} {m.category}
                          </span>
                        )}
                        {isNext && (
                          <span className="px-2 py-0.5 border border-accent/40 text-accent bg-accent/5 rounded-full text-[8px] font-bold uppercase tracking-wider flex items-center gap-1 animate-pulse">
                            <Sparkles size={8} /> NEXT FOCUS
                          </span>
                        )}
                      </div>
                      <h3 className={`font-heading text-lg font-normal tracking-wide transition-all ${
                        isCompleted ? "line-through text-muted-foreground" : "text-foreground"
                      }`}>
                        {m.title}
                      </h3>
                      {m.description && (
                        <p className="font-sans text-xs text-muted-foreground/80 leading-relaxed mt-0.5">
                          {m.description}
                        </p>
                      )}
                    </div>
                    
                    {/* Metadata: Stars, Progress */}
                    <div className="flex flex-col items-end shrink-0 gap-1 font-sans text-xs text-muted-foreground/70">
                      <div className="flex items-center gap-1">
                        <span className="text-[9px] uppercase tracking-wider text-muted-foreground/50">Priority:</span>
                        <span className="text-accent text-[11px] tracking-widest select-none">{getStars(m.importance)}</span>
                      </div>
                      <div className="text-[10px]">
                        Milestone progress: <strong className="text-foreground">{m.progress || 0}%</strong>
                      </div>
                    </div>
                  </div>

                  {/* Tasks list within this milestone */}
                  <div className="space-y-6">
                    {m.goals.map((g) => {
                      if (g.tasks.length === 0) return null;
                      return (
                        <div key={g._id} className="flex flex-col gap-3">
                          <span className="font-sans text-[9px] tracking-wider text-muted-foreground/50 uppercase font-bold">
                            Goal Area: {g.title}
                          </span>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {g.tasks.map((t) => {
                              const isTaskCompleted = t.status === "completed";
                              return (
                                <div
                                  key={t._id}
                                  onClick={() => handleToggleTask(t._id, t.status)}
                                  className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all duration-500 hover:bg-secondary/20 ${
                                    isTaskCompleted
                                      ? "bg-secondary/20 border-border/30 opacity-70"
                                      : "bg-background/45 border-border hover:border-accent/40"
                                  }`}
                                >
                                  {/* Checkbox */}
                                  <button
                                    type="button"
                                    className={`h-4.5 w-4.5 rounded-full flex items-center justify-center shrink-0 border transition-all duration-300 mt-0.5 ${
                                      isTaskCompleted
                                        ? "bg-green-500 border-green-500 text-foreground"
                                        : "border-muted-foreground/30 text-transparent hover:border-accent"
                                    }`}
                                  >
                                    {isTaskCompleted && <Check size={10} className="text-primary-foreground stroke-[3px]" />}
                                  </button>

                                  <div className="flex-1 flex flex-col gap-0.5 min-w-0">
                                    <span
                                      className={`font-sans text-[13px] font-medium tracking-wide transition-all duration-500 ${
                                        isTaskCompleted ? "line-through text-muted-foreground/60" : "text-foreground"
                                      }`}
                                    >
                                      {t.title}
                                    </span>
                                    {t.description && (
                                      <p className="font-sans text-[10px] text-muted-foreground/80 leading-relaxed">
                                        {t.description}
                                      </p>
                                    )}
                                    <div className="flex items-center gap-3 mt-1 text-[9px] text-muted-foreground/50 font-sans flex-wrap">
                                      {t.suggestedDate && (
                                        <span className="flex items-center gap-1 text-accent/80 font-medium">
                                          <Clock size={9} />
                                          {formatDateLabel(t.suggestedDate)} {t.timeBlock ? `[${t.timeBlock}]` : ""}
                                        </span>
                                      )}
                                      {t.estimatedDuration && (
                                        <span>Est: {t.estimatedDuration}</span>
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
              </div>
            );
          })}
        </section>

        {/* Diagnostics Panel (Developer Mode) */}
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

            {activePlan.diagnostics.plannerReasoning && (
              <div className="flex flex-col gap-2">
                <span className="font-sans text-xs font-semibold text-foreground">Planner Reasoning</span>
                <p className="font-sans text-xs text-muted-foreground leading-relaxed font-mono text-[11px] whitespace-pre-wrap">
                  {activePlan.diagnostics.plannerReasoning}
                </p>
              </div>
            )}

            {activePlan.diagnostics.detectedConstraints && (
              <div className="flex flex-col gap-2">
                <span className="font-sans text-xs font-semibold text-foreground">Detected Constraints</span>
                <p className="font-sans text-xs text-muted-foreground leading-relaxed font-mono text-[11px] whitespace-pre-wrap">
                  {activePlan.diagnostics.detectedConstraints}
                </p>
              </div>
            )}

            {activePlan.diagnostics.mergeStrategy && (
              <div className="flex flex-col gap-2">
                <span className="font-sans text-xs font-semibold text-foreground">Merge & Evolution Strategy</span>
                <p className="font-sans text-xs text-muted-foreground leading-relaxed font-mono text-[11px] whitespace-pre-wrap">
                  {activePlan.diagnostics.mergeStrategy}
                </p>
              </div>
            )}
            
            <div className="flex flex-col gap-2">
              <span className="font-sans text-xs font-semibold text-foreground">Planning Prompt</span>
              <pre className="p-3 bg-background border rounded-lg text-[10px] font-mono overflow-x-auto text-muted-foreground whitespace-pre-wrap max-h-48">
                {activePlan.diagnostics.planningPrompt}
              </pre>
            </div>
          </section>
        )}

      </div>
    </div>
  );
}
