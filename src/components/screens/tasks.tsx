"use client";

import React, { useState, useEffect } from "react";
import { Check, Clock, Calendar, AlertCircle, ChevronDown, ChevronUp, RefreshCw, Trash2, ArrowRight } from "lucide-react";

interface TaskData {
  _id: string;
  title: string;
  description?: string;
  status: "todo" | "in_progress" | "completed" | "skipped" | "deferred" | "blocked" | "missed";
  priority: number;
  estimatedMinutes?: number;
  estimatedDuration?: string;
  suggestedDate?: string;
  timeBlock?: string;
  deferredCount?: number;
  googleCalendarEventId?: string;
  googleCalendarConflict?: boolean;
}

interface WorkBlock {
  title: string;
  startTime: string;
  endTime: string;
  tasks: TaskData[];
}

interface AgendaData {
  _id: string;
  date: string;
  intention: string;
  focus: string;
  workBlocks: WorkBlock[];
  optionalTasks: TaskData[];
  stretchGoals: TaskData[];
  estimatedFocusTime: number;
  currentPriority: string;
  upcomingDeadline: string;
  executionReasoning: string;
  deferredExplanation?: string;
  diagnostics?: {
    priorityCalculations?: string;
    constraintEvaluation?: string;
    deferredLogic?: string;
    workBlockGeneration?: string;
    executionTimeMs?: number;
  };
}

interface TasksProps {
  userName: string;
}

