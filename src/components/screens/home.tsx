"use client";

import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import CompanionOrb, { OrbState } from "../ui/companion-orb";
import { Sparkles, ArrowRight, BookOpen, CheckSquare, Compass, Calendar as CalendarIcon } from "lucide-react";

interface HomeProps {
  sendMessage: (text: string) => Promise<void>;
  orbState: OrbState;
  setOrbState: React.Dispatch<React.SetStateAction<OrbState>>;
  userName: string;
  onNavigate?: (screen: "plans" | "chat" | "tasks" | "identity" | "reflection" | "settings" | "memory") => void;
}

interface ProactiveData {
  currentGoal: string | null;
  activeMilestone: any | null;
  upcomingHardConstraint: any | null;
  planProgress: number;
  priorities: any[];
  recentReflection: { title: string; summary: string; category: string } | null;
}

export default function Home({
  sendMessage,
  orbState,
  setOrbState,
  userName,
  onNavigate,
}: HomeProps) {
  const [query, setQuery] = useState("");
  const [proactiveData, setProactiveData] = useState<ProactiveData | null>(null);
  
  // Weekly Schedule State
  const [weeklySchedule, setWeeklySchedule] = useState<any | null>(null);
  const [selectedDateStr, setSelectedDateStr] = useState<string>("");
  const [agenda, setAgenda] = useState<any | null>(null); // Derived from weeklySchedule + selectedDateStr
  
  const [loadingProactive, setLoadingProactive] = useState(true);
  const [loadingAgenda, setLoadingAgenda] = useState(true);
  const [greeting, setGreeting] = useState("Good Morning,");

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const quickActions = [
    "Plan My Day",
    "What should I study?",
    "Review Goals",
    "Reflect on Today",
  ];

  const fetchProactiveData = async () => {
    try {
      const res = await fetch("/api/plans/proactive", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.proactiveData) {
          setProactiveData(data.proactiveData);
        }
      }
    } catch (err) {
      console.error("Failed to load proactive data:", err);
    } finally {
      setLoadingProactive(false);
    }
  };

  const fetchWeeklySchedule = async () => {
    try {
      const res = await fetch("/api/execution/agenda", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.weeklySchedule) {
          setWeeklySchedule(data.weeklySchedule);
          
          // Set initial date if not set
          if (!selectedDateStr) {
            // Try to find today
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
      setLoadingAgenda(false);
    }
  };

  useEffect(() => {
    fetchProactiveData();
    fetchWeeklySchedule();

    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) {
      setGreeting("Good Morning,");
    } else if (hour >= 12 && hour < 17) {
      setGreeting("Good Afternoon,");
    } else if (hour >= 17 && hour < 22) {
      setGreeting("Good Evening,");
    } else {
      setGreeting("Good Night,");
    }
  }, []);

  // Derive active agenda block from schedule
  useEffect(() => {
    if (weeklySchedule && selectedDateStr) {
      const dayBlock = weeklySchedule.days.find((d: any) => d.date === selectedDateStr);
      setAgenda(dayBlock || null);
    }
  }, [weeklySchedule, selectedDateStr]);

  useEffect(() => {
    if (agenda) {
      const totalCritical = agenda.workBlocks.reduce((acc: number, wb: any) => acc + wb.tasks.length, 0);
      const completedCritical = agenda.workBlocks.reduce((acc: number, wb: any) => acc + wb.tasks.filter((t: any) => t.status === "completed").length, 0);
      if (totalCritical > 0 && completedCritical === totalCritical) {
        setOrbState("completion");
      } else {
        setOrbState("idle");
      }
    }
  }, [agenda, setOrbState]);

  const handleToggleTask = async (taskId: string, currentStatus: string) => {
    const isCompleted = currentStatus === "completed";
    const nextStatus = isCompleted ? "todo" : "completed";
    const nextAction = isCompleted ? "reschedule" : "complete";
    const dateStr = selectedDateStr || new Date().toISOString().split("T")[0];

    const previousWeekly = weeklySchedule;

    // Optimistically update
    if (weeklySchedule) {
      setWeeklySchedule((prev: any) => {
        if (!prev) return prev;
        const newDays = prev.days.map((d: any) => {
          if (d.date !== dateStr) return d;
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
      setOrbState("completion");
      const res = await fetch("/api/execution/task-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, action: nextAction, date: dateStr, newDate: dateStr })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          // Task toggling doesn't return the full weekly schedule right now (it returns daily agenda), 
          // so we should fetch the full schedule to be safe
          await fetchWeeklySchedule();
          await fetchProactiveData();
          
          setTimeout(() => setOrbState("idle"), 800);
        } else {
          setWeeklySchedule(previousWeekly);
          setOrbState("idle");
        }
      } else {
        setWeeklySchedule(previousWeekly);
        setOrbState("idle");
      }
    } catch (err) {
      console.error("Failed to toggle task:", err);
      setWeeklySchedule(previousWeekly);
      setOrbState("idle");
    }
  };

  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 180)}px`;
    }
  }, [query]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setQuery(val);
    setOrbState(val.trim() ? "typing" : "idle");
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!query.trim()) return;
    const textToSend = query;
    setQuery("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    if (onNavigate) {
      onNavigate("chat");
    }
    await sendMessage(textToSend);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleQuickAction = (action: string) => {
    setQuery(action);
    setOrbState("typing");
    textareaRef.current?.focus();
  };

  const getTaskStats = () => {
    if (!agenda) return { total: 0, completed: 0, percentage: 0 };
    let total = 0;
    let completed = 0;

    agenda.workBlocks.forEach((wb: any) => wb.tasks.forEach((t: any) => {
      total++;
      if (t.status === "completed") completed++;
    }));

    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, percentage };
  };

  const stats = getTaskStats();
  const radius = 32;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (stats.percentage / 100) * circumference;

  return (
    <div className="relative h-screen max-h-screen w-full overflow-y-auto bg-background scrollbar-none flex flex-col items-center">
      <div
        className="fixed right-0 top-0 h-full w-full md:w-1/2 pointer-events-none select-none z-0"
        style={{
          maskImage: "linear-gradient(to left, rgba(0,0,0,1) 50%, rgba(0,0,0,0) 100%)",
          WebkitMaskImage: "linear-gradient(to left, rgba(0,0,0,1) 50%, rgba(0,0,0,0) 100%)",
        }}
      >
        <Image
          src="/assets/temples/temple_1_focus.png"
          alt="Temple of Focus"
          fill
          priority
          sizes="(max-width: 768px) 100vw, 50vw"
          className="object-cover object-right-bottom opacity-65 dark:opacity-20 transition-opacity duration-1000"
        />
      </div>

      <div className="relative z-10 w-full max-w-5xl flex flex-col items-center min-h-screen px-4 md:px-6">
        <div
          className="shrink-0 transition-all duration-700 ease-in-out"
          style={{ height: "clamp(20px, 4vh, 36px)" }}
        />

        <div className="shrink-0 flex flex-col items-center w-full">
          <CompanionOrb
            state={orbState}
            size="md"
            className="transition-all duration-700"
          />

          <span
            className={`font-sans text-[9px] tracking-[0.3em] font-medium uppercase mt-2.5 transition-all duration-500 ${
              orbState === "idle" || orbState === "completion" ? "text-accent/50" : "text-accent animate-pulse"
            }`}
          >
            {orbState === "idle" && "Zenkai Listening"}
            {orbState === "completion" && "Day Complete"}
            {orbState === "execution" && "Thinking..."}
            {orbState === "listening" && "Listening..."}
            {orbState === "typing" && "Listening..."}
            {orbState === "thinking" && "Understanding..."}
            {orbState === "writing" && "Writing response..."}
          </span>

          <div className="text-center flex flex-col items-center mt-5">
            <span className="font-heading text-3xl md:text-4xl font-light text-muted-foreground italic">
              {greeting}
            </span>
            <span className="font-signature text-5xl md:text-6xl text-accent leading-none mt-1">
              {userName}
            </span>
          </div>
        </div>

        {/* 7-Day Week Selector */}
        {!loadingAgenda && weeklySchedule && (
          <div className="w-full flex justify-center mt-8 mb-2">
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

        {loadingAgenda && (
          <div className="w-full flex flex-col gap-6 mt-6 animate-pulse pb-4 opacity-40">
            <div className="h-[76px] bg-secondary/30 border border-border/10 rounded-2xl w-full" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-2 flex flex-col gap-5">
                <div className="h-[82px] bg-secondary/30 border border-border/10 rounded-2xl w-full" />
                <div className="h-[280px] bg-secondary/30 border border-border/10 rounded-2xl w-full" />
              </div>
              <div className="flex flex-col gap-5">
                <div className="h-[210px] bg-secondary/30 border border-border/10 rounded-2xl w-full" />
                <div className="h-[80px] bg-secondary/30 border border-border/10 rounded-2xl w-full" />
              </div>
            </div>
          </div>
        )}

        {!loadingAgenda && agenda && (
          <div className="w-full flex flex-col gap-6 mt-4 animate-slide-down-fade pb-4">
            
            <div className="text-center bg-secondary/20 border border-border/30 px-6 py-4 rounded-2xl">
              <span className="font-sans text-[8px] tracking-[0.2em] font-bold text-accent uppercase">Daily Focus</span>
              <p className="font-heading text-lg md:text-xl font-light text-muted-foreground italic mt-1 leading-relaxed">
                "{agenda.focusTheme || "Focus on the roadmap"}"
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-2 flex flex-col gap-5">
                
                <div className="bg-card border border-border/50 p-6 rounded-2xl flex flex-col gap-4 shadow-sm">
                  <span className="font-sans text-[9px] font-semibold text-accent uppercase tracking-wider flex items-center gap-1.5 border-b border-border/10 pb-2.5">
                    <CheckSquare size={11} /> Suggested Work Blocks
                  </span>

                  <div className="space-y-6">
                    {agenda.workBlocks.map((block: any, bIdx: number) => (
                      <div key={bIdx} className="flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                          <span className="font-sans text-xs font-semibold text-foreground/90">{block.title}</span>
                          <span className="font-sans text-[9px] text-accent/80 font-semibold">{block.startTime} - {block.endTime}</span>
                        </div>
                        <div className="space-y-2 border-l border-border/20 pl-3">
                          {block.tasks.length === 0 ? (
                            <span className="font-sans text-[11px] text-muted-foreground italic">No tasks planned</span>
                          ) : (
                            block.tasks.map((task: any) => {
                              const isCompleted = task.status === "completed";
                              return (
                                <div
                                  key={task._id}
                                  onClick={() => handleToggleTask(task._id, task.status)}
                                  className="flex items-start justify-between cursor-pointer group transition-all py-0.5"
                                >
                                  <div className="flex items-center gap-3 min-w-0">
                                    <button
                                      type="button"
                                      className={`h-4.5 w-4.5 rounded-full flex items-center justify-center shrink-0 border transition-all mt-0.5 ${
                                        isCompleted
                                          ? "bg-accent border-accent text-foreground"
                                          : "border-muted-foreground/30 text-transparent group-hover:border-accent"
                                      }`}
                                    >
                                      {isCompleted && (
                                        <svg className="w-2.5 h-2.5 text-primary-foreground stroke-[3px]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                        </svg>
                                      )}
                                    </button>
                                    <span className={`font-sans text-xs text-foreground tracking-wide font-medium transition-all ${
                                      isCompleted ? "line-through text-muted-foreground opacity-65" : "text-foreground group-hover:text-accent/90"
                                    }`}>
                                      {task.title}
                                    </span>
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>

              <div className="flex flex-col gap-5">
                
                <div className="bg-secondary/40 border border-border/30 p-5 rounded-2xl flex flex-col items-center text-center gap-4">
                  <span className="font-sans text-[9px] tracking-wider text-accent font-bold uppercase">
                    Daily Progress
                  </span>
                  
                  <div className="relative flex items-center justify-center">
                    <svg className="w-20 h-20 transform -rotate-90">
                      <circle
                        cx="40"
                        cy="40"
                        r={radius}
                        className="stroke-secondary-foreground/10"
                        strokeWidth="5"
                        fill="transparent"
                      />
                      <circle
                        cx="40"
                        cy="40"
                        r={radius}
                        className="stroke-accent transition-all duration-500 ease-in-out"
                        strokeWidth="5"
                        fill="transparent"
                        strokeDasharray={circumference}
                        strokeDashoffset={strokeDashoffset}
                        strokeLinecap="round"
                      />
                    </svg>
                    <span className="absolute font-heading text-lg font-light text-foreground mt-0.5">
                      {stats.percentage}%
                    </span>
                  </div>

                  <span className="font-sans text-xs text-muted-foreground">
                    {stats.completed} of {stats.total} tasks completed
                  </span>
                </div>

                {proactiveData?.currentGoal && (
                  <div className="bg-secondary/40 border border-border/30 p-4 rounded-xl flex flex-col gap-1.5">
                    <span className="font-sans text-[8px] font-semibold text-accent uppercase tracking-widest">
                      Current Roadmap Goal
                    </span>
                    <h4 className="font-sans text-xs font-semibold text-foreground/90 leading-tight">
                      {proactiveData.currentGoal}
                    </h4>
                    <span className="font-sans text-[9px] text-muted-foreground/60">
                      {proactiveData.planProgress}% overall roadmap completion
                    </span>
                  </div>
                )}

                {proactiveData?.recentReflection && (
                  <div className="bg-secondary/40 border border-border/40 p-5 rounded-2xl flex flex-col gap-2">
                    <span className="font-sans text-[9px] font-semibold text-accent uppercase tracking-wider flex items-center gap-1.5">
                      <BookOpen size={11} /> Recent Insight
                    </span>
                    <p className="font-sans text-[11px] text-muted-foreground/90 leading-relaxed italic">
                      "{proactiveData.recentReflection.summary}"
                    </p>
                  </div>
                )}

                {onNavigate && (
                  <button
                    onClick={() => onNavigate("tasks")}
                    className="w-full py-3.5 rounded-full bg-accent hover:bg-accent/90 text-primary-foreground font-sans font-semibold text-xs tracking-wider uppercase transition-all flex items-center justify-center gap-2 shadow-sm mt-1"
                  >
                    View All Tasks <ArrowRight size={13} />
                  </button>
                )}

              </div>

            </div>

          </div>
        )}

        <div className="w-full px-4 shrink-0 pt-5 pb-7 z-10">
          <div className="flex flex-wrap gap-2 justify-center mb-4">
            {quickActions.map((action) => (
              <button
                key={action}
                onClick={() => handleQuickAction(action)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-border/60 bg-background/60 hover:bg-secondary text-[11px] text-muted-foreground hover:text-foreground font-sans transition-all duration-200"
              >
                <Sparkles size={9} className="text-accent/80" />
                {action}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="relative w-full">
            <div className="w-full bg-secondary/80 hover:bg-secondary focus-within:bg-secondary border border-border/50 focus-within:border-accent/40 focus-within:ring-1 focus-within:ring-accent/30 rounded-2xl shadow-sm focus-within:shadow-md transition-all duration-300 flex flex-col px-5 pt-4 pb-3 gap-3">
              
              <textarea
                ref={textareaRef}
                rows={1}
                placeholder="Speak with Zenkai..."
                value={query}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                className="w-full bg-transparent text-foreground font-sans placeholder:text-muted-foreground/50 outline-none text-sm md:text-[15px] resize-none min-h-[28px] max-h-[180px] overflow-y-auto border-none focus:ring-0 focus:border-none focus:outline-none scrollbar-custom"
                style={{ lineHeight: "1.6" }}
              />

              <div className="flex items-center justify-between">
                <span className="font-sans text-[10px] text-muted-foreground/35 select-none tracking-wide">
                  Shift + ↵ &nbsp;new line
                </span>
                <button
                  type="submit"
                  disabled={!query.trim()}
                  className="p-2 rounded-full bg-primary hover:bg-accent disabled:opacity-25 disabled:cursor-not-allowed text-primary-foreground hover:text-foreground transition-all duration-300 shadow-sm flex items-center justify-center"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                    className="w-4 h-4"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                  </svg>
                </button>
              </div>
            </div>
          </form>
        </div>

      </div>
    </div>
  );
}
