"use client";

import React, { useState, useRef, useEffect } from "react";
import { Send, Sparkles } from "lucide-react";
import CompanionOrb, { OrbState } from "../ui/companion-orb";

interface ChatProps {
  messages: any[];
  sendMessage: (text: string) => Promise<void>;
  orbState: OrbState;
  statusMessage: string;
  setOrbState: React.Dispatch<React.SetStateAction<OrbState>>;
  userName: string;
}

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

  // Auto-scroll on message updates
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Adjust textarea height automatically
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`;
    }
  }, [inputText]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInputText(val);
    if (val.trim()) {
      setOrbState("typing");
    } else {
      setOrbState("idle");
    }
  };

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputText.trim()) return;

    const textToSend = inputText;
    setInputText("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
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
  };

  const quickActions = [
    "Plan My Week",
    "Review Goals",
    "Help Me Focus",
    "Reflect On Today"
  ];

  return (
    <div className="relative h-screen max-h-screen w-full flex flex-col md:flex-row bg-background overflow-hidden">
      
      {/* Left side: Companion Status Panel */}
      <div className="hidden md:flex md:w-80 border-b md:border-b-0 md:border-r border-border/60 flex-col items-center justify-center p-8 bg-secondary/30 shrink-0 h-auto md:h-full">
        <div className="relative flex flex-col items-center gap-6">
          {/* Unified Companion Orb with dynamic states */}
          <CompanionOrb state={orbState} size="sm" />
          
          <div className="text-center">
            <h2 className="font-heading text-2xl font-semibold text-foreground">Zenkai</h2>
            <p className="font-sans text-xs tracking-wider text-accent uppercase mt-1">
              {orbState === "idle" && "Online & Listening"}
              {orbState === "typing" && "Listening..."}
              {orbState === "thinking" && "Understanding..."}
              {orbState === "writing" && "Writing response..."}
            </p>
          </div>
          
          <div className="mt-4 px-4 py-2 bg-secondary rounded-full border border-border/40 text-[11px] text-muted-foreground font-sans tracking-wide min-h-[32px] text-center max-w-[220px] transition-all duration-300">
            {statusMessage || "Understanding Your Focus"}
          </div>
        </div>
      </div>

      {/* Right side: Chat Thread */}
      <div className="flex-1 flex flex-col h-full max-w-4xl mx-auto w-full relative overflow-hidden">
        
        {/* Header */}
        <header className="px-6 py-4 md:px-8 md:py-6 border-b border-border/40 flex justify-between items-center bg-background/80 backdrop-blur-md z-10 shrink-0">
          <div className="flex items-center gap-3">
            {/* Mobile-only avatar */}
            <div className="relative w-8 h-8 md:hidden shrink-0 flex items-center justify-center">
              <CompanionOrb state={orbState} size="sm" className="!w-8 !h-8" />
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-accent animate-pulse" />
              <span className="font-heading text-base md:text-lg font-medium text-foreground italic">Dialogue with Zenkai</span>
            </div>
          </div>
        </header>

        {/* Message Area */}
        <div className="flex-1 overflow-y-auto p-8 space-y-8 scrollbar-thin">
          {messages.map((msg) => {
            const isUser = msg.role === "user";
            const timeString = msg.createdAt
              ? new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
              : new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

            return (
              <div
                key={msg._id}
                className={`flex w-full ${isUser ? "justify-end animate-slide-in-right" : "justify-start animate-slide-in-left"}`}
              >
                <div className="max-w-[85%] md:max-w-xl flex flex-col gap-2">
                  {/* Sender indicator */}
                  <span className={`text-[10px] font-sans tracking-widest text-muted-foreground uppercase ${isUser ? "text-right" : "text-left"}`}>
                    {isUser ? userName : "Zenkai"}
                  </span>
                  
                  {/* Bubble */}
                  <div
                    className={`rounded-2xl px-6 py-4 font-sans text-sm leading-relaxed shadow-sm whitespace-pre-wrap ${
                      isUser
                        ? "bg-primary text-primary-foreground rounded-tr-none"
                        : "bg-secondary text-foreground border border-border/40 rounded-tl-none"
                    }`}
                  >
                    {msg.content}
                  </div>
                  
                  {/* Time */}
                  <span className={`text-[9px] font-sans text-muted-foreground/60 ${isUser ? "text-right" : "text-left"}`}>
                    {timeString}
                  </span>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Action Panel and Input */}
        <footer className="p-8 border-t border-border/40 bg-background/80 backdrop-blur-md space-y-4">
          
          {/* Suggested Actions */}
          <div className="flex flex-row overflow-x-auto whitespace-nowrap scrollbar-none gap-2 py-1.5 px-2 justify-start md:justify-center w-full max-w-full shrink-0">
            {quickActions.map((action) => (
              <button
                key={action}
                onClick={() => handleQuickAction(action)}
                className="px-3.5 py-1.5 rounded-full border border-border/80 bg-background/30 hover:bg-secondary text-[11px] text-muted-foreground hover:text-foreground font-sans transition-all duration-200 flex items-center gap-1.5 shrink-0"
              >
                <Sparkles size={10} className="text-accent" />
                {action}
              </button>
            ))}
          </div>

          {/* Form */}
          <form onSubmit={handleSend} className="relative flex items-end w-full">
            <div className="w-full bg-secondary/80 hover:bg-secondary focus-within:bg-secondary border border-border/50 focus-within:border-accent/40 focus-within:ring-1 focus-within:ring-accent/40 rounded-[28px] shadow-sm focus-within:shadow-md transition-all duration-300 flex items-end p-1 pr-14 pl-5">
              <textarea
                ref={textareaRef}
                rows={1}
                placeholder="Speak with Zenkai..."
                value={inputText}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                className="w-full bg-transparent text-foreground font-sans placeholder:text-muted-foreground/60 py-3 outline-none text-sm resize-none min-h-[44px] max-h-[160px] overflow-y-auto border-none focus:ring-0 focus:border-none focus:outline-none scrollbar-none"
                style={{ lineHeight: "1.5" }}
              />
            </div>
            <button
              type="submit"
              className="absolute right-2.5 bottom-2.5 p-2.5 rounded-full bg-primary hover:bg-accent text-primary-foreground hover:text-foreground transition-all duration-200 shadow flex items-center justify-center z-10"
            >
              <Send size={16} />
            </button>
          </form>
        </footer>

      </div>

    </div>
  );
}
