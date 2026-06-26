"use client";

import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import CompanionOrb, { OrbState } from "../ui/companion-orb";
import { Sparkles, ArrowRight, BookOpen, CheckSquare, Compass, Clock } from "lucide-react";
import MarkdownRenderer from "../ui/markdown-renderer";

interface HomeProps {
  messages: any[];
  sendMessage: (text: string) => Promise<void>;
  orbState: OrbState;
  statusMessage: string;
  hasStartedChat: boolean;
  setOrbState: React.Dispatch<React.SetStateAction<OrbState>>;
  userName: string;
  onNavigate?: (screen: "plans" | "chat" | "tasks" | "identity" | "reflection" | "settings" | "memory") => void;
}

const quickActions = [
  "Plan My Week",
  "Review Goals",
  "Help Me Focus",
  "Reflect on Today",
];

interface ProactiveData {
  currentGoal: string | null;
  activeMilestone: {
    _id: string;
    title: string;
    progress: number;
    category: string;
    startDate: string;
    endDate: string;
    estimatedDuration: string;
  } | null;
  upcomingHardConstraint: {
    _id: string;
    title: string;
    category: string;
    startDate: string;
    endDate: string;
  } | null;
  planProgress: number;
  priorities: {
    id: string;
    title: string;
    status: string;
    priority: number;
    suggestedDate?: string;
    timeBlock?: string;
    estimatedDuration: string;
  }[];
  recentReflection: { title: string; summary: string; category: string } | null;
}
 
