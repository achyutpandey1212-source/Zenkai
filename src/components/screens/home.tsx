"use client";

import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import CompanionOrb, { OrbState } from "../ui/companion-orb";

interface HomeProps {
  messages: any[];
  sendMessage: (text: string) => Promise<void>;
  orbState: OrbState;
  statusMessage: string;
  hasStartedChat: boolean;
  setOrbState: React.Dispatch<React.SetStateAction<OrbState>>;
  onNavigateToChat: () => void;
}

export default function Home({
  messages,
  sendMessage,
  orbState,
  statusMessage,
  hasStartedChat,
  setOrbState,
  onNavigateToChat,
}: HomeProps) {
  const [query, setQuery] = useState("");
  const [userName, setUserName] = useState("Achyut");
  const [longTermGoal, setLongTermGoal] = useState("Software Engineer");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load profile data from MongoDB via API (not localStorage).
  useEffect(() => {
    async function loadProfile() {
      try {
        const res = await fetch("/api/user/profile");
        if (res.ok) {
          const data = await res.json();
          const profile = data.profile;
          if (profile?.longTermGoal) setLongTermGoal(profile.longTermGoal);
        }
      } catch {
        // Silently fall back to defaults
      }
    }

    async function loadUserName() {
      try {
        const res = await fetch("/api/auth/me");
        if (res.ok) {
          const data = await res.json();
          if (data.user?.name) setUserName(data.user.name);
        }
      } catch {
        // Silently fall back to default
      }
    }

    loadProfile();
    loadUserName();
  }, []);

  // Scroll to bottom of message list on updates
  useEffect(() => {
    if (hasStartedChat) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, hasStartedChat]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    if (val.trim()) {
      setOrbState("typing");
    } else {
      setOrbState("idle");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    const textToSend = query;
    setQuery("");
    await sendMessage(textToSend);
  };

  return (
    <div className="relative h-screen max-h-screen w-full flex flex-col p-6 pb-8 md:p-12 md:pb-12 overflow-hidden bg-background">
      
      {/* Temple Background on the right side with smooth fade mask */}
      <div 
        className="absolute right-0 top-0 h-full w-full md:w-1/2 pointer-events-none select-none z-0"
        style={{
          maskImage: "linear-gradient(to left, rgba(0,0,0,1) 50%, rgba(0,0,0,0) 100%)",
          WebkitMaskImage: "linear-gradient(to left, rgba(0,0,0,1) 50%, rgba(0,0,0,0) 100%)"
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

      {/* Main Column Wrapper */}
      <div className="relative z-10 w-full h-full flex flex-col justify-between">
        
        {/* Top Section: Greeting */}
        <header className={`max-w-xl self-start flex flex-col relative w-full transition-all duration-1000 ease-in-out ${
          hasStartedChat 
            ? "min-h-0 h-0 opacity-0 overflow-hidden m-0" 
            : "mt-4 min-h-[120px] opacity-100"
        }`}>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col">
              <span className="font-heading text-3xl md:text-4xl font-light text-muted-foreground italic">
                Good Morning,
              </span>
              <span className="font-signature text-6xl md:text-7xl text-accent mt-1 leading-none">
                {userName}
              </span>
            </div>
            <p className="font-sans text-sm md:text-base text-muted-foreground max-w-md leading-relaxed">
              I've already started planning today around your goal of becoming a <span className="text-foreground font-semibold">{longTermGoal}</span>. Let's make progress.
            </p>
          </div>
        </header>

        {/* Center Section: Floating Companion Orb & Status messages */}
        <div 
          className={`flex flex-col items-center justify-center transition-all duration-1000 ease-in-out ${
            hasStartedChat 
              ? "h-20 md:h-24 py-1" 
              : "h-[45vh] md:h-[50vh] py-6 md:py-12"
          }`}
        >
          <CompanionOrb 
            state={orbState} 
            size={hasStartedChat ? "xs" : "lg"} 
            className="transition-all duration-1000"
          />

          {/* Status Message Text */}
          <span 
            className={`font-sans text-[11px] tracking-[0.25em] font-medium uppercase mt-2 transition-all duration-500 min-h-[16px] ${
              orbState === "idle" ? "text-accent/60" : "text-accent animate-pulse"
            }`}
          >
            {orbState === "idle" && "Zenkai Listening"}
            {orbState === "typing" && "Zenkai Listening..."}
            {orbState === "thinking" && (statusMessage || "Understanding your request...")}
            {orbState === "writing" && (statusMessage || "Writing response...")}
          </span>
        </div>

        {/* growing/sliding conversation container */}
        <div 
          className={`flex-1 w-full max-w-2xl mx-auto overflow-hidden flex flex-col transition-all duration-1000 ease-in-out ${
            hasStartedChat 
              ? "opacity-100 translate-y-0 mt-2 mb-2" 
              : "opacity-0 translate-y-12 max-h-0 h-0 pointer-events-none"
          }`}
        >
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6 scrollbar-thin border-t border-b border-border/20 bg-background/20 backdrop-blur-[2px] rounded-xl">
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
                  <div className="max-w-[85%] md:max-w-xl flex flex-col gap-1.5">
                    <span className={`text-[9px] font-sans tracking-widest text-muted-foreground/80 uppercase ${isUser ? "text-right" : "text-left"}`}>
                      {isUser ? userName : "Zenkai"}
                    </span>
                    <div
                      className={`rounded-2xl px-5 py-3 font-sans text-sm leading-relaxed shadow-sm whitespace-pre-wrap ${
                        isUser
                          ? "bg-primary text-primary-foreground rounded-tr-none"
                          : "bg-secondary/90 text-foreground border border-border/30 rounded-tl-none"
                      }`}
                    >
                      {msg.content}
                    </div>
                    <span className={`text-[8px] font-sans text-muted-foreground/50 ${isUser ? "text-right" : "text-left"}`}>
                      {timeString}
                    </span>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Bottom Section: Ask Zenkai Input */}
        <footer className="w-full max-w-2xl mx-auto mb-2">
          <form onSubmit={handleSubmit} className="relative flex items-center">
            <input
              type="text"
              placeholder="Ask Zenkai anything..."
              value={query}
              onChange={handleInputChange}
              className="w-full bg-secondary/80 hover:bg-secondary focus:bg-secondary text-foreground font-sans placeholder:text-muted-foreground/60 rounded-full py-4.5 pl-7 pr-14 border border-border/50 focus:border-accent/40 focus:ring-1 focus:ring-accent/40 shadow-sm focus:shadow-md transition-all duration-300 outline-none text-sm md:text-base"
            />
            <button 
              type="submit"
              className="absolute right-2.5 p-2.5 rounded-full bg-primary hover:bg-accent text-primary-foreground hover:text-foreground transition-all duration-300 shadow-md flex items-center justify-center"
            >
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                fill="none" 
                viewBox="0 0 24 24" 
                strokeWidth={2} 
                stroke="currentColor" 
                className="w-4.5 h-4.5"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </button>
          </form>
        </footer>

      </div>
    </div>
  );
}
