"use client";

import React, { useState, useEffect } from "react";
import { Check, Clock, Calendar, AlertCircle, RefreshCw } from "lucide-react";

interface TaskData {
  _id: string;
  title: string;
  description?: string;
  status: "todo" | "in_progress" | "completed" | "skipped" | "deferred" | "blocked" | "missed";
  priority: number;
  estimatedMinutes?: number;
  deferredCount?: number;
}

interface WorkBlock {
  title: string;
  startTime: string;
  endTime: string;
  tasks: TaskData[];
}

interface DaySchedule {
  date: string;
  focusTheme: string;
  estimatedWorkload: string;
  plannedFocusHours: number;
  workBlocks: WorkBlock[];
}

interface TasksProps {
  userName: string;
}

export default function Tasks({ userName }: TasksProps) {
  const [weeklySchedule, setWeeklySchedule] = useState<any | null>(null);
  const [selectedDateStr, setSelectedDateStr] = useState<string>("");
  const [activeDay, setActiveDay] = useState<DaySchedule | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRegenerating, setIsRegenerating] = useState(false);

  const fetchWeeklySchedule = async () => {
    try {
      const res = await fetch("/api/execution/agenda", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.weeklySchedule) {
          setWeeklySchedule(data.weeklySchedule);
          if (!selectedDateStr) {
            const todayStr = new Date().toLocaleDateString("en-CA");
            const hasToday = data.weeklySchedule.days.some((d: any) => d.date === todayStr);
            if (hasToday) {
              setSelectedDateStr(todayStr);
            } else if (data.weeklySchedule.days.length > 0) {
              setSelectedDateStr(data.weeklySchedule.days[0].date);
            }
          }
        }
      }
    } catch (err) {
      console.error("Failed to load weekly schedule:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWeeklySchedule();
  }, []);

  useEffect(() => {
    if (weeklySchedule && selectedDateStr) {
      const dayBlock = weeklySchedule.days.find((d: any) => d.date === selectedDateStr);
      setActiveDay(dayBlock || null);
    }
  }, [weeklySchedule, selectedDateStr]);

  const handleTaskAction = async (taskId: string, action: string, extraBody = {}) => {
    const previousWeekly = weeklySchedule;
    // Optimistic update
    if (weeklySchedule) {
      setWeeklySchedule((prev: any) => {
        if (!prev) return prev;
        const nextStatus = action === "complete" ? "completed" : "todo"; // Simplified for this example
        const newDays = prev.days.map((d: any) => {
          if (d.date !== selectedDateStr) return d;
          return {
            ...d,
            workBlocks: (d.workBlocks || []).map((block: any) => ({
              ...block,
              tasks: (block.tasks || []).map((task: any) =>
                task._id === taskId ? { ...task, status: nextStatus } : task
              ),
            })),
          };
        });
        return { ...prev, days: newDays };
      });
    }

    try {
      const res = await fetch("/api/execution/task-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, action, date: selectedDateStr, ...extraBody })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          await fetchWeeklySchedule();
        } else {
          setWeeklySchedule(previousWeekly);
        }
      } else {
        setWeeklySchedule(previousWeekly);
      }
    } catch (err) {
      console.error(`Failed to execute task action: ${action}`, err);
      setWeeklySchedule(previousWeekly);
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
        if (data.success && data.weeklySchedule) {
          setWeeklySchedule(data.weeklySchedule);
        }
      }
    } catch (err) {
      console.error("Failed to regenerate weekly schedule:", err);
    } finally {
      setIsRegenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-6 w-6 rounded-full border-2 border-accent border-t-transparent animate-spin" />
          <span className="font-sans text-xs tracking-wider text-muted-foreground uppercase">Organizing Weekly Schedule...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full overflow-y-auto p-6 md:p-12 bg-background flex flex-col items-center">
      <div className="max-w-4xl w-full flex flex-col gap-10 mt-4 pb-20">
        
        {/* Header */}
        <header className="flex flex-col gap-5 border-b border-border/40 pb-8 relative">
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1">
              <span className="font-sans text-[10px] tracking-[0.25em] text-accent font-semibold uppercase">
                Execution Horizon
              </span>
              <h1 className="font-heading text-4xl md:text-5xl font-light text-foreground italic mt-2">
                Weekly Schedule
              </h1>
            </div>
            
            <button
              onClick={handleRegenerate}
              disabled={isRegenerating}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border/80 hover:bg-secondary/40 text-[10px] text-muted-foreground hover:text-foreground font-sans transition-all duration-200"
            >
              <RefreshCw size={11} className={isRegenerating ? "animate-spin text-accent" : "text-accent/80"} />
              {isRegenerating ? "Rebalancing..." : "Rebalance Week"}
            </button>
          </div>
        </header>

        {/* 7-Day Week Selector */}
        {weeklySchedule && (
          <div className="w-full flex justify-center mt-2 mb-4">
            <div className="flex gap-2 p-1.5 bg-secondary/30 border border-border/20 rounded-2xl overflow-x-auto scrollbar-none snap-x">
              {weeklySchedule.days.map((day: any) => {
                const isSelected = day.date === selectedDateStr;
                const d = new Date(day.date + "T12:00:00Z");
                const dayName = d.toLocaleDateString("en-US", { weekday: "short" });
                const dateNum = d.toLocaleDateString("en-US", { day: "numeric" });
                
                return (
                  <button
                    key={day.date}
                    onClick={() => setSelectedDateStr(day.date)}
                    className={`snap-center flex flex-col items-center justify-center min-w-[56px] h-[64px] rounded-xl transition-all duration-200 ${
                      isSelected 
                        ? "bg-accent text-primary-foreground shadow-sm" 
                        : "bg-transparent text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                    }`}
                  >
                    <span className="font-sans text-[10px] font-bold uppercase tracking-wider">{dayName}</span>
                    <span className="font-heading text-xl">{dateNum}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Daily View */}
        {activeDay && (
          <div className="flex flex-col gap-6 animate-slide-down-fade">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col bg-secondary/30 border border-border/20 p-4 rounded-xl">
                <span className="font-sans text-[9px] uppercase tracking-wider text-accent/80 font-bold">Today's Focus</span>
                <span className="font-sans text-xs font-semibold mt-1 text-foreground/90">{activeDay.focusTheme || "Core execution"}</span>
              </div>
              <div className="flex flex-col bg-secondary/30 border border-border/20 p-4 rounded-xl">
                <span className="font-sans text-[9px] uppercase tracking-wider text-accent/80 font-bold">Planned Focus Hours</span>
                <span className="font-sans text-xs font-semibold mt-1 text-foreground/90">
                  {activeDay.plannedFocusHours} hours ({activeDay.estimatedWorkload})
                </span>
              </div>
            </div>

            {activeDay.workBlocks.map((block: any, idx: number) => (
              <div key={idx} className="bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm flex flex-col">
                <div className="bg-secondary/40 border-b border-border/40 px-5 py-3.5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Clock size={14} className="text-accent" />
                    <span className="font-sans text-xs font-semibold uppercase tracking-wider text-foreground">
                      {block.title}
                    </span>
                  </div>
                  <span className="font-sans text-[10px] text-muted-foreground font-semibold">
                    {block.startTime} - {block.endTime}
                  </span>
                </div>
                
                <div className="flex flex-col p-2">
                  {block.tasks.length === 0 ? (
                    <div className="p-6 text-center">
                      <span className="font-sans text-[11px] text-muted-foreground/60 italic">No tasks scheduled for this block.</span>
                    </div>
                  ) : (
                    block.tasks.map((task: any) => (
                      <div key={task._id} className="group relative flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl hover:bg-secondary/20 transition-all">
                        <div className="flex items-start gap-4 w-full">
                          <button
                            onClick={() => handleTaskAction(task._id, task.status === "completed" ? "todo" : "complete")}
                            className={`mt-0.5 shrink-0 flex items-center justify-center w-5 h-5 rounded-full border transition-all ${
                              task.status === "completed"
                                ? "bg-accent border-accent text-primary-foreground shadow-[0_0_8px_rgba(255,215,0,0.3)]"
                                : "border-border hover:border-accent text-transparent bg-background"
                            }`}
                          >
                            <Check size={12} className="stroke-[3]" />
                          </button>
                          <div className="flex flex-col gap-1 w-full min-w-0">
                            <span className={`font-sans text-xs font-semibold transition-all ${
                              task.status === "completed" ? "line-through opacity-50" : "text-foreground"
                            }`}>
                              {task.title}
                            </span>
                            {task.description && (
                              <p className="font-sans text-[10px] text-muted-foreground/80 line-clamp-2 leading-relaxed">
                                {task.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
