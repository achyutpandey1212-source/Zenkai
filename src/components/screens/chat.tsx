"use client";

import React, { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { Send, Sparkles } from "lucide-react";

export default function Chat() {
  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: "companion",
      text: "Hello Achyut. I have been reflecting on your goal to build Zenkai. What is the most important thing you want to focus on today?",
      time: "10:00 AM"
    },
    {
      id: 2,
      sender: "user",
      text: "I need to design the frontend screens. I'm feeling a bit overwhelmed by the styling rules.",
      time: "10:02 AM"
    },
    {
      id: 3,
      sender: "companion",
      text: "I understand. The design guidelines ask for 'expensive silence'—meaning large empty spaces and calm layout. Let's simplify: only focus on the core layout first. Shall we structure the Tasks today?",
      time: "10:03 AM"
    }
  ]);
  
  const [inputText, setInputText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const newMsg = {
      id: messages.length + 1,
      sender: "user",
      text: inputText,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, newMsg]);
    setInputText("");

    // Simulate companion response
    setTimeout(() => {
      setMessages(prev => [
        ...prev,
        {
          id: prev.length + 1,
          sender: "companion",
          text: "I am noting this down. I'll align your schedule to protect your focus block on this.",
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    }, 1500);
  };

  const handleQuickAction = (action: string) => {
    setInputText(action);
  };

  const quickActions = [
    "Plan My Week",
    "Review Goals",
    "Help Me Focus",
    "Reflect On Today"
  ];

  return (
    <div className="relative min-h-screen w-full flex flex-col md:flex-row bg-background">
      
      {/* Left side: Companion Status Panel (Stays fixed & premium) */}
      <div className="w-full md:w-80 border-b md:border-b-0 md:border-r border-border/60 flex flex-col items-center justify-center p-8 bg-secondary/30 shrink-0">
        <div className="relative flex flex-col items-center gap-6">
          {/* Subtle Glow */}
          <div className="absolute -inset-6 rounded-full bg-accent/5 blur-2xl opacity-75" />
          
          {/* Small Companion Orb */}
          <div className="relative w-36 h-36 animate-bounce" style={{ animationDuration: "6s" }}>
            <Image
              src="/assets/orbs/companion_orb.png"
              alt="Companion Orb"
              fill
              className="object-contain"
            />
          </div>
          
          <div className="text-center">
            <h2 className="font-heading text-2xl font-semibold text-foreground">Zenkai</h2>
            <p className="font-sans text-xs tracking-wider text-accent uppercase mt-1">Online & Listening</p>
          </div>
          
          <div className="mt-4 px-4 py-2 bg-secondary rounded-full border border-border/40 text-[11px] text-muted-foreground font-sans tracking-wide">
            Understanding Your Focus
          </div>
        </div>
      </div>

      {/* Right side: Chat Thread */}
      <div className="flex-1 flex flex-col h-[calc(100vh-200px)] md:h-screen max-w-4xl mx-auto w-full relative">
        
        {/* Header */}
        <header className="px-8 py-6 border-b border-border/40 flex justify-between items-center bg-background/80 backdrop-blur-md z-10">
          <div className="flex items-center gap-3">
            <div className="h-2 w-2 rounded-full bg-accent animate-pulse" />
            <span className="font-heading text-lg font-medium text-foreground italic">Dialogue with Partner</span>
          </div>
        </header>

        {/* Message Area */}
        <div className="flex-1 overflow-y-auto p-8 space-y-8 scrollbar-thin">
          {messages.map((msg) => {
            const isUser = msg.sender === "user";
            return (
              <div
                key={msg.id}
                className={`flex w-full ${isUser ? "justify-end animate-slide-in-right" : "justify-start animate-slide-in-left"}`}
              >
                <div className={`max-w-xl flex flex-col gap-2`}>
                  {/* Sender indicator */}
                  <span className={`text-[10px] font-sans tracking-widest text-muted-foreground uppercase ${isUser ? "text-right" : "text-left"}`}>
                    {isUser ? "Achyut" : "Zenkai"}
                  </span>
                  
                  {/* Bubble */}
                  <div
                    className={`rounded-2xl px-6 py-4 font-sans text-sm leading-relaxed shadow-sm ${
                      isUser
                        ? "bg-primary text-primary-foreground rounded-tr-none"
                        : "bg-secondary text-foreground border border-border/40 rounded-tl-none"
                    }`}
                  >
                    {msg.text}
                  </div>
                  
                  {/* Time */}
                  <span className={`text-[9px] font-sans text-muted-foreground/60 ${isUser ? "text-right" : "text-left"}`}>
                    {msg.time}
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
          <div className="flex flex-wrap gap-2 justify-center">
            {quickActions.map((action) => (
              <button
                key={action}
                onClick={() => handleQuickAction(action)}
                className="px-4 py-2 rounded-full border border-border bg-background hover:bg-secondary text-xs text-muted-foreground hover:text-foreground font-sans transition-all duration-200 flex items-center gap-1.5"
              >
                <Sparkles size={12} className="text-accent" />
                {action}
              </button>
            ))}
          </div>

          {/* Form */}
          <form onSubmit={handleSend} className="relative flex items-center">
            <input
              type="text"
              placeholder="Speak with Zenkai..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              className="w-full bg-secondary/80 hover:bg-secondary focus:bg-secondary text-foreground font-sans placeholder:text-muted-foreground/60 rounded-full py-4 pl-6 pr-14 border border-border/50 focus:border-accent/40 focus:ring-1 focus:ring-accent/40 transition-all duration-300 outline-none text-sm"
            />
            <button
              type="submit"
              className="absolute right-2 p-2.5 rounded-full bg-primary hover:bg-accent text-primary-foreground hover:text-foreground transition-all duration-200 shadow"
            >
              <Send size={16} />
            </button>
          </form>
        </footer>

      </div>

    </div>
  );
}
