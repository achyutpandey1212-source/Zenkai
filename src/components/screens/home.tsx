"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";

interface HomeProps {
  onNavigateToChat: () => void;
}

export default function Home({ onNavigateToChat }: HomeProps) {
  const [query, setQuery] = useState("");
  const [orbActive, setOrbActive] = useState(false);

  // Periodic rotation or floating trigger
  useEffect(() => {
    const interval = setInterval(() => {
      setOrbActive(prev => !prev);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      // For now, navigate to chat
      onNavigateToChat();
    }
  };

  return (
    <div className="relative h-screen max-h-screen w-full flex flex-col justify-between p-8 pb-20 md:p-12 md:pb-16 overflow-hidden bg-background">
      
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
          className="object-cover object-right-bottom opacity-75 dark:opacity-30 transition-opacity duration-1000"
        />
      </div>

      {/* Top Section: Greeting & AI message */}
      <header className="z-10 max-w-xl self-start flex flex-col gap-4 mt-8 animate-fade-in">
        <div className="flex flex-col">
          <span className="font-heading text-4xl font-light text-muted-foreground italic">
            Good Morning,
          </span>
          <span className="font-signature text-7xl text-accent mt-1 leading-none">
            Achyut
          </span>
        </div>
        <p className="font-sans text-lg text-muted-foreground max-w-md leading-relaxed">
          I have already planned the day for you. You have <span className="text-foreground font-semibold">3 priorities</span> today.
        </p>
      </header>

      {/* Center Section: Floating Companion Orb (Shifted upwards vertically) */}
      <div className="flex-1 flex items-center justify-start pt-6 md:pt-12 flex-col z-10">
        <div className="relative group cursor-pointer flex flex-col items-center gap-4 md:-translate-y-12">
          {/* Subtle Background Glow */}
          <div className="absolute -inset-10 rounded-full bg-accent/10 blur-3xl opacity-60 group-hover:opacity-85 transition-opacity duration-1000" />
          
          {/* Orb Container with Float and Periodical Swirl */}
          <div 
            className={`relative w-44 h-44 md:w-60 md:h-60 transition-transform duration-[4000ms] ease-in-out ${
              orbActive ? "translate-y-2 rotate-6 scale-105" : "-translate-y-2 -rotate-6 scale-95"
            }`}
          >
            <Image
              src="/assets/orbs/companion_orb.png"
              alt="Companion Orb"
              fill
              priority
              sizes="256px"
              className="object-contain drop-shadow-[0_10px_20px_rgba(201,168,106,0.15)] group-hover:drop-shadow-[0_15px_30px_rgba(201,168,106,0.3)] transition-all duration-500"
            />
          </div>

          <span className="font-sans text-xs tracking-[0.2em] text-accent/80 font-medium uppercase animate-pulse">
            Zenkai Listening
          </span>
        </div>
      </div>

      {/* Bottom Section: Ask Zenkai Input */}
      <footer className="z-10 w-full max-w-2xl mx-auto mb-2 md:mb-4">
        <form onSubmit={handleSubmit} className="relative flex items-center">
          <input
            type="text"
            placeholder="Ask Zenkai anything..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-secondary/80 hover:bg-secondary focus:bg-secondary text-foreground font-sans placeholder:text-muted-foreground/60 rounded-full py-5 pl-8 pr-16 border border-border/50 focus:border-accent/40 focus:ring-1 focus:ring-accent/40 shadow-sm focus:shadow-md transition-all duration-300 outline-none text-base"
          />
          <button 
            type="submit"
            className="absolute right-3 p-3 rounded-full bg-primary hover:bg-accent text-primary-foreground hover:text-foreground transition-all duration-300 shadow-md flex items-center justify-center"
          >
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              fill="none" 
              viewBox="0 0 24 24" 
              strokeWidth={2} 
              stroke="currentColor" 
              className="w-5 h-5"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </button>
        </form>
      </footer>

    </div>
  );
}
