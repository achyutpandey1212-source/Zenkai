"use client";

import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence, useInView } from "framer-motion";
import { 
  Brain, 
  Sparkles, 
  Eye, 
  Shield, 
  Calendar, 
  Compass, 
  ArrowRight, 
  Check, 
  ChevronDown,
  Menu,
  X
} from "lucide-react";
import ThemeToggle from "@/components/theme-toggle";

// Story chapters configuration
const chapters = [
  { id: "hero", num: "01", title: "Begin" },
  { id: "problem", num: "02", title: "Fragment" },
  { id: "pipeline", num: "03", title: "Pipeline" },
  { id: "behind-zen", num: "04", title: "Specialists" },
  { id: "day-with-zen", num: "05", title: "Evolving" },
  { id: "comparison", num: "06", title: "Balance" },
  { id: "why-exists", num: "07", title: "Philosophy" },
  { id: "pricing", num: "08", title: "Pricing" },
  { id: "faq", num: "09", title: "Clarity" },
  { id: "cta", num: "10", title: "Become" }
];

// Persona schedule details for Section 5 (A Day With Zen)
const personaSchedules = {
  student: {
    label: "Student",
    morning: "Zen briefs you on classes and projects. Commuting time is optimized.",
    planning: "Zen schedules exam preparation blocks during your high-energy hours.",
    work: "2-hour deep study block on Machine Learning.",
    adjustment: "Unexpected exam date announced. Zen shifts roadmaps, rescheduling your evening gym session to clear a study block.",
    reflection: "Reviewing study goals. Zen notes you focused best in the late afternoon.",
    tomorrow: "Tomorrow's schedule is adjusted to add a quick recap session in the morning."
  },
  creator: {
    label: "Creator",
    morning: "Zen reviews video analytics and plans your creative writing time.",
    planning: "Reserves a 4-hour morning writing block before emails pile up.",
    work: "Deep scriptwriting and storyboard focus.",
    adjustment: "Video sponsor moves deadline up. Zen flags the urgency, rebalances other non-urgent goals, and clears your afternoon edit window.",
    reflection: "Logged 4 hours of screen time. Zen registers cognitive fatigue and suggests screen-free evening.",
    tomorrow: "Evolves tomorrow's script review block, shifting it to early morning."
  },
  founder: {
    label: "Founder",
    morning: "Zen highlights critical hiring decisions and investor follow-ups.",
    planning: "Secures prep blocks ahead of the 2:00 PM pitch meeting.",
    work: "Deep review of pitch slides and financials.",
    adjustment: "Investor pitch rescheduled to 11:00 AM. Zen immediately alerts you, reshapes your morning blocks, and pushes administrative tasks to tomorrow.",
    reflection: "Successful pitches. Zen logs your notes and reminders to follow up with team.",
    tomorrow: "Prepares a focus-heavy tomorrow, scheduling follow-up drafts and research."
  },
  professional: {
    label: "Professional",
    morning: "Zen briefs you on today's client calls and deliverables.",
    planning: "Protects a 3-hour focus window between team syncs.",
    work: "Deep coding / design sprint.",
    adjustment: "Client meeting runs late, eating into focus time. Zen automatically moves your deep-work sprint to tomorrow and reschedules internal catch-ups.",
    reflection: "Reflecting on day's meetings. Zen highlights tasks to delegate.",
    tomorrow: "Frees up tomorrow morning to compensate for today's lost focus hours."
  }
};

