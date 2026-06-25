"use client";

import React, { useState } from "react";
import { Check, Clock, Calendar } from "lucide-react";

interface Task {
  id: number;
  title: string;
  timeSlot: string;
  duration: string;
  category: string;
  completed: boolean;
  notes: string;
}

export default function Tasks() {
  const [tasks, setTasks] = useState<Task[]>([
    {
      id: 1,
      title: "Refine Context Retrieval Prompt",
      timeSlot: "10:00 AM — 12:00 PM",
      duration: "2h",
      category: "Focus Block",
      completed: false,
      notes: "Optimize prompt size to stay below 1000 tokens for student plan."
    },
    {
      id: 2,
      title: "Review Database Schema with Achyut",
      timeSlot: "2:00 PM — 3:30 PM",
      duration: "1.5h",
      category: "Collaboration",
      completed: true,
      notes: "Confirm mongoDB collections align with the six agent schema."
    },
    {
      id: 3,
      title: "Redis Cache Layer Design",
      timeSlot: "4:00 PM — 5:00 PM",
      duration: "1h",
      category: "Infrastructure",
      completed: false,
      notes: "Define cache policy for agent output and graph state."
    }
  ]);

  const toggleTask = (id: number) => {
    setTasks(prev =>
      prev.map(task =>
        task.id === id ? { ...task, completed: !task.completed } : task
      )
    );
  };

  const completedCount = tasks.filter(t => t.completed).length;

  return (
    <div className="min-h-screen w-full p-8 md:p-16 flex flex-col items-center bg-background">
      
      {/* Centered layout */}
      <div className="max-w-2xl w-full flex flex-col gap-12 mt-8">
        
        {/* Header section */}
        <header className="flex flex-col gap-3">
          <span className="font-sans text-xs tracking-[0.25em] text-accent font-semibold uppercase">
            Curated Execution
          </span>
          <h1 className="font-heading text-4xl md:text-5xl font-light text-foreground">
            Today's Priorities
          </h1>
          <p className="font-sans text-sm text-muted-foreground leading-relaxed">
            Zenkai has organized 3 items for today. Focus on the first block to build early momentum.
          </p>
        </header>

        {/* Task curation cards */}
        <main className="space-y-6">
          {tasks.map((task) => (
            <div
              key={task.id}
              onClick={() => toggleTask(task.id)}
              className={`group flex items-start gap-6 p-6 rounded-2xl border transition-all duration-300 cursor-pointer ${
                task.completed
                  ? "bg-secondary/40 border-border/40 opacity-70"
                  : "bg-card border-border hover:border-accent/40 shadow-sm hover:shadow-md"
              }`}
            >
              {/* Gold checkbox button */}
              <button
                type="button"
                className={`h-6 w-6 rounded-full flex items-center justify-center shrink-0 border transition-all duration-300 mt-1 ${
                  task.completed
                    ? "bg-accent border-accent text-foreground"
                    : "border-muted-foreground/30 group-hover:border-accent group-hover:bg-accent/5 text-transparent"
                }`}
              >
                <Check size={14} className={task.completed ? "text-primary-foreground stroke-[3px]" : "group-hover:text-accent/60 stroke-[3px]"} />
              </button>

              {/* Task Details */}
              <div className="flex-1 flex flex-col gap-2">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                  <span
                    className={`font-sans font-medium text-base tracking-wide transition-all duration-300 ${
                      task.completed ? "line-through text-muted-foreground" : "text-foreground"
                    }`}
                  >
                    {task.title}
                  </span>
                  
                  <span className="font-sans text-[10px] font-semibold tracking-wider text-accent/80 uppercase px-2.5 py-0.5 rounded-full bg-accent/10 self-start md:self-auto">
                    {task.category}
                  </span>
                </div>

                <div className="flex items-center gap-4 text-xs text-muted-foreground font-sans">
                  <span className="flex items-center gap-1.5">
                    <Clock size={12} className="text-accent" />
                    {task.timeSlot}
                  </span>
                  <span>({task.duration})</span>
                </div>

                {task.notes && (
                  <p className="font-sans text-xs text-muted-foreground/80 mt-1 leading-relaxed">
                    {task.notes}
                  </p>
                )}
              </div>
            </div>
          ))}
        </main>

        {/* Next Day Preview section */}
        <footer className="mt-6 border-t border-border/60 pt-8 flex flex-col gap-4">
          <span className="font-sans text-[10px] tracking-[0.2em] text-accent/80 font-bold uppercase">
            Tomorrow Preview
          </span>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-secondary/30 border border-border/40 flex items-center justify-between">
              <span className="font-sans text-xs font-medium text-foreground tracking-wide">
                LangGraph Router Logic
              </span>
              <span className="text-[10px] text-muted-foreground font-sans uppercase">Priority 1</span>
            </div>
            <div className="p-4 rounded-xl bg-secondary/30 border border-border/40 flex items-center justify-between">
              <span className="font-sans text-xs font-medium text-foreground tracking-wide">
                Morning Brief Email Setup
              </span>
              <span className="text-[10px] text-muted-foreground font-sans uppercase">Priority 2</span>
            </div>
          </div>
        </footer>

      </div>

    </div>
  );
}