export default function Home({
  messages,
  sendMessage,
  orbState,
  statusMessage,
  hasStartedChat,
  setOrbState,
  userName,
  onNavigate,
}: HomeProps) {
  const [query, setQuery] = useState("");
  const [isChatActive, setIsChatActive] = useState(false);
  const [proactiveData, setProactiveData] = useState<ProactiveData | null>(null);
  const [loadingProactive, setLoadingProactive] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
 
  // Fetch proactive details from endpoint
  const fetchProactiveData = async () => {
    try {
      const res = await fetch("/api/plans/proactive");
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

  useEffect(() => {
    fetchProactiveData();
  }, []);

  const handleToggleTask = async (taskId: string, currentStatus: string) => {
    const newStatus = currentStatus === "completed" ? "todo" : "completed";
    try {
      if (proactiveData) {
        setProactiveData({
          ...proactiveData,
          priorities: proactiveData.priorities.map((t) =>
            t.id === taskId ? { ...t, status: newStatus } : t
          ),
        });
      }
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        await fetchProactiveData();
      }
    } catch (err) {
      console.error("Failed to update task on home screen:", err);
    }
  };

  // Delayed transition from greeting → chat if prior messages exist
  useEffect(() => {
    if (hasStartedChat) {
      const timer = setTimeout(() => setIsChatActive(true), 500);
      return () => clearTimeout(timer);
    } else {
      setIsChatActive(false);
    }
  }, [hasStartedChat]);

  // Auto-scroll messages
  useEffect(() => {
    if (isChatActive) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isChatActive]);

  // Auto-resize textarea
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
    setIsChatActive(true);
    const textToSend = query;
    setQuery("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
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

  return (
    <div className="relative h-screen max-h-screen w-full overflow-y-auto bg-background scrollbar-none flex flex-col items-center">

      {/* ── Temple Background ── */}
      <div
        className="absolute right-0 top-0 h-full w-full md:w-1/2 pointer-events-none select-none z-0"
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

      {/* ── Main Layout ── */}
      <div className="relative z-10 w-full max-w-3xl flex flex-col items-center min-h-screen px-4 md:px-6">

        {/* Top elastic spacer */}
        <div
          className="shrink-0 transition-all duration-700 ease-in-out"
          style={{ height: isChatActive ? "16px" : "clamp(24px, 6vh, 48px)" }}
        />

        {/* Companion Orb + Greeting */}
        <div className="shrink-0 flex flex-col items-center w-full">
          <CompanionOrb
            state={orbState}
            size={isChatActive ? "xs" : "md"}
            className="transition-all duration-700"
          />

          <span
            className={`font-sans text-[9px] tracking-[0.3em] font-medium uppercase mt-2.5 transition-all duration-500 ${
              orbState === "idle" ? "text-accent/50" : "text-accent animate-pulse"
            }`}
          >
            {orbState === "idle" && "Zenkai Listening"}
            {orbState === "typing" && "Zenkai Listening..."}
            {orbState === "thinking" && (statusMessage || "Understanding your request...")}
            {orbState === "writing" && (statusMessage || "Writing response...")}
          </span>

          <div
            className={`text-center flex flex-col items-center transition-all duration-700 ease-in-out overflow-hidden ${
              isChatActive ? "max-h-0 opacity-0 mt-0 pointer-events-none" : "max-h-36 opacity-100 mt-6"
            }`}
          >
            <span className="font-heading text-3xl md:text-4xl font-light text-muted-foreground italic">
              Good Morning,
            </span>
            <span className="font-signature text-5xl md:text-6xl text-accent leading-none mt-1">
              {userName}
            </span>
          </div>
        </div>

        {/* Proactive Panel (Visible only when chat is not active) */}
        {!isChatActive && !loadingProactive && proactiveData && (
          <div className="w-full flex flex-col gap-6 mt-8 animate-fade-in transition-all duration-500">
            
            {/* Top Row: Current Goal & Active Milestone / Hard Constraints */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              
              {/* Goal & Milestone Card */}
              {proactiveData.currentGoal ? (
                <div className="bg-secondary/40 border border-border/40 p-5 rounded-2xl flex flex-col justify-between gap-4">
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <span className="font-sans text-[9px] font-semibold text-accent uppercase tracking-wider flex items-center gap-1.5">
                        <Compass size={11} /> Current Aspiration
                      </span>
                      <span className="font-sans text-[9px] text-muted-foreground/80 font-semibold">
                        {proactiveData.planProgress}% overall
                      </span>
                    </div>
                    
                    <div className="flex flex-col gap-1">
                      <h3 className="font-heading text-lg font-light text-foreground leading-tight">
                        {proactiveData.currentGoal}
                      </h3>
                      {proactiveData.activeMilestone && (
                        <div className="flex flex-col gap-0.5 mt-2 border-t border-border/10 pt-2">
                          <span className="font-sans text-[8px] text-accent/60 uppercase tracking-widest">
                            Active Milestone Focus
                          </span>
                          <span className="font-sans text-xs font-semibold text-foreground/90">
                            {proactiveData.activeMilestone.title}
                          </span>
                          <div className="flex items-center justify-between text-[9px] text-muted-foreground/60 mt-0.5 font-sans">
                            <span>{proactiveData.activeMilestone.category} | {proactiveData.activeMilestone.progress}% done</span>
                            {proactiveData.activeMilestone.startDate && (
                              <span>{proactiveData.activeMilestone.startDate} — {proactiveData.activeMilestone.endDate}</span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {onNavigate && (
                    <button
                      onClick={() => onNavigate("plans")}
                      className="self-start font-sans text-xs font-semibold text-accent hover:text-accent/80 flex items-center gap-1.5 transition-all mt-2"
                    >
                      Resume Roadmap <ArrowRight size={13} />
                    </button>
                  )}
                </div>
              ) : (
                <div className="bg-secondary/40 border border-border/40 p-5 rounded-2xl flex flex-col justify-center items-center text-center gap-2">
                  <span className="font-sans text-[10px] text-muted-foreground">No active plans yet.</span>
                  <span className="font-sans text-xs text-accent">Type a goal below to begin.</span>
                </div>
              )}

              {/* Reflection & Hard Constraints Card */}
              <div className="flex flex-col gap-5">
                {/* Upcoming Hard Constraint (If exists) */}
                {proactiveData.upcomingHardConstraint ? (
                  <div className="bg-red-500/5 border border-red-500/20 p-4 rounded-xl flex flex-col gap-1.5">
                    <span className="font-sans text-[8px] font-semibold text-red-400 uppercase tracking-widest flex items-center gap-1.5">
                      🎓 Upcoming Hard Constraint
                    </span>
                    <h4 className="font-sans text-xs font-semibold text-foreground/90">
                      {proactiveData.upcomingHardConstraint.title}
                    </h4>
                    <span className="font-sans text-[9px] text-muted-foreground/75">
                      Starts: {proactiveData.upcomingHardConstraint.startDate}
                    </span>
                  </div>
                ) : null}

                {/* Reflection Card */}
                {proactiveData.recentReflection ? (
                  <div className="bg-secondary/40 border border-border/40 p-5 rounded-2xl flex flex-col gap-2 flex-1 justify-center">
                    <span className="font-sans text-[9px] font-semibold text-accent uppercase tracking-wider flex items-center gap-1.5">
                      <BookOpen size={11} /> Recent Reflection
                    </span>
                    <span className="font-sans text-[10px] font-medium text-foreground/75 italic">
                      {proactiveData.recentReflection.category}
                    </span>
                    <p className="font-sans text-xs text-muted-foreground/90 leading-relaxed italic">
                      "{proactiveData.recentReflection.summary}"
                    </p>
                  </div>
                ) : (
                  <div className="bg-secondary/40 border border-border/40 p-5 rounded-2xl flex flex-col justify-center items-center text-center flex-1">
                    <span className="font-sans text-[10px] text-muted-foreground">No reflections accumulated yet.</span>
                  </div>
                )}
              </div>

            </div>

            {/* Priorities Card */}
            {proactiveData.priorities.length > 0 && (
              <div className="bg-card border border-border/50 p-6 rounded-2xl flex flex-col gap-4 shadow-sm">
                <span className="font-sans text-[9px] font-semibold text-accent uppercase tracking-wider flex items-center gap-1.5">
                  <CheckSquare size={11} /> Today's Planned Tasks
                </span>
                
                <div className="space-y-3">
                  {proactiveData.priorities.map((task) => {
                    const isCompleted = task.status === "completed";
                    return (
                      <div
                        key={task.id}
                        onClick={() => handleToggleTask(task.id, task.status)}
                        className="flex items-start justify-between border-b border-border/10 pb-2.5 last:border-0 last:pb-0 cursor-pointer group transition-all"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <button
                            type="button"
                            className={`h-4 w-4 rounded-full flex items-center justify-center shrink-0 border transition-all mt-0.5 ${
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
                        <div className="flex items-center gap-3 shrink-0 ml-3">
                          {task.suggestedDate && (
                            <span className="font-sans text-[9px] text-accent/80 font-medium">
                              {task.timeBlock ? `${task.timeBlock}` : `${task.suggestedDate}`}
                            </span>
                          )}
                          {task.estimatedDuration && (
                            <span className="font-sans text-[9px] text-muted-foreground/60 flex items-center gap-1">
                              <Clock size={10} /> {task.estimatedDuration}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

          </div>
        )}

        {/* Chat Messages */}
        <div
          className={`w-full min-h-0 transition-all duration-700 ease-in-out overflow-y-auto scrollbar-custom ${
            isChatActive ? "flex-1 opacity-100 mt-4" : "flex-none h-0 opacity-0 pointer-events-none overflow-hidden"
          }`}
        >
          <div className="w-full mx-auto py-3 space-y-8 md:space-y-10 border-t border-border/20">
            {messages.map((msg) => {
              const isUser = msg.role === "user";
              const timeString = msg.createdAt
                ? new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                : new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
              
              if (isUser) {
                return (
                  <div key={msg._id} className="flex w-full justify-end group">
                    <div className="max-w-[85%] md:max-w-2xl flex flex-col gap-1.5 items-end">
                      {userName && (
                        <span className="text-[9px] font-sans tracking-widest text-muted-foreground/80 uppercase mr-1">
                          {userName}
                        </span>
                      )}
                      <div className="rounded-2xl px-6 py-4 bg-primary text-primary-foreground rounded-tr-none shadow-sm whitespace-pre-wrap font-sans text-sm md:text-[15px] leading-relaxed">
                        {msg.content}
                      </div>
                      <span className="text-[8px] font-sans text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 mr-1">
                        {timeString}
                      </span>
                    </div>
                  </div>
                );
              } else {
                return (
                  <div key={msg._id} className="flex gap-3 items-start w-full group">
                    <span className="text-accent text-[15px] select-none mt-1 shrink-0">✦</span>
                    <div className="flex-1 flex flex-col gap-1.5 min-w-0">
                      {msg.content === "" ? (
                        <div className="flex gap-1.5 items-center py-2.5">
                          <span className="h-1.5 w-1.5 rounded-full bg-accent animate-bounce" style={{ animationDelay: '0ms' }} />
                          <span className="h-1.5 w-1.5 rounded-full bg-accent animate-bounce" style={{ animationDelay: '150ms' }} />
                          <span className="h-1.5 w-1.5 rounded-full bg-accent animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                      ) : (
                        <MarkdownRenderer content={msg.content} />
                      )}
                      <span className="text-[8px] font-sans text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        {timeString}
                      </span>
                    </div>
                  </div>
                );
              }
            })}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input Area */}
        <div className="w-full px-4 shrink-0 pt-5 pb-7 z-10">
          
          {/* Quick Actions */}
          <div
            className={`flex flex-wrap gap-2 justify-center transition-all duration-500 ease-in-out overflow-hidden ${
              isChatActive ? "max-h-0 opacity-0 mb-0 pointer-events-none" : "max-h-20 opacity-100 mb-4"
            }`}
          >
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