export default function LandingContent() {
  const [activeSection, setActiveSection] = useState("hero");
  const [mounted, setMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Section 2 (Problem) state
  const problemRef = useRef<HTMLDivElement>(null);
  const isProblemInView = useInView(problemRef, { amount: 0.3, once: false });
  const [problemStep, setProblemStep] = useState(0);

  // Section 3 (Pipeline) state
  const [pipelineStep, setPipelineStep] = useState(0);
  const pipelineRef = useRef<HTMLDivElement>(null);
  const isPipelineInView = useInView(pipelineRef, { amount: 0.35 });

  // Section 4 (Specialists) state
  const [hoveredSpecialist, setHoveredSpecialist] = useState<string | null>(null);

  // Section 5 (A Day With Zen) state
  const [activePersona, setActivePersona] = useState<"student" | "creator" | "founder" | "professional">("student");
  const [activeTimelineStep, setActiveTimelineStep] = useState<"morning" | "planning" | "work" | "adjustment" | "reflection" | "tomorrow">("morning");
  const [rebalancing, setRebalancing] = useState(false);

  // FAQ Accordion State
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  // Handle mounting and mobile detection
  useEffect(() => {
    const timer = setTimeout(() => {
      setMounted(true);
    }, 0);
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  // Section Intersection Observer for scroll tracking
  useEffect(() => {
    const observerOptions = {
      root: null,
      rootMargin: "-25% 0px -25% 0px", // Trigger when section occupies the middle part of the screen
      threshold: 0.1,
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          setActiveSection(entry.target.id);
        }
      });
    }, observerOptions);

    chapters.forEach((chapter) => {
      const el = document.getElementById(chapter.id);
      if (el) observer.observe(el);
    });

    return () => {
      chapters.forEach((chapter) => {
        const el = document.getElementById(chapter.id);
        if (el) observer.unobserve(el);
      });
    };
  }, []);

  // Animate the problem convergence when Section 2 is in view
  useEffect(() => {
    const timers: NodeJS.Timeout[] = [];
    if (isProblemInView) {
      // Step 1: Drift apart
      timers.push(setTimeout(() => setProblemStep(1), 800));
      // Step 2: Converging (Orb enters and cards merge)
      timers.push(setTimeout(() => setProblemStep(2), 2000));
      // Step 3: Resolved (Cards dissolved, only Orb remains)
      timers.push(setTimeout(() => setProblemStep(3), 3900));
      // Step 4: Text reveal
      timers.push(setTimeout(() => setProblemStep(4), 4700));
    } else {
      timers.push(setTimeout(() => setProblemStep(0), 0));
    }
    return () => {
      timers.forEach(clearTimeout);
    };
  }, [isProblemInView]);

  // Animate the pipeline step-by-step when Section 3 is in view (runs once)
  useEffect(() => {
    let interval: NodeJS.Timeout;
    let timer: NodeJS.Timeout;
    if (isPipelineInView) {
      interval = setInterval(() => {
        setPipelineStep((prev) => {
          if (prev < 5) return prev + 1;
          clearInterval(interval);
          return prev;
        });
      }, 2000);
    } else {
      timer = setTimeout(() => {
        setPipelineStep(0);
      }, 0);
    }
    return () => {
      if (interval) clearInterval(interval);
      if (timer) clearTimeout(timer);
    };
  }, [isPipelineInView]);

  // Handle persona change with a short rebalancing flash
  const handlePersonaChange = (key: "student" | "creator" | "founder" | "professional") => {
    if (key === activePersona) return;
    setRebalancing(true);
    setTimeout(() => {
      setActivePersona(key);
      setRebalancing(false);
    }, 450);
  };

  // Determine dynamic Orb style based on active section, active pipeline step, and screen width
  const getOrbStyle = () => {
    if (isMobile) {
      switch (activeSection) {
        case "hero":
          return { left: "50%", top: "40%", scale: 0.7, opacity: 0.45, blur: "24px" };
        case "problem":
          return { 
            left: "50%", 
            top: "48%", 
            scale: problemStep >= 2 ? 0.65 : 0, 
            opacity: problemStep >= 2 ? 0.45 : 0, 
            blur: "24px" 
          };
        case "pipeline":
          return { left: "50%", top: "82%", scale: 0.55, opacity: 0.25, blur: "24px" };
        case "behind-zen":
          return { left: "50%", top: "36%", scale: 0.65, opacity: 0.4, blur: "20px" };
        case "day-with-zen":
          return { left: "50%", top: "78%", scale: 0.55, opacity: 0.25, blur: "28px" };
        case "comparison":
          return { left: "50%", top: "80%", scale: 0.5, opacity: 0.08, blur: "32px" };
        case "why-exists":
          return { left: "50%", top: "50%", scale: 1.1, opacity: 0.12, blur: "40px" };
        case "pricing":
          return { left: "50%", top: "85%", scale: 0.65, opacity: 0.12, blur: "32px" };
        case "faq":
          return { left: "50%", top: "80%", scale: 0.55, opacity: 0.08, blur: "35px" };
        case "cta":
          return { left: "50%", top: "32%", scale: 1.1, opacity: 0.65, blur: "16px" };
        default:
          return { left: "50%", top: "35%", scale: 0.7, opacity: 0.4, blur: "24px" };
      }
    } else {
      // Desktop positioning
      switch (activeSection) {
        case "hero":
          return { left: "72%", top: "50%", scale: 1.0, opacity: 0.6, blur: "28px" };
        case "problem":
          return { 
            left: "50%", 
            top: "55%", 
            scale: problemStep >= 2 ? 0.8 : 0, 
            opacity: problemStep >= 2 ? 0.6 : 0, 
            blur: "35px" 
          };
        case "pipeline": {
          const verticalSteps = ["28vh", "38vh", "48vh", "58vh", "68vh", "78vh"];
          const stepTop = verticalSteps[pipelineStep] || "50vh";
          return { left: "35vw", top: stepTop, scale: 0.75, opacity: 0.45, blur: "20px" };
        }
        case "behind-zen":
          return { left: "50%", top: "56%", scale: 0.85, opacity: 0.55, blur: "22px" };
        case "day-with-zen":
          return { left: "76%", top: "52%", scale: 0.8, opacity: 0.35, blur: "28px" };
        case "comparison":
          return { left: "80%", top: "45%", scale: 0.8, opacity: 0.12, blur: "36px" };
        case "why-exists":
          return { left: "50%", top: "50%", scale: 1.7, opacity: 0.14, blur: "48px" };
        case "pricing":
          return { left: "18%", top: "62%", scale: 0.85, opacity: 0.15, blur: "35px" };
        case "faq":
          return { left: "82%", top: "38%", scale: 0.8, opacity: 0.1, blur: "40px" };
        case "cta":
          return { left: "50%", top: "42%", scale: 1.5, opacity: 0.75, blur: "18px" };
        default:
          return { left: "70%", top: "50%", scale: 1.0, opacity: 0.6, blur: "28px" };
      }
    }
  };

  // Determine appropriate animation/glow classes for the Orb
  const getOrbAnimationClasses = () => {
    if (activeSection === "behind-zen" && hoveredSpecialist) {
      switch (hoveredSpecialist) {
        case "memory": return "animate-orb-memory-inward animate-glow-memory";
        case "planning": return "animate-orb-planning-rings animate-glow-planning";
        case "reflection": return "animate-orb-reflection-glow animate-glow-reflection";
        case "identity": return "animate-orb-identity-shimmer animate-glow-identity";
        case "scheduling": return "animate-orb-execution-orbit animate-glow-execution";
        case "companion": return "animate-orb-listening animate-glow-listening";
        default: return "animate-orb-float animate-glow-idle";
      }
    }

    switch (activeSection) {
      case "hero": return "animate-orb-float animate-glow-listening";
      case "problem": return "animate-orb-memory-inward animate-glow-memory";
      case "pipeline": return "animate-orb-planning-rings animate-glow-planning";
      case "why-exists": return "animate-orb-reflection-glow animate-glow-golden";
      case "cta": return "animate-orb-identity-shimmer animate-glow-golden";
      default: return "animate-orb-float animate-glow-idle";
    }
  };

  // Smooth scroll helper
  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
      setMobileMenuOpen(false);
    }
  };

  const orbStyle = getOrbStyle();
  const orbClasses = getOrbAnimationClasses();

  return (
    <div className="min-h-screen w-full bg-background text-foreground overflow-x-hidden selection:bg-accent/20 selection:text-foreground font-sans scroll-smooth">
      
      {/* 1. Global Navigation Bar */}
      <nav className="fixed top-0 left-0 w-full z-50 py-5 px-6 md:px-16 flex justify-between items-center bg-background/60 backdrop-blur-md border-b border-border/10">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => scrollToSection("hero")}>
          <span className="font-heading text-xl md:text-2xl font-light tracking-widest text-foreground hover:text-accent transition-colors">
            ZENKAI
          </span>
        </div>
        
        {/* Desktop Nav Links */}
        <div className="hidden md:flex items-center gap-8 font-sans">
          <button onClick={() => scrollToSection("pipeline")} className="text-[10px] tracking-wider uppercase font-semibold text-muted-foreground hover:text-foreground transition-colors cursor-pointer">Pipeline</button>
          <button onClick={() => scrollToSection("behind-zen")} className="text-[10px] tracking-wider uppercase font-semibold text-muted-foreground hover:text-foreground transition-colors cursor-pointer">Intelligence</button>
          <button onClick={() => scrollToSection("day-with-zen")} className="text-[10px] tracking-wider uppercase font-semibold text-muted-foreground hover:text-foreground transition-colors cursor-pointer">A Day With Zen</button>
          <button onClick={() => scrollToSection("pricing")} className="text-[10px] tracking-wider uppercase font-semibold text-muted-foreground hover:text-foreground transition-colors cursor-pointer">Pricing</button>
        </div>

        <div className="flex items-center gap-4">
          <ThemeToggle />
          <Link
            href="/login"
            className="hidden sm:inline-block font-sans text-xs tracking-wider uppercase font-semibold text-muted-foreground hover:text-foreground transition-colors"
          >
            Sign In
          </Link>
          <Link
            href="/signup"
            className="font-sans text-xs tracking-wider uppercase font-semibold py-2.5 px-6 rounded-full bg-primary text-primary-foreground hover:bg-accent hover:text-accent-foreground transition-all duration-300 shadow-sm"
          >
            Begin Journey
          </Link>
          
          {/* Mobile Menu Button */}
          <button 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-foreground hover:text-accent transition-colors cursor-pointer"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </nav>

      {/* Mobile Drawer Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed inset-0 top-[73px] z-40 bg-background/95 backdrop-blur-lg flex flex-col items-center justify-start pt-16 gap-8 px-8 border-b border-border/20 md:hidden"
          >
            <button onClick={() => scrollToSection("pipeline")} className="text-base tracking-wider uppercase font-semibold hover:text-accent transition-colors">Pipeline</button>
            <button onClick={() => scrollToSection("behind-zen")} className="text-base tracking-wider uppercase font-semibold hover:text-accent transition-colors">Intelligence</button>
            <button onClick={() => scrollToSection("day-with-zen")} className="text-base tracking-wider uppercase font-semibold hover:text-accent transition-colors">A Day With Zen</button>
            <button onClick={() => scrollToSection("pricing")} className="text-base tracking-wider uppercase font-semibold hover:text-accent transition-colors">Pricing</button>
            <Link 
              href="/login"
              className="text-base tracking-wider uppercase font-semibold text-muted-foreground hover:text-accent transition-colors mt-4"
              onClick={() => setMobileMenuOpen(false)}
            >
              Sign In
            </Link>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 2. Persistent Single Orb System */}
      {mounted && (
        <div 
          className="fixed pointer-events-none transition-all duration-[1200ms] cubic-bezier(0.16, 1, 0.3, 1) z-0 flex items-center justify-center"
          style={{
            left: orbStyle.left,
            top: orbStyle.top,
            transform: `translate(-50%, -50%) scale(${orbStyle.scale})`,
            width: "320px",
            height: "320px",
            opacity: orbStyle.opacity,
            transitionProperty: "left, top, transform, opacity"
          }}
        >
          {/* Ambient Outer Glow */}
          <div 
            className="absolute inset-0 rounded-full bg-accent/15 transition-all duration-[1200ms] cubic-bezier(0.16, 1, 0.3, 1)"
            style={{
              filter: `blur(${orbStyle.blur})`,
            }}
          />
          {/* Breathing Core Orb */}
          <div className={`relative w-[240px] h-[240px] ${orbClasses}`}>
            <Image
              src="/assets/orbs/companion_orb.webp"
              alt="Zen Intelligent Core"
              fill
              sizes="240px"
              priority
              className="object-contain drop-shadow-[0_15px_30px_rgba(201,168,106,0.14)] dark:drop-shadow-[0_15px_30px_rgba(201,168,106,0.06)]"
            />
          </div>
        </div>
      )}

      {/* 3. Subtle Vertical Story Tracker */}
      <div className="fixed right-6 md:right-10 top-1/2 -translate-y-1/2 z-40 hidden sm:flex flex-col items-end gap-3 pointer-events-none">
        <span className="font-heading text-xs italic text-accent tracking-widest opacity-80 mb-2">chapters</span>
        {chapters.map((chapter) => {
          const isActive = activeSection === chapter.id;
          return (
            <button
              key={chapter.id}
              onClick={() => scrollToSection(chapter.id)}
              className="group pointer-events-auto flex items-center gap-3 cursor-pointer py-1"
            >
              <span className={`text-[10px] tracking-widest transition-all duration-300 font-mono ${
                isActive ? "text-accent font-semibold translate-x-0 opacity-100" : "text-muted-foreground/30 group-hover:text-muted-foreground group-hover:opacity-75 translate-x-2 opacity-0 group-hover:opacity-100"
              }`}>
                {chapter.title}
              </span>
              <span className={`text-[11px] font-mono transition-colors duration-300 ${
                isActive ? "text-accent font-bold" : "text-muted-foreground/40 group-hover:text-foreground"
              }`}>
                {chapter.num}
              </span>
              <span className={`h-1.5 rounded-full transition-all duration-300 ${
                isActive ? "w-4 bg-accent" : "w-1.5 bg-border/40 group-hover:bg-muted-foreground/50"
              }`} />
            </button>
          );
        })}
      </div>

      {/* 4. STORY SECTIONS CONTAINER */}
      <main className="relative z-10 w-full">

        {/* =====================================================================
            SECTION 1: HERO (Begin)
            ===================================================================== */}
        <section 
          id="hero" 
          className="relative min-h-screen w-full flex flex-col justify-center items-start px-6 md:px-24 overflow-hidden pt-20"
        >
          <div className="max-w-2xl space-y-8 z-10">
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className="space-y-4"
            >
              <span className="font-sans text-xs tracking-[0.3em] text-accent font-bold uppercase block">
                AI Growth Partner
              </span>
              <h1 className="font-heading text-5xl md:text-8xl font-light leading-[1.05] tracking-tight text-foreground">
                Stop Planning.<br />
                <span className="italic font-normal">Start Becoming.</span>
              </h1>
            </motion.div>

            <motion.p 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
              className="font-sans text-base md:text-lg text-muted-foreground max-w-lg leading-relaxed font-light"
            >
              Zenkai quietly understands your ambitions, plans your growth, and helps you become the person you want to be.
            </motion.p>

            <motion.div 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="flex items-center gap-4 pt-4"
            >
              <Link
                href="/signup"
                className="py-4 px-10 rounded-full font-sans text-xs tracking-wider uppercase font-semibold bg-primary text-primary-foreground hover:bg-accent hover:text-accent-foreground transition-all duration-300 shadow-sm hover:shadow-md"
              >
                Begin Journey
              </Link>
            </motion.div>
          </div>
        </section>

        {/* =====================================================================
            SECTION 2: THE PROBLEM (Fragment)
            ===================================================================== */}
        <section 
          id="problem" 
          className="relative min-h-screen w-full flex flex-col justify-center items-center px-6 text-center border-t border-border/10 py-24 bg-[#0a0a0a]"
        >
          {/* Subtle grid pattern background */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f1f1f0a_1px,transparent_1px),linear-gradient(to_bottom,#1f1f1f0a_1px,transparent_1px)] bg-[size:4rem_4rem] pointer-events-none" />
          
          <div ref={problemRef} className="max-w-6xl mx-auto space-y-16 w-full z-10 relative">
            <div className="space-y-4">
              <span className="font-sans text-xs tracking-[0.25em] text-accent font-bold uppercase block">
                The Problem
              </span>
              <h2 className="font-heading text-3xl md:text-5xl font-light leading-snug text-foreground animate-fade-in">
                The Fragmentation of Self
              </h2>
            </div>

            {/* Convergence Container with real simplified application windows */}
            <div className="relative h-[480px] md:h-[600px] w-full max-w-5xl mx-auto flex items-center justify-center overflow-hidden">
              
              {/* Scattered cards flying into center */}
              {[
                { 
                  id: "calendar", 
                  title: "Google Calendar", 
                  x: -240, y: -130, r: -5, scale: 0.95, blur: "0.5px",
                  content: (
                    <div className="space-y-1.5 text-left font-mono">
                      <div className="text-[9px] text-accent font-semibold flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-accent animate-ping" />
                        10:00 AM Meeting
                      </div>
                      <div className="text-[9px] text-muted-foreground/80">02:00 PM Assignment</div>
                      <div className="text-[9px] text-muted-foreground/80">07:00 PM Gym Workout</div>
                    </div>
                  )
                },
                { 
                  id: "todo", 
                  title: "Todoist", 
                  x: 220, y: -150, r: 4, scale: 1.0, blur: "0px",
                  content: (
                    <div className="space-y-2 text-left font-sans">
                      <div className="flex items-center gap-2 text-[9px] text-muted-foreground">
                        <div className="w-2.5 h-2.5 rounded border border-border/60 flex items-center justify-center text-[6px]"></div>
                        <span>Finish report pitch</span>
                      </div>
                      <div className="flex items-center gap-2 text-[9px] text-muted-foreground">
                        <div className="w-2.5 h-2.5 rounded border border-border/60 flex items-center justify-center text-[6px]"></div>
                        <span>Call builder team</span>
                      </div>
                      <div className="flex items-center gap-2 text-[9px] text-muted-foreground">
                        <div className="w-2.5 h-2.5 rounded border border-border/60 flex items-center justify-center text-[6px]"></div>
                        <span>Edit v2 roadmap video</span>
                      </div>
                    </div>
                  )
                },
                { 
                  id: "notes", 
                  title: "Apple Notes", 
                  x: -280, y: 120, r: -6, scale: 0.9, blur: "1px",
                  content: (
                    <div className="space-y-1 text-left font-mono text-[9px] text-muted-foreground/90">
                      <div>• Startup model proposal</div>
                      <div>• Youtube launch script</div>
                      <div>• Core energy routine</div>
                    </div>
                  )
                },
                { 
                  id: "gmail", 
                  title: "Gmail Inbox", 
                  x: 240, y: 130, r: 3, scale: 1.05, blur: "0px",
                  content: (
                    <div className="space-y-1 text-left">
                      <div className="text-[9px] font-semibold text-foreground truncate">Professor Pandey</div>
                      <div className="text-[8px] text-muted-foreground truncate">Final project thesis deadline...</div>
                    </div>
                  )
                },
                { 
                  id: "slack", 
                  title: "Slack Workspace", 
                  x: -120, y: -180, r: 2, scale: 0.88, blur: "1.2px",
                  content: (
                    <div className="space-y-1.5 text-left font-sans">
                      <div className="text-[9px] font-semibold text-accent">#general-announcements</div>
                      <div className="text-[8px] text-muted-foreground truncate">@achyut: &ldquo;Please review PR by tonight&rdquo;</div>
                    </div>
                  )
                },
                { 
                  id: "spotify", 
                  title: "Spotify Player", 
                  x: 100, y: 190, r: -5, scale: 0.97, blur: "0px",
                  content: (
                    <div className="space-y-2 text-left">
                      <div className="text-[9px] font-semibold text-foreground truncate">Focus Lofi Chillbeats</div>
                      <div className="h-1 bg-border/20 rounded-full w-full overflow-hidden">
                        <div className="h-full bg-accent w-2/3" />
                      </div>
                    </div>
                  )
                },
                { 
                  id: "github", 
                  title: "GitHub Pulls", 
                  x: -300, y: -10, r: 4, scale: 0.85, blur: "1.8px",
                  content: (
                    <div className="space-y-1 text-left font-sans">
                      <div className="text-[9px] font-semibold text-green-400/80 truncate">PR #12 Approved</div>
                      <div className="text-[8px] text-muted-foreground truncate">Merged branch main into prod...</div>
                    </div>
                  )
                },
                { 
                  id: "reminders", 
                  title: "Reminders", 
                  x: 300, y: -20, r: -3, scale: 0.92, blur: "0px",
                  content: (
                    <div className="space-y-1 text-left text-[9px] text-muted-foreground/90 font-mono">
                      <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-400/85" />
                        <span>Buy grocery list</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-400/85" />
                        <span>Call builder team</span>
                      </div>
                    </div>
                  )
                }
              ].map((card, idx) => {
                const isConverging = problemStep >= 2;
                const isDrifting = problemStep === 1;

                // Drift multiplier (makes them spread out)
                const driftFactor = 1.35;
                const targetX = isConverging ? 0 : isDrifting ? card.x * driftFactor : card.x;
                const targetY = isConverging ? 0 : isDrifting ? card.y * driftFactor : card.y;

                return (
                  <motion.div
                    key={card.id}
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{
                      x: targetX,
                      y: targetY,
                      rotate: isConverging ? 0 : card.r,
                      scale: isConverging ? 0.2 : card.scale,
                      opacity: isConverging ? 0 : 0.85,
                      filter: isConverging ? "blur(0px)" : `blur(${card.blur})`
                    }}
                    transition={{
                      duration: isConverging ? 1.2 : 1.5,
                      delay: isConverging ? idx * 0.1 : 0, // Faster staggered convergence!
                      ease: [0.16, 1, 0.3, 1]
                    }}
                    className="absolute p-4 rounded-2xl border border-border/30 bg-card/65 backdrop-blur-md text-foreground shadow-lg flex flex-col justify-between cursor-default overflow-hidden"
                    style={{
                      width: card.id === "gmail" ? "180px" : card.id === "calendar" ? "170px" : "150px",
                      height: "115px",
                      zIndex: isConverging ? 10 : 30 - idx,
                      boxShadow: isConverging ? "0 0 20px rgba(201, 168, 106, 0.1)" : "0 8px 30px rgba(0,0,0,0.2)"
                    }}
                  >
                    {/* Simplified Mac-like Application Header */}
                    <div className="flex items-center justify-between border-b border-border/10 pb-2 mb-2">
                      <div className="flex items-center gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-red-400/40" />
                        <div className="w-1.5 h-1.5 rounded-full bg-yellow-400/40" />
                        <div className="w-1.5 h-1.5 rounded-full bg-green-400/40" />
                      </div>
                      <span className="text-[8px] font-mono tracking-wider text-muted-foreground/60 uppercase">{card.title}</span>
                    </div>

                    {/* Card Content */}
                    <div className="flex-1 overflow-hidden mt-1">
                      {card.content}
                    </div>
                  </motion.div>
                );
              })}

              {/* The Converged Conclusion Statement */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{
                  opacity: problemStep === 4 ? 1 : 0,
                  scale: problemStep === 4 ? 1 : 0.95
                }}
                transition={{
                  duration: 1.2,
                  ease: [0.16, 1, 0.3, 1]
                }}
                className="flex flex-col items-center justify-center px-4 pointer-events-none"
              >
                <p className="font-heading text-3xl md:text-5xl font-light text-foreground tracking-wide leading-relaxed">
                  Your life isn&apos;t fragmented.<br />
                  <span className="italic text-accent font-normal">Your tools are.</span>
                </p>
              </motion.div>
            </div>

            {/* Description/Indicator text */}
            <div className="pt-8 h-8 font-sans">
              {problemStep === 0 && (
                <p className="text-xs text-muted-foreground/40 tracking-wider">
                  The scattered tabs of a daily routine...
                </p>
              )}
              {problemStep === 1 && (
                <p className="text-xs text-accent/60 tracking-wider font-mono uppercase animate-pulse">
                  Cards drifting apart. Space expanding.
                </p>
              )}
              {problemStep === 2 && (
                <p className="text-xs text-accent tracking-wider font-mono uppercase">
                  Orb guiding. Convergence active...
                </p>
              )}
            </div>
          </div>
        </section>

        {/* =====================================================================
            SECTION 3: HOW ZEN THINKS (Pipeline)
            ===================================================================== */}
        <section 
          id="pipeline" 
          className="relative min-h-screen w-full flex flex-col justify-center px-6 md:px-24 border-t border-border/10 py-24"
        >
          <div className="max-w-6xl mx-auto w-full grid grid-cols-1 md:grid-cols-12 gap-12 items-center">
            
            {/* Left Column: Heading and Context */}
            <div className="md:col-span-5 space-y-6 md:pr-10">
              <span className="font-sans text-xs tracking-[0.25em] text-accent font-bold uppercase block">
                How Zen Thinks
              </span>
              <h2 className="font-heading text-3xl md:text-5xl font-light leading-tight">
                The Intelligence Pipeline
              </h2>
              <p className="font-sans text-sm text-muted-foreground leading-relaxed font-light">
                Zen does not wait for a chat window or store static task lists. It operates as a constant, proactive pipeline that runs in the background.
              </p>
              <div className="pt-6">
                <span className="text-[10px] tracking-widest text-muted-foreground/50 uppercase font-mono">
                  Autonomous Cycle · Step {pipelineStep + 1} of 6
                </span>
              </div>
            </div>

            {/* Right Column: Flow Tracker */}
            <div ref={pipelineRef} className="md:col-span-7 relative pl-8 md:pl-16 border-l border-border/15 space-y-10 py-4">
              
              {[
                { title: "You Speak", desc: "Speak or type casually. Zen extracts intents and moods directly from your words." },
                { title: "Zen Understands", desc: "Custom semantic parsers categorize, prioritize, and structure your aspirations." },
                { title: "Zen Remembers", desc: "Events, notes, and metrics are contextualized and organized in your long-term memory vault." },
                { title: "Zen Updates Your Identity", desc: "Zen continuously maps your energy levels, focus hours, and routines to refine your profile." },
                { title: "Zen Reorganizes Tomorrow", desc: "Your roadmaps, commitments, and habits are re-weighted and rebalanced in the background." },
                { title: "Zen Prepares Your Workspace", desc: "Wake up to a dashboard specifically calibrated for today's state of mind." }
              ].map((step, idx) => {
                const isActive = pipelineStep === idx;
                const isPassed = pipelineStep > idx;

                return (
                  <div key={idx} className="relative group transition-all duration-500">
                    
                    {/* Step Bullet Node */}
                    <div className={`absolute -left-[41px] md:-left-[73px] top-1.5 w-[18px] h-[18px] md:w-[22px] md:h-[22px] rounded-full border transition-all duration-700 flex items-center justify-center z-10 ${
                      isActive 
                        ? "bg-accent border-accent shadow-[0_0_15px_rgba(201,168,106,0.5)] scale-110" 
                        : isPassed 
                          ? "bg-secondary border-accent/40" 
                          : "bg-background border-border/60"
                    }`}>
                      {isPassed && <Check size={10} className="text-accent" />}
                    </div>

                    {/* Step Copy */}
                    <div className={`transition-all duration-700 space-y-1.5 ${
                      isActive 
                        ? "opacity-100 translate-x-2" 
                        : isPassed 
                          ? "opacity-60" 
                          : "opacity-25"
                    }`}>
                      <span className="font-heading text-lg md:text-xl font-medium tracking-wide">
                        {step.title}
                      </span>
                      <p className="font-sans text-xs md:text-sm text-muted-foreground leading-relaxed font-light max-w-md font-light">
                        {step.desc}
                      </p>
                    </div>
                  </div>
                );
              })}

            </div>
          </div>
        </section>

        {/* =====================================================================
            SECTION 4: BEHIND ZEN (Specialists Network)
            ===================================================================== */}
        <section 
          id="behind-zen" 
          className="relative min-h-screen w-full flex flex-col justify-center items-center px-6 border-t border-border/10 py-24"
        >
          <div className="max-w-6xl w-full mx-auto flex flex-col items-center gap-16 relative">
            
            <div className="text-center max-w-2xl mx-auto space-y-4">
              <span className="font-sans text-xs tracking-[0.25em] text-accent font-bold uppercase block">
                Architecture
              </span>
              <h2 className="font-heading text-3xl md:text-5xl font-light">
                Six Cooperating Specialists
              </h2>
              <p className="font-sans text-sm text-muted-foreground leading-relaxed font-light">
                Behind your dashboard sits an ecosystem of specialized engines working silently together to refine, adapt, and plan your life.
              </p>
            </div>

            {/* Specialist Radial Network (Desktop) */}
            <div className="relative w-[650px] h-[650px] hidden md:flex items-center justify-center mt-8">
              
              {/* Radial SVGs Lines Connector */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
                <line x1="325" y1="325" x2="325" y2="60" className={`transition-all duration-700 stroke-2 ${hoveredSpecialist === "memory" ? "stroke-accent/80 opacity-100" : "stroke-border/20 opacity-30"}`} />
                <line x1="325" y1="325" x2="75" y2="200" className={`transition-all duration-700 stroke-2 ${hoveredSpecialist === "planning" ? "stroke-accent/80 opacity-100" : "stroke-border/20 opacity-30"}`} />
                <line x1="325" y1="325" x2="575" y2="200" className={`transition-all duration-700 stroke-2 ${hoveredSpecialist === "reflection" ? "stroke-accent/80 opacity-100" : "stroke-border/20 opacity-30"}`} />
                <line x1="325" y1="325" x2="75" y2="450" className={`transition-all duration-700 stroke-2 ${hoveredSpecialist === "identity" ? "stroke-accent/80 opacity-100" : "stroke-border/20 opacity-30"}`} />
                <line x1="325" y1="325" x2="575" y2="450" className={`transition-all duration-700 stroke-2 ${hoveredSpecialist === "scheduling" ? "stroke-accent/80 opacity-100" : "stroke-border/20 opacity-30"}`} />
                <line x1="325" y1="325" x2="325" y2="590" className={`transition-all duration-700 stroke-2 ${hoveredSpecialist === "companion" ? "stroke-accent/80 opacity-100" : "stroke-border/20 opacity-30"}`} />
              </svg>

              {/* Radial Center Position Holder */}
              <div className="absolute w-[200px] h-[200px] rounded-full border border-border/10 flex items-center justify-center z-10 pointer-events-none">
                <span className="font-heading text-lg italic tracking-widest text-accent/80">ZEN</span>
              </div>

              {/* Specialists Cards arranged around center */}
              
              {/* 1. Memory Engine (Top Center) */}
              <div 
                onMouseEnter={() => setHoveredSpecialist("memory")}
                onMouseLeave={() => setHoveredSpecialist(null)}
                className="absolute z-20 group text-center"
                style={{ top: "10px", left: "50%", transform: "translateX(-50%)" }}
              >
                <div className={`p-5 rounded-2xl border transition-all duration-500 bg-background w-[200px] cursor-default shadow-sm ${
                  hoveredSpecialist === "memory" ? "border-accent shadow-md translate-y-[-2px]" : "border-border/60"
                }`}>
                  <Brain className={`mx-auto mb-2 transition-colors duration-500 ${hoveredSpecialist === "memory" ? "text-accent" : "text-muted-foreground"}`} size={20} />
                  <span className="font-heading text-lg font-light block mb-1">Memory Engine</span>
                  <p className="font-sans text-[10px] text-muted-foreground leading-relaxed font-light">The archivist. Maintains long-term context, recalls aspirations, and indexes past logs.</p>
                </div>
              </div>

              {/* 2. Planning Engine (Mid Left) */}
              <div 
                onMouseEnter={() => setHoveredSpecialist("planning")}
                onMouseLeave={() => setHoveredSpecialist(null)}
                className="absolute z-20 group"
                style={{ top: "140px", left: "-20px" }}
              >
                <div className={`p-5 rounded-2xl border transition-all duration-500 bg-background w-[190px] cursor-default shadow-sm ${
                  hoveredSpecialist === "planning" ? "border-accent shadow-md translate-x-[-2px]" : "border-border/60"
                }`}>
                  <Sparkles className={`mb-2 transition-colors duration-500 ${hoveredSpecialist === "planning" ? "text-accent" : "text-muted-foreground"}`} size={20} />
                  <span className="font-heading text-lg font-light block mb-1">Planning Engine</span>
                  <p className="font-sans text-[10px] text-muted-foreground leading-relaxed font-light">The architect. Formulates weekly roadmaps, breaking down abstract desires into milestones.</p>
                </div>
              </div>

              {/* 3. Reflection Engine (Mid Right) */}
              <div 
                onMouseEnter={() => setHoveredSpecialist("reflection")}
                onMouseLeave={() => setHoveredSpecialist(null)}
                className="absolute z-20 group"
                style={{ top: "140px", right: "-20px" }}
              >
                <div className={`p-5 rounded-2xl border transition-all duration-500 bg-background w-[190px] cursor-default shadow-sm ${
                  hoveredSpecialist === "reflection" ? "border-accent shadow-md translate-x-[2px]" : "border-border/60"
                }`}>
                  <Eye className={`mb-2 transition-colors duration-500 ${hoveredSpecialist === "reflection" ? "text-accent" : "text-muted-foreground"}`} size={20} />
                  <span className="font-heading text-lg font-light block mb-1">Reflection Engine</span>
                  <p className="font-sans text-[10px] text-muted-foreground leading-relaxed font-light">The mirror. Audits completed tasks, log files, energy spikes, and extracts deep learning insights.</p>
                </div>
              </div>

              {/* 4. Identity Engine (Bottom Left) */}
              <div 
                onMouseEnter={() => setHoveredSpecialist("identity")}
                onMouseLeave={() => setHoveredSpecialist(null)}
                className="absolute z-20 group"
                style={{ bottom: "140px", left: "-20px" }}
              >
                <div className={`p-5 rounded-2xl border transition-all duration-500 bg-background w-[190px] cursor-default shadow-sm ${
                  hoveredSpecialist === "identity" ? "border-accent shadow-md translate-y-[2px]" : "border-border/60"
                }`}>
                  <Shield className={`mb-2 transition-colors duration-500 ${hoveredSpecialist === "identity" ? "text-accent" : "text-muted-foreground"}`} size={20} />
                  <span className="font-heading text-lg font-light block mb-1">Identity Engine</span>
                  <p className="font-sans text-[10px] text-muted-foreground leading-relaxed font-light">The guardian. Evolves a comprehensive understanding of who you are and are becoming.</p>
                </div>
              </div>

              {/* 5. Scheduling Engine (Bottom Right) */}
              <div 
                onMouseEnter={() => setHoveredSpecialist("scheduling")}
                onMouseLeave={() => setHoveredSpecialist(null)}
                className="absolute z-20 group"
                style={{ bottom: "140px", right: "-20px" }}
              >
                <div className={`p-5 rounded-2xl border transition-all duration-500 bg-background w-[190px] cursor-default shadow-sm ${
                  hoveredSpecialist === "scheduling" ? "border-accent shadow-md translate-y-[2px]" : "border-border/60"
                }`}>
                  <Calendar className={`mb-2 transition-colors duration-500 ${hoveredSpecialist === "scheduling" ? "text-accent" : "text-muted-foreground"}`} size={20} />
                  <span className="font-heading text-lg font-light block mb-1">Scheduling Engine</span>
                  <p className="font-sans text-[10px] text-muted-foreground leading-relaxed font-light">The organizer. Converts strategy into concrete blocks, managing availability in real time.</p>
                </div>
              </div>

              {/* 6. Companion (Bottom Center) */}
              <div 
                onMouseEnter={() => setHoveredSpecialist("companion")}
                onMouseLeave={() => setHoveredSpecialist(null)}
                className="absolute z-20 group text-center"
                style={{ bottom: "10px", left: "50%", transform: "translateX(-50%)" }}
              >
                <div className={`p-5 rounded-2xl border transition-all duration-500 bg-background w-[200px] cursor-default shadow-sm ${
                  hoveredSpecialist === "companion" ? "border-accent shadow-md translate-y-[2px]" : "border-border/60"
                }`}>
                  <Compass className={`mx-auto mb-2 transition-colors duration-500 ${hoveredSpecialist === "companion" ? "text-accent" : "text-muted-foreground"}`} size={20} />
                  <span className="font-heading text-lg font-light block mb-1">Companion</span>
                  <p className="font-sans text-[10px] text-muted-foreground leading-relaxed font-light">The interface. Conducts check-ins, guides daily reflections, and registers overall mood.</p>
                </div>
              </div>

            </div>

            {/* Mobile Specialist Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full max-w-md md:hidden">
              {[
                { id: "memory", icon: <Brain size={18} />, title: "Memory Engine", desc: "The archivist. Maintains long-term context, recalls aspirations, and dynamically structures information." },
                { id: "planning", icon: <Sparkles size={18} />, title: "Planning Engine", desc: "The architect. Formulates weekly roadmaps, breaking down abstract desires into active roadmaps." },
                { id: "reflection", icon: <Eye size={18} />, title: "Reflection Engine", desc: "The mirror. Audits completed tasks, energy spikes, and extracts insights from daily logs." },
                { id: "identity", icon: <Shield size={18} />, title: "Identity Engine", desc: "The guardian. Evolves a holistic understanding of who you are and verifies evidence of growth." },
                { id: "scheduling", icon: <Calendar size={18} />, title: "Scheduling Engine", desc: "The organizer. Converts strategy into high-priority tasks and rebalances slots automatically." },
                { id: "companion", icon: <Compass size={18} />, title: "Companion", desc: "The voice. Guides conversations, logs mood, and makes productivity feel supportive and personal." }
              ].map((spec) => (
                <div key={spec.id} className="p-6 rounded-2xl border border-border/60 bg-secondary/15 space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="text-accent">{spec.icon}</span>
                    <span className="font-heading text-lg font-light">{spec.title}</span>
                  </div>
                  <p className="font-sans text-xs text-muted-foreground leading-relaxed font-light">{spec.desc}</p>
                </div>
              ))}
            </div>

          </div>
        </section>

        {/* =====================================================================
            SECTION 5: A DAY WITH ZEN (Timeline Evolving)
            ===================================================================== */}
        <section 
          id="day-with-zen" 
          className="relative min-h-screen w-full flex flex-col justify-center px-6 md:px-24 border-t border-border/10 py-24"
        >
          <div className="max-w-6xl mx-auto w-full grid grid-cols-1 md:grid-cols-12 gap-12 items-center">
            
            {/* Left Column: Interactive Timeline Controller */}
            <div className="md:col-span-5 space-y-8">
              <div className="space-y-4">
                <span className="font-sans text-xs tracking-[0.25em] text-accent font-bold uppercase block">
                  A Day With Zen
                </span>
                <h2 className="font-heading text-3xl md:text-5xl font-light leading-tight">
                  Life, Not Software
                </h2>
                <p className="font-sans text-sm text-muted-foreground leading-relaxed font-light">
                  Follow a day in the life. See how Zen schedules focus, tracks energy, and rebalances roadmaps when interruptions hit.
                </p>
              </div>

              {/* Persona Selector Toggles */}
              <div className="space-y-2">
                <span className="text-[10px] tracking-widest text-muted-foreground/60 uppercase font-mono block mb-3">Select Persona</span>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.keys(personaSchedules) as Array<keyof typeof personaSchedules>).map((key) => {
                    const active = activePersona === key;
                    return (
                      <button
                        key={key}
                        onClick={() => handlePersonaChange(key)}
                        className={`py-3 px-4 rounded-xl border text-xs tracking-wider uppercase font-semibold text-center transition-all duration-300 cursor-pointer ${
                          active 
                            ? "bg-primary text-primary-foreground border-primary shadow-sm" 
                            : "border-border/60 hover:border-accent/40 bg-transparent text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {personaSchedules[key].label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Timeline Stage selector */}
              <div className="flex flex-wrap md:flex-col gap-2 pt-2">
                {[
                  { key: "morning", time: "08:00 AM", label: "Morning Brief" },
                  { key: "planning", time: "10:00 AM", label: "Planning Sync" },
                  { key: "work", time: "02:00 PM", label: "Work Blocks" },
                  { key: "adjustment", time: "04:00 PM", label: "Real-time Adjustment", accent: true },
                  { key: "reflection", time: "08:00 PM", label: "Reflection log" },
                  { key: "tomorrow", time: "10:00 PM", label: "Tomorrow Evolves" }
                ].map((item) => {
                  const active = activeTimelineStep === item.key;
                  return (
                    <button
                      key={item.key}
                      onClick={() => setActiveTimelineStep(item.key as typeof activeTimelineStep)}
                      className={`text-left py-2 px-4 rounded-xl transition-all duration-300 flex items-center justify-between cursor-pointer w-full max-w-[280px] md:max-w-none ${
                        active
                          ? "bg-secondary border border-accent/20 text-foreground"
                          : "text-muted-foreground hover:text-foreground hover:bg-secondary/25"
                      }`}
                    >
                      <div className="flex items-center gap-3 font-sans">
                        <span className="font-mono text-[10px] text-muted-foreground/60">{item.time}</span>
                        <span className={`text-xs font-semibold ${item.accent ? "text-accent" : ""}`}>{item.label}</span>
                      </div>
                      <ArrowRight size={12} className={`transition-transform duration-300 ${active ? "translate-x-0.5 text-accent opacity-100" : "opacity-0"}`} />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Right Column: Display Timeline Card & Adapt Animation */}
            <div className="md:col-span-7 bg-card border border-border/85 p-8 md:p-12 rounded-3xl min-h-[380px] flex flex-col justify-between relative overflow-hidden shadow-sm">
              <div className="absolute -inset-10 rounded-full bg-accent/5 blur-3xl opacity-20 pointer-events-none" />
              
              <AnimatePresence mode="wait">
                {rebalancing ? (
                  <motion.div
                    key="rebalancing"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex-1 flex flex-col items-center justify-center space-y-4"
                  >
                    <div className="w-8 h-8 rounded-full border-2 border-accent border-t-transparent animate-spin" />
                    <span className="font-mono text-[10px] tracking-widest text-accent uppercase">Zen is rebalancing schedules...</span>
                  </motion.div>
                ) : (
                  <motion.div
                    key={`${activePersona}-${activeTimelineStep}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                    className="space-y-6 z-10 flex-1 flex flex-col justify-between"
                  >
                    <div className="space-y-6">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs uppercase tracking-widest text-accent font-bold">
                          {activeTimelineStep === "morning" && "08:00 AM // Context setting"}
                          {activeTimelineStep === "planning" && "10:00 AM // High-energy alignment"}
                          {activeTimelineStep === "work" && "02:00 PM // protected time"}
                          {activeTimelineStep === "adjustment" && "04:00 PM // adaptive correction"}
                          {activeTimelineStep === "reflection" && "08:00 PM // daily audit"}
                          {activeTimelineStep === "tomorrow" && "10:00 PM // cognitive evolution"}
                        </span>
                        <span className="text-[10px] uppercase font-mono px-3 py-1 rounded-full bg-secondary/80 border border-border/50 font-semibold">
                          {personaSchedules[activePersona].label}
                        </span>
                      </div>
                      
                      <h3 className="font-heading text-3xl md:text-4xl font-light">
                        {activeTimelineStep === "morning" && "Morning Briefing"}
                        {activeTimelineStep === "planning" && "Calibrating Focus Areas"}
                        {activeTimelineStep === "work" && "Deep Work Block"}
                        {activeTimelineStep === "adjustment" && "Real-time Rebalancing"}
                        {activeTimelineStep === "reflection" && "Evening Mirror Reflection"}
                        {activeTimelineStep === "tomorrow" && "Preparing Tomorrow"}
                      </h3>
                      
                      <p className="font-sans text-sm md:text-base text-muted-foreground leading-relaxed font-light">
                        {activeTimelineStep === "morning" && personaSchedules[activePersona].morning}
                        {activeTimelineStep === "planning" && personaSchedules[activePersona].planning}
                        {activeTimelineStep === "work" && personaSchedules[activePersona].work}
                        {activeTimelineStep === "adjustment" && personaSchedules[activePersona].adjustment}
                        {activeTimelineStep === "reflection" && personaSchedules[activePersona].reflection}
                        {activeTimelineStep === "tomorrow" && personaSchedules[activePersona].tomorrow}
                      </p>
                    </div>

                    <div className="border-t border-border/40 pt-6 mt-6 flex justify-between items-center text-xs font-sans">
                      <span className="font-mono text-muted-foreground/60">
                        {activeTimelineStep === "adjustment" ? "🔥 Adaptability Demonstrator" : "✓ Active schedule state"}
                      </span>
                      <Link 
                        href="/signup" 
                        className="font-sans text-xs font-semibold text-accent hover:underline flex items-center gap-1.5"
                      >
                        Experience Zenkai <ArrowRight size={12} />
                      </Link>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

          </div>
        </section>

        {/* =====================================================================
            SECTION 6: COMPARISON (Perspective)
            ===================================================================== */}
        <section 
          id="comparison" 
          className="relative min-h-screen w-full flex flex-col justify-center px-6 md:px-24 border-t border-border/10 py-24"
        >
          <div className="max-w-4xl mx-auto w-full space-y-16">
            <div className="text-center space-y-4">
              <span className="font-sans text-xs tracking-[0.25em] text-accent font-bold uppercase block">
                Philosophy
              </span>
              <h2 className="font-heading text-3xl md:text-5xl font-light">
                A Shift in Perspective
              </h2>
            </div>

            <div className="w-full overflow-hidden mt-8">
              {/* Minimalist Comparison Grid */}
              <div className="grid grid-cols-2 gap-x-12 gap-y-10 border-t border-border/25 pt-10 font-sans">
                
                {/* Headers */}
                <div className="font-heading text-lg font-light text-muted-foreground uppercase tracking-widest pb-2 border-b border-border/10">
                  Traditional Tools
                </div>
                <div className="font-heading text-lg font-light text-accent uppercase tracking-widest pb-2 border-b border-border/10 font-semibold">
                  Zen
                </div>

                {/* Point 1 */}
                <div className="text-sm md:text-base text-muted-foreground font-light leading-relaxed">
                  • manage tasks
                </div>
                <div className="text-sm md:text-base text-foreground font-light leading-relaxed">
                  • manages growth
                </div>

                {/* Point 2 */}
                <div className="text-sm md:text-base text-muted-foreground font-light leading-relaxed">
                  • static lists
                </div>
                <div className="text-sm md:text-base text-foreground font-light leading-relaxed">
                  • evolving plans
                </div>

                {/* Point 3 */}
                <div className="text-sm md:text-base text-muted-foreground font-light leading-relaxed">
                  • forgets yesterday
                </div>
                <div className="text-sm md:text-base text-foreground font-light leading-relaxed">
                  • learns continuously
                </div>

                {/* Point 4 */}
                <div className="text-sm md:text-base text-muted-foreground font-light leading-relaxed">
                  • schedules work
                </div>
                <div className="text-sm md:text-base text-foreground font-light leading-relaxed">
                  • understands your life
                </div>

              </div>
            </div>
            
            <div className="h-8" />
          </div>
        </section>

        {/* =====================================================================
            SECTION 7: WHY ZEN EXISTS (Typographic Pause)
            ===================================================================== */}
        <section 
          id="why-exists" 
          className="relative min-h-screen w-full flex flex-col justify-center px-6 md:px-24 border-t border-border/10 py-24"
        >
          <div className="max-w-3xl mx-auto space-y-12">
            <span className="font-sans text-xs tracking-[0.25em] text-accent font-bold uppercase block text-center md:text-left">
              Why Zen Exists
            </span>
            
            <div className="space-y-8 font-heading text-2xl md:text-5xl font-light text-foreground leading-[1.3] text-center md:text-left">
              <p>
                Most productivity software helps you finish today&apos;s work.
              </p>
              <p className="text-muted-foreground/60">
                Very little software helps you become tomorrow&apos;s person.
              </p>
              <p className="italic text-accent font-normal">
                Zen wasn&apos;t built to create better task lists.
              </p>
              <p className="text-foreground">
                It was built to understand who you&apos;re becoming, adapt with you, and quietly evolve your life one day at a time.
              </p>
            </div>
          </div>
        </section>

        {/* =====================================================================
            SECTION 8: PRICING (Approachability)
            ===================================================================== */}
        <section 
          id="pricing" 
          className="relative min-h-screen w-full flex flex-col justify-center px-6 md:px-16 border-t border-border/10 py-24"
        >
          <div className="max-w-6xl mx-auto w-full space-y-16">
            <div className="text-center max-w-2xl mx-auto space-y-4">
              <span className="font-sans text-xs tracking-[0.25em] text-accent font-bold uppercase block">
                Membership
              </span>
              <h2 className="font-heading text-3xl md:text-5xl font-light">
                Pricing Aligned With Value
              </h2>
              <p className="font-sans text-sm text-muted-foreground leading-relaxed font-light">
                No artificial urgency, fake discount timers, or hidden locks. Simple monthly subscriptions crafted to fuel your personal evolution.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch">
              
              {/* Explorer */}
              <div className="flex flex-col justify-between p-8 rounded-2xl border border-border/40 bg-secondary/10 hover:bg-secondary/20 transition-all duration-300 shadow-sm">
                <div className="space-y-6">
                  <div>
                    <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/85 font-bold block mb-1">Explorer</span>
                    <h3 className="font-heading text-2xl font-light">Free Tier</h3>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="font-heading text-4xl font-light">₹0</span>
                  </div>
                  <p className="font-sans text-xs text-muted-foreground leading-relaxed font-light">
                    Perfect for trying Zen. Includes core daily routines and basic features.
                  </p>
                  <hr className="border-border/10" />
                  <ul className="space-y-3 font-sans text-xs text-muted-foreground font-light">
                    <li className="flex items-start gap-2">
                      <Check size={12} className="text-accent shrink-0 mt-0.5" />
                      <span>One roadmap goal</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check size={12} className="text-accent shrink-0 mt-0.5" />
                      <span>Companion chat basics</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check size={12} className="text-accent shrink-0 mt-0.5" />
                      <span>Daily availability planning</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check size={12} className="text-accent shrink-0 mt-0.5" />
                      <span>Identity profile basics</span>
                    </li>
                  </ul>
                </div>
                <div className="pt-8 font-sans">
                  <Link
                    href="/signup"
                    className="block w-full py-3 rounded-xl border border-border bg-background hover:bg-secondary/40 text-foreground font-sans font-semibold text-xs tracking-wider uppercase text-center transition-all"
                  >
                    Start Free
                  </Link>
                </div>
              </div>

              {/* Student */}
              <div className="flex flex-col justify-between p-8 rounded-2xl border-2 border-accent/40 bg-card relative shadow-sm hover:shadow-md transition-all duration-300">
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-accent text-primary-foreground text-[8px] font-bold tracking-widest uppercase">
                  POPULAR
                </span>
                <div className="space-y-6">
                  <div>
                    <span className="font-mono text-[9px] uppercase tracking-widest text-accent font-bold block mb-1">Student</span>
                    <h3 className="font-heading text-2xl font-light">Discipline Ascent</h3>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="font-heading text-4xl font-light">₹99</span>
                    <span className="font-sans text-xs text-muted-foreground">/ month</span>
                  </div>
                  <p className="font-sans text-xs text-muted-foreground leading-relaxed font-light">
                    The everyday plan. Unlocks advanced scheduling, memory patterns, and calendar sync.
                  </p>
                  <hr className="border-border/10" />
                  <ul className="space-y-3 font-sans text-xs text-foreground font-light">
                    <li className="flex items-start gap-2">
                      <Check size={12} className="text-accent shrink-0 mt-0.5" />
                      <span>Unlimited plans and roadmaps</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check size={12} className="text-accent shrink-0 mt-0.5" />
                      <span>Google Calendar Sync</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check size={12} className="text-accent shrink-0 mt-0.5" />
                      <span>Smarter Adaptive Planning</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check size={12} className="text-accent shrink-0 mt-0.5" />
                      <span>Reflection & identity evolution</span>
                    </li>
                  </ul>
                </div>
                <div className="pt-8 font-sans">
                  <Link
                    href="/signup"
                    className="block w-full py-3 rounded-xl bg-accent hover:bg-accent/90 text-primary-foreground font-sans font-semibold text-xs tracking-wider uppercase text-center transition-all animate-pulse"
                  >
                    Go Student
                  </Link>
                </div>
              </div>

              {/* Builder */}
              <div className="flex flex-col justify-between p-8 rounded-2xl border border-border/40 bg-secondary/10 hover:bg-secondary/20 transition-all duration-300 shadow-sm">
                <div className="space-y-6">
                  <div>
                    <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/80 font-bold block mb-1">Builder</span>
                    <h3 className="font-heading text-2xl font-light">Professional</h3>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="font-heading text-4xl font-light">₹299</span>
                    <span className="font-sans text-xs text-muted-foreground">/ month</span>
                  </div>
                  <p className="font-sans text-xs text-muted-foreground leading-relaxed font-light">
                    For creators, freelancers, founders, and professionals requiring priority scheduling.
                  </p>
                  <hr className="border-border/10" />
                  <ul className="space-y-3 font-sans text-xs text-muted-foreground font-light">
                    <li className="flex items-start gap-2">
                      <Check size={12} className="text-accent shrink-0 mt-0.5" />
                      <span>Everything in Student</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check size={12} className="text-accent shrink-0 mt-0.5" />
                      <span>Higher reasoning limits</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check size={12} className="text-accent shrink-0 mt-0.5" />
                      <span>Priority roadmap updates</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check size={12} className="text-accent shrink-0 mt-0.5" />
                      <span>Advanced integrations & memory</span>
                    </li>
                  </ul>
                </div>
                <div className="pt-8 font-sans">
                  <Link
                    href="/signup"
                    className="block w-full py-3 rounded-xl border border-border bg-background hover:bg-secondary/40 text-foreground font-sans font-semibold text-xs tracking-wider uppercase text-center transition-all"
                  >
                    Go Builder
                  </Link>
                </div>
              </div>

              {/* Infinite */}
              <div className="flex flex-col justify-between p-8 rounded-2xl border border-border/40 bg-secondary/10 hover:bg-secondary/20 transition-all duration-300 shadow-sm">
                <div className="space-y-6">
                  <div>
                    <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/80 font-bold block mb-1">Infinite</span>
                    <h3 className="font-heading text-2xl font-light">Apex Access</h3>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="font-heading text-4xl font-light">₹799</span>
                    <span className="font-sans text-xs text-muted-foreground">/ month</span>
                  </div>
                  <p className="font-sans text-xs text-muted-foreground leading-relaxed font-light">
                    For power users seeking custom cognitive reasoning profiles and early agent releases.
                  </p>
                  <hr className="border-border/10" />
                  <ul className="space-y-3 font-sans text-xs text-muted-foreground font-light">
                    <li className="flex items-start gap-2">
                      <Check size={12} className="text-accent shrink-0 mt-0.5" />
                      <span>Highest priority updates</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check size={12} className="text-accent shrink-0 mt-0.5" />
                      <span>Future premium agents access</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check size={12} className="text-accent shrink-0 mt-0.5" />
                      <span>Custom reasoning profiles</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check size={12} className="text-accent shrink-0 mt-0.5" />
                      <span>Highest AI resource limit</span>
                    </li>
                  </ul>
                </div>
                <div className="pt-8 font-sans">
                  <Link
                    href="/signup"
                    className="block w-full py-3 rounded-xl border border-border bg-background hover:bg-secondary/40 text-foreground font-sans font-semibold text-xs tracking-wider uppercase text-center transition-all"
                  >
                    Go Infinite
                  </Link>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* =====================================================================
            SECTION 9: FAQ (Accordions)
            ===================================================================== */}
        <section 
          id="faq" 
          className="relative min-h-screen w-full flex flex-col justify-center px-6 md:px-24 border-t border-border/10 py-24"
        >
          <div className="max-w-4xl mx-auto w-full space-y-12 font-sans">
            <div className="text-center space-y-4">
              <span className="font-sans text-xs tracking-[0.25em] text-accent font-bold uppercase block">
                Clarifications
              </span>
              <h2 className="font-heading text-3xl md:text-5xl font-light">
                Frequently Asked Questions
              </h2>
            </div>

            {/* Accordions */}
            <div className="border-t border-border/20 mt-8 divide-y divide-border/10">
              {[
                { 
                  q: "How is Zen different from regular productivity apps?", 
                  a: "Traditional apps require you to manually input, organize, and manage your tasks. Zen acts as a personal operating system that understands your ambitions, plans your growth, and adapts your schedule in the background, minimizing cognitive load." 
                },
                { 
                  q: "Does Zen store my personal data securely?", 
                  a: "Your data is fully encrypted and stored securely. Zen operates on a privacy-first model, using local memory indexing to ensure your personal life logs, diaries, and identity updates remain private." 
                },
                { 
                  q: "What is the 'Identity Engine'?", 
                  a: "It's a specialized AI specialist that maintains an evolving model of your routines, energy patterns, and long-term aspirations. It ensures Zen doesn't just schedule tasks, but helps you grow into the person you want to become." 
                },
                { 
                  q: "Can I sync Zen with my existing calendar?", 
                  a: "Yes. Zen seamlessly synchronizes with Google Calendar (available on Student, Builder, and Infinite plans) to prevent scheduling conflicts and automatically rebalance your day when meetings change." 
                }
              ].map((faq, idx) => {
                const isOpen = expandedFaq === idx;
                return (
                  <div key={idx} className="py-6">
                    <button
                      onClick={() => setExpandedFaq(isOpen ? null : idx)}
                      className="w-full flex items-center justify-between text-left cursor-pointer group"
                    >
                      <span className="font-heading text-lg md:text-xl font-light text-foreground group-hover:text-accent transition-colors">
                        {faq.q}
                      </span>
                      <ChevronDown 
                        size={16} 
                        className={`text-muted-foreground/60 transition-transform duration-300 ${isOpen ? "rotate-180 text-accent" : ""}`} 
                      />
                    </button>
                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                          className="overflow-hidden"
                        >
                          <p className="pt-4 text-xs md:text-sm text-muted-foreground leading-relaxed font-light pr-8">
                            {faq.a}
                          </p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* =====================================================================
            SECTION 10: FINAL CTA (Become)
            ===================================================================== */}
        <section 
          id="cta" 
          className="relative min-h-screen w-full flex flex-col justify-center items-center px-6 text-center bg-[#0d0d0d] text-white overflow-hidden border-t border-border/10"
        >
          {/* Subtle Silhouette Background */}
          <div className="absolute inset-0 opacity-10 pointer-events-none select-none z-0">
            <Image
              src="/assets/temples/temple_5_mastery.webp"
              alt="Temple of Mastery"
              fill
              className="object-cover object-bottom"
            />
          </div>

          <div className="max-w-2xl space-y-10 z-10">
            <div className="space-y-4">
              <span className="font-sans text-xs tracking-[0.3em] text-accent font-bold uppercase block">
                Evolve Space
              </span>
              <h2 className="font-heading text-4xl md:text-7xl font-light leading-tight tracking-tight">
                Build a life your future self will thank you for.
              </h2>
            </div>
            
            <p className="font-sans text-sm text-muted-foreground max-w-md mx-auto leading-relaxed font-light">
              Quiet the noise, align your daily priorities, and let your companion carry the load. Step into your state of peace today.
            </p>

            <div className="pt-6 font-sans">
              <Link
                href="/signup"
                className="inline-block py-4 px-12 rounded-full font-sans text-xs tracking-wider uppercase font-bold bg-accent text-primary-foreground hover:bg-white hover:text-black transition-all duration-300 shadow-lg hover:shadow-xl cursor-pointer animate-pulse"
              >
                Begin Journey
              </Link>
            </div>
          </div>
        </section>

        {/* =====================================================================
            GLOBAL FOOTER
            ===================================================================== */}
        <footer className="w-full bg-[#080808] text-muted-foreground border-t border-border/5 py-12 px-6 md:px-16 flex flex-col md:flex-row justify-between items-center gap-8 text-xs font-sans">
          
          <div className="flex flex-col items-center md:items-start gap-2">
            <div className="flex items-center gap-2">
              <span className="font-heading text-sm font-light tracking-widest text-white">ZENKAI</span>
            </div>
            <p className="text-[10px] text-muted-foreground/60 text-center md:text-left font-light">
              Built with curiosity, late nights, and way too much coffee.
            </p>
          </div>

          <div className="flex flex-col items-center gap-2 text-center md:text-left">
            <p className="text-[11px] text-muted-foreground/80 font-light">
              Zen is proudly built in the open by a solo builder.
            </p>
            <div className="flex items-center gap-5 mt-2">
              <a 
                href="https://github.com/achyutpandey1212-source" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="hover:opacity-80 hover:text-accent transition-all duration-300"
                title="GitHub"
              >
                <Image src="/assets/icons/github.svg" alt="GitHub" width={16} height={16} className="invert" />
              </a>
              <a 
                href="https://www.linkedin.com/in/achyut-pandey-122a87323/" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="hover:opacity-80 hover:text-accent transition-all duration-300"
                title="LinkedIn"
              >
                <Image src="/assets/icons/linkedin.svg" alt="LinkedIn" width={16} height={16} className="invert dark:invert-0" />
              </a>
              <a 
                href="achyutpandey1212@gmail.com" 
                className="hover:opacity-80 hover:text-accent transition-all duration-300"
                title="Email"
              >
                <Image src="/assets/icons/gmail.svg" alt="Email" width={16} height={16} />
              </a>
            </div>
          </div>

          <div className="text-center md:text-right font-light">
            Made in India <span className="text-[10px]" role="img" aria-label="India flag">🇮🇳</span>
          </div>

        </footer>

      </main>

    </div>
  );
}
