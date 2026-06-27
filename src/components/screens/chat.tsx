"use client";

import React, { useState, useRef, useEffect } from "react";
import Image from "next/image";
import CompanionOrb, { OrbState } from "../ui/companion-orb";
import { Sparkles } from "lucide-react";
import MarkdownRenderer from "../ui/markdown-renderer";

interface ChatProps {
  messages: any[];
  sendMessage: (text: string) => Promise<void>;
  orbState: OrbState;
  statusMessage: string;
  setOrbState: React.Dispatch<React.SetStateAction<OrbState>>;
  userName: string;
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
}: ChatProps) {
  const [inputText, setInputText] = useState("");
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

      {/* ── Main Layout: single centered flex column ── */}
      <div className="relative z-10 h-full w-full flex flex-col items-center">

        {/* ─── Top: Orb + Status (mirrors home screen chat-active state) ─── */}
        <div className="shrink-0 flex flex-col items-center pt-6 pb-4 w-full max-w-4xl px-6">
          {/* Companion Orb — xs, reacts to all states */}
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
            {orbState === "idle" && "Zenkai Listening"}
            {orbState === "typing" && "Zenkai Listening..."}
            {orbState === "thinking" && (statusMessage || "Understanding your request...")}
            {orbState === "writing" && (statusMessage || "Writing response...")}
          </span>
        </div>

        {/* ─── Messages ─── */}
        <div className="flex-1 min-h-0 w-full overflow-y-auto scrollbar-custom border-t border-border/20">
          <div className="w-full max-w-5xl mx-auto px-4 py-4 space-y-8 md:space-y-10">
            {messages.length === 0 ? (
              /* Empty state — shown when navigating directly to chat with no messages */
              <div className="h-[50vh] flex flex-col items-center justify-center gap-3 opacity-50">
                <span className="font-heading text-2xl font-light text-muted-foreground italic">
                  Begin your dialogue
                </span>
                <span className="font-sans text-xs text-muted-foreground/70 tracking-wide">
                  Zenkai is ready to listen
                </span>
              </div>
            ) : (
              messages.map((msg) => {
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

          {/* Input form — identical to home screen */}
          <form onSubmit={handleSend} className="relative w-full">
            <div className="w-full bg-secondary/80 hover:bg-secondary focus-within:bg-secondary border border-border/50 focus-within:border-accent/40 focus-within:ring-1 focus-within:ring-accent/30 rounded-2xl shadow-sm focus-within:shadow-md transition-all duration-300 flex flex-col px-5 pt-4 pb-3 gap-3">
              
              {/* Textarea */}
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

              {/* Bottom bar: hint + send button */}
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