export default function Tasks({ userName }: TasksProps) {
  const [agenda, setAgenda] = useState<AgendaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showRescheduleId, setShowRescheduleId] = useState<string | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);

  // Fetch agenda
  const fetchAgenda = async () => {
    try {
      const res = await fetch("/api/execution/agenda");
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setAgenda(data.agenda);
        }
      }
    } catch (err) {
      console.error("Failed to fetch daily agenda:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAgenda();
  }, []);

  const handleTaskAction = async (taskId: string, action: string, extraBody = {}) => {
    try {
      const res = await fetch("/api/execution/task-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, action, ...extraBody })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.agenda) {
          setAgenda(data.agenda);
        }
      }
    } catch (err) {
      console.error(`Failed to execute task action: ${action}`, err);
    }
  };

  const handleRegenerate = async () => {
    setIsRegenerating(true);
    try {
      const res = await fetch("/api/execution/agenda", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setAgenda(data.agenda);
        }
      }
    } catch (err) {
      console.error("Failed to regenerate daily agenda:", err);
    } finally {
      setIsRegenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-6 w-6 rounded-full border-2 border-accent border-t-transparent animate-spin" />
          <span className="font-sans text-xs tracking-wider text-muted-foreground uppercase">Organizing Today's Work...</span>
        </div>
      </div>
    );
  }

  // Calculate completed tasks today
  const getCompletedTasks = () => {
    if (!agenda) return [];
    const completedList: TaskData[] = [];
    const addIfCompleted = (t: TaskData) => {
      if (t.status === "completed") completedList.push(t);
    };

    agenda.workBlocks.forEach(wb => wb.tasks.forEach(addIfCompleted));
    agenda.optionalTasks.forEach(addIfCompleted);
    agenda.stretchGoals.forEach(addIfCompleted);
    return completedList;
  };

  const getDeferredTasks = () => {
    if (!agenda) return [];
    const deferredList: TaskData[] = [];
    const addIfDeferred = (t: TaskData) => {
      if (t.status === "deferred" || t.status === "skipped") deferredList.push(t);
    };

    agenda.workBlocks.forEach(wb => wb.tasks.forEach(addIfDeferred));
    agenda.optionalTasks.forEach(addIfDeferred);
    agenda.stretchGoals.forEach(addIfDeferred);
    return deferredList;
  };

  const getRepeatedlyDeferredTasks = () => {
    if (!agenda) return [];
    const list: TaskData[] = [];
    const checkCount = (t: TaskData) => {
      if ((t.deferredCount || 0) >= 3 && t.status !== "completed") list.push(t);
    };

    agenda.workBlocks.forEach(wb => wb.tasks.forEach(checkCount));
    agenda.optionalTasks.forEach(checkCount);
    agenda.stretchGoals.forEach(checkCount);
    return list;
  };

  const completedToday = getCompletedTasks();
  const deferredToday = getDeferredTasks();
  const repeatedlyDeferred = getRepeatedlyDeferredTasks();

  const totalCriticalTasks = agenda ? agenda.workBlocks.reduce((acc, wb) => acc + wb.tasks.length, 0) : 0;
  const completedCriticalTasks = agenda ? agenda.workBlocks.reduce((acc, wb) => acc + wb.tasks.filter(t => t.status === "completed").length, 0) : 0;
  const allCriticalCompleted = totalCriticalTasks > 0 && completedCriticalTasks === totalCriticalTasks;

  return (
    <div className="h-full w-full overflow-y-auto p-6 md:p-12 bg-background flex flex-col items-center">
      <div className="max-w-4xl w-full flex flex-col gap-10 mt-4 pb-20">
        
        {/* Header: Intention & Overarching Focus */}
        <header className="flex flex-col gap-5 border-b border-border/40 pb-8 relative">
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1">
              <span className="font-sans text-[10px] tracking-[0.25em] text-accent font-semibold uppercase">
                Daily Execution
              </span>
              <h1 className="font-heading text-4xl md:text-5xl font-light text-foreground italic mt-2">
                Today's Intention
              </h1>
            </div>
            
            <button
              onClick={handleRegenerate}
              disabled={isRegenerating}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border/80 hover:bg-secondary/40 text-[10px] text-muted-foreground hover:text-foreground font-sans transition-all duration-200"
            >
              <RefreshCw size={11} className={isRegenerating ? "animate-spin text-accent" : "text-accent/80"} />
              {isRegenerating ? "Balancing..." : "Rebalance Day"}
            </button>
          </div>

          <p className="font-heading text-xl md:text-2xl font-light text-muted-foreground leading-relaxed italic border-l-2 border-accent/30 pl-4 py-1">
            "{agenda?.intention || "Today is about making steady progress toward your core objectives."}"
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
            <div className="flex flex-col bg-secondary/30 border border-border/20 p-4 rounded-xl">
              <span className="font-sans text-[9px] uppercase tracking-wider text-accent/80 font-bold">Today's Focus</span>
              <span className="font-sans text-xs font-semibold mt-1 text-foreground/90">{agenda?.focus || "Core study and development tasks"}</span>
            </div>
            <div className="flex flex-col bg-secondary/30 border border-border/20 p-4 rounded-xl">
              <span className="font-sans text-[9px] uppercase tracking-wider text-accent/80 font-bold">Planned Focus Hours</span>
              <span className="font-sans text-xs font-semibold mt-1 text-foreground/90">
                {agenda ? Math.round(agenda.estimatedFocusTime / 60 * 10) / 10 : 0} hours ({agenda?.estimatedFocusTime || 0}m)
              </span>
            </div>
          </div>
        </header>

        {/* Alerts for repeatedly deferred tasks */}
        {repeatedlyDeferred.length > 0 && (
          <div className="flex flex-col gap-3 p-5 rounded-2xl border border-red-500/20 bg-red-500/5 animate-fade-in">
            <span className="font-sans text-[9px] font-bold text-red-500 uppercase tracking-widest flex items-center gap-1.5">
              <AlertCircle size={12} /> Postponed Tasks Alert
            </span>
            <div className="space-y-4">
              {repeatedlyDeferred.map(task => (
                <div key={task._id} className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-border/10 pb-3 last:border-0 last:pb-0">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-sans text-xs font-semibold text-foreground/90">
                      {task.title}
                    </span>
                    <span className="font-sans text-[10px] text-muted-foreground/75">
                      This task has been postponed {task.deferredCount} times.
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleTaskAction(task._id, "reschedule", { newDate: new Date(Date.now() + 86400000 * 2).toISOString().split("T")[0] })}
                      className="px-3 py-1 rounded-full bg-secondary hover:bg-secondary-foreground hover:text-secondary text-[10px] font-sans font-semibold transition-all duration-200"
                    >
                      Reschedule
                    </button>
                    <button
                      onClick={() => handleTaskAction(task._id, "remove")}
                      className="px-3 py-1 rounded-full bg-red-500/10 hover:bg-red-500 hover:text-white text-red-400 text-[10px] font-sans font-semibold transition-all duration-200"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Critical Work Blocks */}
        <section className="flex flex-col gap-6">
          <div className="flex items-center justify-between border-b border-border/20 pb-2">
            <h2 className="font-heading text-2xl font-light text-foreground">
              Today's Work Blocks
            </h2>
            {allCriticalCompleted && (
              <span className="font-sans text-[9px] font-bold text-accent uppercase tracking-widest flex items-center gap-1.5 bg-accent/10 px-2 py-0.5 rounded-full">
                ✦ All Critical Complete
              </span>
            )}
          </div>

          <div className="space-y-6">
            {agenda?.workBlocks.map((block, index) => (
              <div key={index} className="flex flex-col bg-card border border-border p-6 rounded-2xl shadow-sm hover:shadow transition-all">
                <div className="flex items-center justify-between border-b border-border/10 pb-3 mb-4">
                  <h3 className="font-sans text-sm font-semibold tracking-wide text-foreground/90">
                    {block.title}
                  </h3>
                  <span className="font-sans text-[10px] text-accent/90 font-medium flex items-center gap-1">
                    <Clock size={11} /> {block.startTime} — {block.endTime}
                  </span>
                </div>

                <div className="space-y-4">
                  {block.tasks.length === 0 ? (
                    <span className="font-sans text-xs text-muted-foreground italic">No critical tasks scheduled in this session</span>
                  ) : (
                    block.tasks.map(task => {
                      const isCompleted = task.status === "completed";
                      return (
                        <div key={task._id} className="flex items-start justify-between gap-4 group">
                          <div className="flex items-start gap-3 min-w-0 flex-1">
                            <button
                              onClick={() => handleTaskAction(task._id, isCompleted ? "reschedule" : "complete", { newDate: agenda.date })}
                              className={`h-5 w-5 rounded-full flex items-center justify-center shrink-0 border transition-all mt-0.5 ${
                                isCompleted
                                  ? "bg-accent border-accent text-foreground"
                                  : "border-muted-foreground/30 text-transparent hover:border-accent"
                              }`}
                            >
                              {isCompleted && (
                                <svg className="w-3.5 h-3.5 text-primary-foreground stroke-[3px]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </button>
                            
                            <div className="flex flex-col min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`font-sans text-xs font-semibold tracking-wide text-foreground/90 ${isCompleted ? "line-through text-muted-foreground opacity-60" : ""}`}>
                                  {task.title}
                                </span>
                                {task.googleCalendarConflict ? (
                                  <span className="inline-flex items-center gap-0.5 text-[9px] text-amber-500 font-medium px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20" title="Conflict detected: Edited on Google Calendar. Resolve in Settings.">
                                    <Calendar size={9} /> Conflict
                                  </span>
                                ) : task.googleCalendarEventId ? (
                                  <span className="inline-flex items-center gap-0.5 text-[9px] text-green-500 font-medium px-1.5 py-0.5 rounded bg-green-500/10 border border-green-500/20" title="Synced with Google Calendar">
                                    <Calendar size={9} /> Synced
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-0.5 text-[9px] text-muted-foreground/50 font-medium px-1.5 py-0.5 rounded bg-secondary/40 border border-border/30" title="Pending Google Calendar Sync">
                                    <Calendar size={9} className="opacity-55" /> Pending Sync
                                  </span>
                                )}
                              </div>
                              {task.description && (
                                <p className="font-sans text-[10px] text-muted-foreground mt-0.5 leading-relaxed">
                                  {task.description}
                                </p>
                              )}
                            </div>
                          </div>

                          {!isCompleted && (
                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 shrink-0">
                              <button
                                onClick={() => handleTaskAction(task._id, "defer")}
                                className="px-2 py-0.5 rounded-full bg-secondary/80 hover:bg-secondary border border-border text-[9px] text-muted-foreground hover:text-foreground font-sans font-medium transition-all"
                              >
                                Defer
                              </button>
                              <button
                                onClick={() => handleTaskAction(task._id, "skip")}
                                className="px-2 py-0.5 rounded-full bg-secondary/80 hover:bg-secondary border border-border text-[9px] text-muted-foreground hover:text-foreground font-sans font-medium transition-all"
                              >
                                Skip
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Optional & Stretch Goals */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Optional Tasks */}
          <section className="flex flex-col bg-card border border-border p-6 rounded-2xl shadow-sm">
            <h3 className="font-sans text-sm font-semibold tracking-wide text-foreground/90 border-b border-border/10 pb-3 mb-4">
              Optional Work
            </h3>
            
            <div className="space-y-4">
              {agenda?.optionalTasks.length === 0 ? (
                <span className="font-sans text-xs text-muted-foreground italic">No optional tasks scheduled</span>
              ) : (
                agenda?.optionalTasks.map(task => {
                  const isCompleted = task.status === "completed";
                  return (
                    <div key={task._id} className="flex items-start justify-between gap-3 group">
                      <div className="flex items-start gap-2 min-w-0">
                        <button
                          onClick={() => handleTaskAction(task._id, isCompleted ? "reschedule" : "complete", { newDate: agenda.date })}
                          className={`h-4 w-4 rounded-full flex items-center justify-center shrink-0 border transition-all mt-0.5 ${
                            isCompleted
                              ? "bg-accent border-accent text-foreground"
                              : "border-muted-foreground/30 text-transparent hover:border-accent"
                          }`}
                        >
                          {isCompleted && (
                            <svg className="w-2.5 h-2.5 text-primary-foreground stroke-[3px]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </button>
                        <span className={`font-sans text-xs text-foreground/80 ${isCompleted ? "line-through text-muted-foreground opacity-60" : ""}`}>
                          {task.title}
                        </span>
                      </div>
                      
                      {!isCompleted && (
                        <button
                          onClick={() => handleTaskAction(task._id, "defer")}
                          className="opacity-0 group-hover:opacity-100 px-1.5 py-0.5 rounded bg-secondary text-[8px] text-muted-foreground hover:text-foreground font-sans transition-all"
                        >
                          Defer
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </section>

          {/* Stretch Goals */}
          <section className="flex flex-col bg-card border border-border p-6 rounded-2xl shadow-sm">
            <h3 className="font-sans text-sm font-semibold tracking-wide text-foreground/90 border-b border-border/10 pb-3 mb-4">
              Stretch Goals
            </h3>
            
            <div className="space-y-4">
              {agenda?.stretchGoals.length === 0 ? (
                <span className="font-sans text-xs text-muted-foreground italic">No stretch goals scheduled</span>
              ) : (
                agenda?.stretchGoals.map(task => {
                  const isCompleted = task.status === "completed";
                  return (
                    <div key={task._id} className="flex items-start justify-between gap-3 group">
                      <div className="flex items-start gap-2 min-w-0">
                        <button
                          onClick={() => handleTaskAction(task._id, isCompleted ? "reschedule" : "complete", { newDate: agenda.date })}
                          className={`h-4 w-4 rounded-full flex items-center justify-center shrink-0 border transition-all mt-0.5 ${
                            isCompleted
                              ? "bg-accent border-accent text-foreground"
                              : "border-muted-foreground/30 text-transparent hover:border-accent"
                          }`}
                        >
                          {isCompleted && (
                            <svg className="w-2.5 h-2.5 text-primary-foreground stroke-[3px]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </button>
                        <span className={`font-sans text-xs text-foreground/80 ${isCompleted ? "line-through text-muted-foreground opacity-60" : ""}`}>
                          {task.title}
                        </span>
                      </div>
                      
                      {!isCompleted && (
                        <button
                          onClick={() => handleTaskAction(task._id, "defer")}
                          className="opacity-0 group-hover:opacity-100 px-1.5 py-0.5 rounded bg-secondary text-[8px] text-muted-foreground hover:text-foreground font-sans transition-all"
                        >
                          Defer
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </section>
        </div>

        {/* Reasoning and Explanation */}
        <section className="bg-secondary/40 border border-border/40 p-5 rounded-2xl flex flex-col gap-2.5">
          <h4 className="font-sans text-[10px] font-bold tracking-wider text-accent uppercase flex items-center gap-1.5">
            Planner's Rationales
          </h4>
          <p className="font-sans text-xs text-muted-foreground leading-relaxed italic">
            "{agenda?.executionReasoning || "Scheduling structured around constraints and profile energy patterns."}"
          </p>
          {agenda?.deferredExplanation && (
            <p className="font-sans text-xs text-accent/80 leading-relaxed border-t border-border/10 pt-2.5 mt-0.5">
              💡 {agenda.deferredExplanation}
            </p>
          )}
        </section>

        {/* Developer Diagnostics mode */}
        <div className="border border-border/60 rounded-xl overflow-hidden mt-2">
          <button
            onClick={() => setShowDiagnostics(!showDiagnostics)}
            className="w-full flex items-center justify-between px-5 py-3.5 bg-secondary/30 hover:bg-secondary/50 font-sans text-xs text-muted-foreground font-semibold uppercase tracking-wider transition-all"
          >
            <span>Developer Mode & diagnostics</span>
            {showDiagnostics ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          
          {showDiagnostics && (
            <div className="bg-secondary/15 p-5 border-t border-border/40 space-y-5 font-mono text-[10px] text-muted-foreground leading-relaxed whitespace-pre-wrap">
              <div>
                <span className="text-accent font-bold">1. Priority Calculations:</span>
                <p className="mt-1 bg-background/50 p-3 rounded border border-border/20">{agenda?.diagnostics?.priorityCalculations || "N/A"}</p>
              </div>
              <div>
                <span className="text-accent font-bold">2. Constraint Evaluation:</span>
                <p className="mt-1 bg-background/50 p-3 rounded border border-border/20">{agenda?.diagnostics?.constraintEvaluation || "N/A"}</p>
              </div>
              <div>
                <span className="text-accent font-bold">3. Deferred Logic:</span>
                <p className="mt-1 bg-background/50 p-3 rounded border border-border/20">{agenda?.diagnostics?.deferredLogic || "N/A"}</p>
              </div>
              <div>
                <span className="text-accent font-bold">4. Work Block Generation:</span>
                <p className="mt-1 bg-background/50 p-3 rounded border border-border/20">{agenda?.diagnostics?.workBlockGeneration || "N/A"}</p>
              </div>
              <div className="text-[9px] text-muted-foreground/60 border-t border-border/10 pt-2">
                LLM Inference Time: {agenda?.diagnostics?.executionTimeMs || 0}ms
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
