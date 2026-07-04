"use client";

import React, { useState, useRef, useEffect } from "react";
import Image from "next/image";
import CompanionOrb, { OrbState } from "../ui/companion-orb";
import { Sparkles, ChevronDown, ChevronRight, CheckCircle2, Circle, AlertCircle, Compass } from "lucide-react";
import MarkdownRenderer from "../ui/markdown-renderer";

interface AgentWorkflowItem {
  status: "idle" | "running" | "completed" | "skipped";
  message: string;
}

interface ChatProps {
  messages: any[];
  sendMessage: (text: string) => Promise<void>;
  orbState: OrbState;
  statusMessage: string;
  setOrbState: React.Dispatch<React.SetStateAction<OrbState>>;
  userName: string;
  workflow: {
    memory: AgentWorkflowItem;
    planning: AgentWorkflowItem;
    execution: AgentWorkflowItem;
    identity: AgentWorkflowItem;
    reflection: AgentWorkflowItem;
  };
  onNavigate: (screen: "home" | "chat" | "plans" | "tasks" | "identity" | "reflection" | "settings") => void;
}

const quickActions = [
  "Plan My Week",
  "Review Goals",
  "Help Me Focus",
  "Reflect on Today",
];

export default function Chat({
  messages,
  sendMessage,
  orbState,
  statusMessage,
  setOrbState,
  userName,
  workflow,
  onNavigate,
}: ChatProps) {
  const [inputText, setInputText] = useState("");
  const [workflowExpanded, setWorkflowExpanded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 180)}px`;
    }
  }, [inputText]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInputText(val);
    setOrbState(val.trim() ? "typing" : "idle");
  };

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputText.trim()) return;
    const textToSend = inputText;
    setInputText("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    await sendMessage(textToSend);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleQuickAction = (action: string) => {
    setInputText(action);
    setOrbState("typing");
    textareaRef.current?.focus();
  };

  // Determine if workflow is running (at least one agent is running)
  const isWorkflowActive =
    workflow.memory.status === "running" ||
    workflow.planning.status === "running" ||
    workflow.execution.status === "running" ||
    workflow.identity.status === "running" ||
    workflow.reflection.status === "running";

  const isWorkflowFinished =
    !isWorkflowActive &&
    (workflow.memory.status === "completed" ||
      workflow.planning.status === "completed" ||
      workflow.execution.status === "completed" ||
      workflow.identity.status === "completed" ||
      workflow.reflection.status === "completed");

  // Helper to render agent workflow items
  const renderWorkflowItem = (
    label: string,
    emoji: string,
    state: AgentWorkflowItem
  ) => {
    const getStatusIndicator = () => {
      switch (state.status) {
        case "running":
          return <span className="h-1.5 w-1.5 rounded-full bg-accent animate-ping mr-1" />;
        case "completed":
          return <CheckCircle2 size={12} className="text-green-500 shrink-0" />;
        case "skipped":
          return <span className="text-[10px] text-muted-foreground/40 font-mono select-none">—</span>;
        default:
          return <Circle size={10} className="text-muted-foreground/30 shrink-0" />;
      }
    };

    return (
      <div className="flex items-center justify-between py-1.5 text-[11px] font-sans border-b border-border/10 last:border-0">
        <div className="flex items-center gap-2.5">
          <span className="text-xs select-none">{emoji}</span>
          <span className="font-medium text-foreground/80">{label}</span>
          {state.status === "running" && (
            <span className="text-muted-foreground/60 italic text-[10px] animate-pulse">
              ({state.message})
            </span>
          )}
        </div>
        <div className="flex items-center justify-center w-5 h-5">{getStatusIndicator()}</div>
      </div>
    );
  };

  return (
    <div className="relative h-screen max-h-screen w-full overflow-hidden bg-background flex flex-col items-center">
      
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
      <div className="relative z-10 h-full w-full flex flex-col items-center">

        {/* ─── Top Orb Panel ─── */}
        <div className="shrink-0 flex flex-col items-center pt-6 pb-4 w-full max-w-4xl px-6">
          <CompanionOrb
            state={orbState}
            size="xs"
            className="transition-all duration-500"
          />

          {/* Ambient status label */}
          <span
            className={`font-sans text-[10px] tracking-[0.3em] font-medium uppercase mt-2.5 transition-all duration-500 ${
              orbState === "idle"
                ? "text-accent/50"
                : "text-accent animate-pulse"
            }`}
          >
            {orbState === "idle" && "Zen Is Listening"}
            {orbState === "listening" && "Zen Is Listening..."}
            {orbState === "typing" && "Zen Is Listening..."}
            {orbState === "thinking" && (statusMessage || "Understanding your request...")}
            {orbState === "memory_retrieval" && "Memory retrieval..."}
            {orbState === "planning" && "Designing Roadmap..."}
            {orbState === "execution" && "Regenerating Agenda..."}
            {orbState === "identity_update" && "Updating Profile..."}
            {orbState === "reflection" && "Reflecting..."}
            {orbState === "completion" && "Done ✓"}
            {orbState === "writing" && (statusMessage || "Writing response...")}
          </span>
        </div>

        {/* ─── Messages ─── */}
        <div className="flex-1 min-h-0 w-full overflow-y-auto scrollbar-custom border-t border-border/20">
          <div className="w-full max-w-5xl mx-auto px-4 py-4 space-y-8 md:space-y-10">
            {messages.length === 0 ? (
              <div className="h-[50vh] flex flex-col items-center justify-center gap-3 opacity-50">
                <span className="font-heading text-2xl font-light text-muted-foreground italic">
                  Begin your dialogue
                </span>
                <span className="font-sans text-xs text-muted-foreground/70 tracking-wide">
                  Zenkai is ready to listen
                </span>
              </div>
            ) : (
              messages.map((msg, index) => {
                const isUser = msg.role === "user";
                const timeString = msg.createdAt
                  ? new Date(msg.createdAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : new Date().toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    });

                // Check for custom persistent Execution Summary Card JSON block in content
                const isSummaryCard = msg.content.startsWith('\0') && msg.content.includes('"__type":"execution_summary"');

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
                } else if (isSummaryCard) {
                  // RENDER PREMIUM EXECUTION SUMMARY CARD (PERSISTENT CHECKLIST)
                  try {
                    const cleanJson = msg.content.replace(/\0/g, "");
                    const card = JSON.parse(cleanJson);
                    const hasRoadmapUpdate = card.stats.milestonesCreated > 0 || card.stats.tasksCreated > 0;

                    return (
                      <div key={msg._id} className="flex gap-3 items-start w-full group animate-slide-down-fade">
                        <span className="text-accent text-[15px] select-none mt-1 shrink-0">✦</span>
                        <div className="flex-1 max-w-md bg-secondary/35 border border-border/40 hover:border-accent/30 rounded-2xl p-6 shadow-sm flex flex-col gap-5 transition-all duration-300">
                          
                          {/* Card Header */}
                          <div className="flex flex-col gap-1 border-b border-border/20 pb-3">
                            <h4 className="font-heading text-[15px] font-medium text-foreground tracking-wide flex items-center gap-2">
                              <span className="text-green-500">✓</span> Strategy Updated
                            </h4>
                            <p className="font-sans text-[11px] text-muted-foreground">
                              I've quietly organized everything for you.
                            </p>
                          </div>

                          {/* Operations Checklist (Dynamic - only show completed ones) */}
                          <div className="flex flex-col gap-2 font-sans text-[11px]">
                            {hasRoadmapUpdate && (
                              <div className="flex items-center gap-2 text-foreground/85">
                                <span className="text-green-500 font-bold">✓</span> Roadmap Evolved
                              </div>
                            )}
                            {card.stats.milestonesCreated > 0 && (
                              <div className="flex items-center gap-2 text-foreground/85">
                                <span className="text-green-500 font-bold">✓</span> Timeline Synchronized
                              </div>
                            )}
                            {card.stats.agendaBuilt && (
                              <div className="flex items-center gap-2 text-foreground/85">
                                <span className="text-green-500 font-bold">✓</span> Daily Agenda Generated
                              </div>
                            )}
                            {card.stats.tasksCreated > 0 && (
                              <div className="flex items-center gap-2 text-foreground/85">
                                <span className="text-green-500 font-bold">✓</span> {card.stats.tasksCreated} Tasks Structured
                              </div>
                            )}
                            {card.stats.memoryUpdated && (
                              <div className="flex items-center gap-2 text-foreground/85">
                                <span className="text-green-500 font-bold">✓</span> Core Memories Logged
                              </div>
                            )}
                            {card.stats.identityUpdated && (
                              <div className="flex items-center gap-2 text-foreground/85">
                                <span className="text-green-500 font-bold">✓</span> Identity Profile Evolved
                              </div>
                            )}
                            {card.stats.reflectionRecorded && (
                              <div className="flex items-center gap-2 text-foreground/85">
                                <span className="text-green-500 font-bold">✓</span> Growth Narrative Recorded
                              </div>
                            )}
                          </div>

                          {/* Workload, Priority, Milestone Details */}
                          <div className="grid grid-cols-2 gap-4 border-t border-border/25 pt-4 font-sans text-[10px] text-muted-foreground/80">
                            <div className="flex flex-col gap-0.5">
                              <span className="font-bold text-accent/80 uppercase tracking-wide">Estimated Workload</span>
                              <span className="text-foreground font-semibold text-xs mt-0.5">{card.workload || "0.0 hrs/day"}</span>
                            </div>
                            <div className="flex flex-col gap-0.5">
                              <span className="font-bold text-accent/80 uppercase tracking-wide">Highest Priority</span>
                              <span className="text-foreground font-semibold text-xs mt-0.5 line-clamp-1">{card.priority || "General focus"}</span>
                            </div>
                            <div className="flex flex-col gap-0.5 col-span-2">
                              <span className="font-bold text-accent/80 uppercase tracking-wide">Next Milestone Focus</span>
                              <span className="text-foreground font-semibold text-xs mt-0.5">{card.nextMilestone || "None scheduled"}</span>
                            </div>
                          </div>

                          {/* Action Button */}
                          <button
                            onClick={() => onNavigate("plans")}
                            className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl border border-accent/40 bg-accent/5 hover:bg-accent/15 text-xs text-accent font-semibold tracking-wide transition-all duration-300 shadow-sm"
                          >
                            <Compass size={13} />
                            View Evolved Strategy →
                          </button>
                        </div>
                      </div>
                    );
                  } catch (e) {
                    console.error("Failed to parse summary card message:", e);
                    return null;
                  }
                } else {
                  // RENDER STANDARD COMPANION MESSAGE
                  const isLastMessage = index === messages.length - 1;

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

                        {/* RENDER DYNAMIC MULTI-AGENT WORKFLOW PANEL (Directly below streaming response) */}
                        {isLastMessage && (isWorkflowActive || isWorkflowFinished) && (
                          <div className="mt-4 max-w-sm bg-secondary/15 border border-border/30 rounded-xl overflow-hidden transition-all duration-500">
                            {isWorkflowFinished ? (
                              /* Collapsed dropdown view on completion */
                              <div className="flex flex-col">
                                <button
                                  onClick={() => setWorkflowExpanded(!workflowExpanded)}
                                  className="flex items-center justify-between px-4 py-2 text-[10px] font-sans text-muted-foreground hover:text-foreground font-semibold uppercase tracking-wider transition-colors"
                                >
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-green-500 font-bold">✓</span>
                                    <span>Workflow completed</span>
                                  </div>
                                  {workflowExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                                </button>
                                
                                {workflowExpanded && (
                                  <div className="px-4 pb-3 pt-1 bg-secondary/5">
                                    {renderWorkflowItem("🧠 Memory Agent", "Memory Agent", workflow.memory)}
                                    {renderWorkflowItem("🗺 Planning Agent", "Planning Agent", workflow.planning)}
                                    {renderWorkflowItem("⚡ Execution Agent", "Execution Agent", workflow.execution)}
                                    {renderWorkflowItem("👤 Identity Agent", "Identity Agent", workflow.identity)}
                                    {renderWorkflowItem("🪞 Reflection Agent", "Reflection Agent", workflow.reflection)}
                                  </div>
                                )}
                              </div>
                            ) : (
                              /* Expanded real-time animation view while running */
                              <div className="px-4 py-3">
                                <div className="flex items-center gap-2 text-[9px] font-sans text-accent font-bold uppercase tracking-wider mb-2 animate-pulse">
                                  <span className="h-1.5 w-1.5 rounded-full bg-accent animate-ping" />
                                  Orchestrating active workflow...
                                </div>
                                {renderWorkflowItem("🧠 Memory Agent", "Memory Agent", workflow.memory)}
                                {renderWorkflowItem("🗺 Planning Agent", "Planning Agent", workflow.planning)}
                                {renderWorkflowItem("⚡ Execution Agent", "Execution Agent", workflow.execution)}
                                {renderWorkflowItem("👤 Identity Agent", "Identity Agent", workflow.identity)}
                                {renderWorkflowItem("🪞 Reflection Agent", "Reflection Agent", workflow.reflection)}
                              </div>
                            )}
                          </div>
                        )}

                        <span className="text-[8px] font-sans text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                          {timeString}
                        </span>
                      </div>
                    </div>
                  );
                }
              })
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* ─── Input Area ─── */}
        <div className="w-full max-w-4xl px-4 shrink-0 pt-3 pb-7 z-10">

          {/* Quick action chips */}
          {((messages.length === 0) || (orbState === "idle" && messages[messages.length - 1]?.role === "assistant")) && (
            <div className="flex flex-wrap gap-2 justify-center mb-4 transition-all duration-300">
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
          )}

          {/* Input form */}
          <form onSubmit={handleSend} className="relative w-full">
            <div className="w-full bg-secondary/80 hover:bg-secondary focus-within:bg-secondary border border-border/50 focus-within:border-accent/40 focus-within:ring-1 focus-within:ring-accent/30 rounded-2xl shadow-sm focus-within:shadow-md transition-all duration-300 flex flex-col px-5 pt-4 pb-3 gap-3">
              
              <textarea
                ref={textareaRef}
                rows={1}
                placeholder="Speak with Zenkai..."
                value={inputText}
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
                  disabled={!inputText.trim()}
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
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
                    />
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
