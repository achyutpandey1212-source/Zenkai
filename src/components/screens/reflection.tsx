"use client";

import React, { useState, useEffect } from "react";
import { Sparkles, TrendingUp, AlertCircle, Eye, Clock, Compass, Activity, Award, RefreshCw, History, Check } from "lucide-react";

interface ReflectionVersion {
  version: number;
  title: string;
  content: string;
  summary: string;
  confidence: number;
  stability: number;
  evidenceCount: number;
  supportingMemoryIds: string[];
  supportingIdentityTraitIds: string[];
  evolutionReason: string;
  llmReasoning: string;
  updatedAt: string;
}

interface ReflectionData {
  _id: string;
  reflectionType: "session" | "daily" | "weekly" | "monthly";
  title: string;
  content: string;
  summary: string;
  category: string;
  confidence: number;
  importance: number;
  supportingMemoryIds: string[];
  supportingIdentityTraitIds: string[];
  lastValidatedAt: string;
  status: "active" | "deprecated";
  version: number;
  evidenceCount: number;
  stability: number;
  llmReasoning: string;
  evolutionReason: string;
  confidenceHistory: {
    confidence: number;
    timestamp: string;
    reason?: string;
  }[];
  versions: ReflectionVersion[];
  createdAt: string;
  updatedAt: string;
}

interface ReflectionProps {
  userName: string;
}

export default function Reflection({ userName }: ReflectionProps) {
  const [activeReflections, setActiveReflections] = useState<ReflectionData[]>([]);
  const [allReflections, setAllReflections] = useState<ReflectionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [devMode, setDevMode] = useState(false);
  const [reEvaluating, setReEvaluating] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const res = await fetch("/api/reflections");
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setActiveReflections(data.activeReflections || []);
          setAllReflections(data.allReflections || []);
        }
      }
    } catch (error) {
      console.error("Failed to fetch reflections:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleForceReevaluate = async () => {
    setReEvaluating(true);
    try {
      const res = await fetch("/api/reflections", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setActiveReflections(data.activeReflections || []);
          setAllReflections(data.allReflections || []);
        }
      }
    } catch (error) {
      console.error("Error during force re-evaluation:", error);
    } finally {
      setReEvaluating(false);
    }
  };

  const getConfidenceLevel = (confidence: number): string => {
    if (confidence >= 0.95) return "Highly Stable";
    if (confidence >= 0.80) return "Strong Pattern";
    if (confidence >= 0.60) return "Emerging Pattern";
    return "Hypothesis";
  };

  const getConfidenceBadgeColor = (confidence: number): string => {
    if (confidence >= 0.95) return "bg-accent/25 text-accent border border-accent/40";
    if (confidence >= 0.80) return "bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20";
    if (confidence >= 0.60) return "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20";
    return "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border border-yellow-500/20";
  };

  if (loading) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-6 w-6 rounded-full border-2 border-accent border-t-transparent animate-spin" />
          <span className="font-sans text-xs tracking-wider text-muted-foreground uppercase">Gathering wisdom...</span>
        </div>
      </div>
    );
  }

  // Calculate stats
  const totalActive = activeReflections.length;
  const avgStability = totalActive > 0
    ? Math.round((activeReflections.reduce((sum, r) => sum + r.stability, 0) / totalActive) * 100)
    : 0;

  // Find most important or highest confidence active reflection for the highlight quote block
  const primaryReflection = totalActive > 0
    ? [...activeReflections].sort((a, b) => (b.importance * b.confidence) - (a.importance * a.confidence))[0]
    : null;

  return (
    <div className="h-full w-full overflow-y-auto p-6 md:p-12 lg:p-16 flex flex-col items-center bg-background scrollbar-none">
      <div className="max-w-2xl w-full flex flex-col gap-12 mt-4 pb-20">
        
        {/* Header Section */}
        <header className="flex flex-col gap-2">
          <span className="font-sans text-[10px] tracking-[0.25em] text-accent font-semibold uppercase">
            Growth Narrative
          </span>
          <h1 className="font-heading text-4xl md:text-5xl font-light text-foreground tracking-wide">
            Distilled Wisdom
          </h1>
          <p className="font-sans text-xs text-muted-foreground leading-relaxed">
            Zenkai observes your actions, goals, and traits over time to identify underlying patterns. These reflections guide your roadmap and growth trajectory.
          </p>
        </header>

        {/* Overview Panel */}
        <section className="bg-secondary/40 border border-border p-6 rounded-2xl flex flex-col gap-5 relative overflow-hidden">
          <div className="absolute right-0 bottom-0 translate-x-8 translate-y-8 opacity-5 pointer-events-none">
            <Sparkles size={140} className="text-accent" />
          </div>

          <span className="font-sans text-[9px] tracking-[0.2em] text-accent font-bold uppercase block">
            Wisdom Blueprint
          </span>

          <div className="flex flex-col gap-4 z-10">
            {primaryReflection ? (
              <div className="flex flex-col gap-2">
                <span className="font-sans text-[9px] text-muted-foreground tracking-wider uppercase">Key Pattern Highlight</span>
                <p className="font-heading text-xl italic text-foreground leading-relaxed max-w-xl">
                  {`"${primaryReflection.content}"`}
                </p>
              </div>
            ) : (
              <div>
                <span className="font-sans text-xs text-muted-foreground">Key Pattern Highlight</span>
                <h2 className="font-heading text-xl font-light text-foreground mt-1">
                  Observing your habits to formulate hypotheses...
                </h2>
              </div>
            )}
            
            <div className="grid grid-cols-2 gap-4 border-t border-border/60 pt-4">
              <div>
                <span className="font-sans text-[10px] text-muted-foreground block">Active Reflections</span>
                <span className="font-heading text-xl font-light text-foreground">{totalActive}</span>
              </div>
              <div>
                <span className="font-sans text-[10px] text-muted-foreground block">Wisdom Stability</span>
                <span className="font-heading text-xl font-light text-foreground">{avgStability}%</span>
              </div>
            </div>
          </div>
        </section>

        {/* Reflection Cards Section */}
        <section className="space-y-6">
          <span className="font-sans text-[9px] tracking-[0.25em] text-accent font-bold uppercase block">
            Evolving Patterns
          </span>

          {totalActive === 0 ? (
            <div className="text-center py-12 bg-secondary/20 rounded-xl border border-dashed border-border/80 flex flex-col items-center gap-3">
              <Compass size={24} className="text-accent/40" />
              <p className="font-sans text-xs text-muted-foreground max-w-sm">No active behavior reflections recorded yet. Zenkai requires repeated evidence over multiple days to confirm behavioral patterns, or trigger a manual sync to process existing memories.</p>
              <button
                onClick={handleForceReevaluate}
                disabled={reEvaluating}
                className="mt-2 font-sans text-xs tracking-wider uppercase font-semibold bg-accent text-background px-4 py-2 rounded-lg hover:bg-accent/90 transition-colors flex items-center gap-1.5 disabled:opacity-50"
              >
                <RefreshCw size={12} className={reEvaluating ? "animate-spin" : ""} />
                {reEvaluating ? "Synthesizing..." : "Reflect & Sync Wisdom"}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {activeReflections.map((r, idx) => {
                const confLevel = getConfidenceLevel(r.confidence);
                const isExpanded = expandedId === r._id;

                return (
                  <div 
                    key={r._id || `reflection-${idx}`}
                    className="bg-card border border-border p-6 rounded-xl flex flex-col gap-4 hover:border-accent/30 transition-all duration-300 shadow-[0_2px_8px_rgba(0,0,0,0.01)]"
                  >
                    {/* Header */}
                    <div className="flex justify-between items-start gap-4">
                      <div>
                        <span className="font-sans text-[9px] tracking-wider text-accent font-semibold uppercase">
                          {r.category}
                        </span>
                        <h3 className="font-heading text-xl font-light text-foreground mt-0.5">
                          {r.title}
                        </h3>
                      </div>
                      <span className={`font-sans text-[8px] font-bold tracking-wider uppercase px-2 py-0.5 rounded ${getConfidenceBadgeColor(r.confidence)}`}>
                        {confLevel}
                      </span>
                    </div>

                    {/* Summary & Content */}
                    <div className="space-y-2">
                      <p className="font-sans text-xs text-foreground leading-relaxed">
                        {r.content}
                      </p>
                      <p className="font-sans text-[11px] text-muted-foreground leading-relaxed italic bg-secondary/10 p-3 rounded-lg border border-border/30">
                        Summary: {r.summary}
                      </p>
                    </div>

                    {/* Progress bars (Confidence & Stability) */}
                    <div className="grid grid-cols-2 gap-6 border-t border-border/40 pt-4 mt-1">
                      <div className="flex flex-col gap-1">
                        <div className="flex justify-between text-[9px] text-muted-foreground font-sans">
                          <span>Pattern Strength</span>
                          <span className="font-semibold">{Math.round(r.confidence * 100)}%</span>
                        </div>
                        <div className="w-full bg-secondary h-0.5 rounded-full overflow-hidden">
                          <div 
                            className="bg-accent h-full transition-all duration-500" 
                            style={{ width: `${r.confidence * 100}%` }} 
                          />
                        </div>
                      </div>

                      <div className="flex flex-col gap-1">
                        <div className="flex justify-between text-[9px] text-muted-foreground font-sans">
                          <span>Pattern Stability</span>
                          <span className="font-semibold">{Math.round(r.stability * 100)}%</span>
                        </div>
                        <div className="w-full bg-secondary h-0.5 rounded-full overflow-hidden">
                          <div 
                            className="bg-accent h-full transition-all duration-500" 
                            style={{ width: `${r.stability * 100}%` }} 
                          />
                        </div>
                      </div>
                    </div>

                    {/* Metadata line */}
                    <div className="flex justify-between items-center text-[9px] text-muted-foreground font-sans mt-1">
                      <span>Evidence Count: {r.evidenceCount} admitted memories</span>
                      <span>Version {r.version}</span>
                    </div>

                    {/* Timeline & Version History Toggle */}
                    <div>
                      <button 
                        onClick={() => setExpandedId(isExpanded ? null : r._id)}
                        className="font-sans text-[9px] tracking-wider uppercase text-accent font-semibold flex items-center gap-1 hover:text-accent/80 transition-colors"
                      >
                        <History size={10} /> {isExpanded ? "Hide Pattern History" : "View Pattern History"}
                      </button>

                      {isExpanded && (
                        <div className="mt-4 border-t border-border/30 pt-4 space-y-4 animate-fade-in">
                          {/* Timeline display */}
                          <div className="relative pl-4 border-l border-accent/20 space-y-4">
                            {/* Current Version */}
                            <div className="relative">
                              <span className="absolute -left-[20.5px] top-1.5 w-2 h-2 rounded-full bg-accent border-2 border-background" />
                              <div className="flex flex-col gap-1">
                                <span className="font-sans text-[9px] text-accent font-semibold">
                                  v{r.version} (Latest) — {new Date(r.updatedAt).toLocaleDateString()}
                                </span>
                                <p className="font-sans text-xs text-foreground leading-relaxed">{r.content}</p>
                                {r.evolutionReason && (
                                  <span className="font-sans text-[9px] text-muted-foreground italic">
                                    Evolution: {r.evolutionReason}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Previous Versions */}
                            {r.versions && r.versions.length > 0 ? (
                              r.versions.map((ver, vIdx) => (
                                <div key={vIdx} className="relative">
                                  <span className="absolute -left-[20.5px] top-1.5 w-1.5 h-1.5 rounded-full bg-muted-foreground/30 border border-background" />
                                  <div className="flex flex-col gap-1 opacity-70">
                                    <span className="font-sans text-[9px] text-muted-foreground">
                                      v{ver.version} — {new Date(ver.updatedAt).toLocaleDateString()}
                                    </span>
                                    <p className="font-sans text-xs text-foreground leading-relaxed">{ver.content}</p>
                                    {ver.evolutionReason && (
                                      <span className="font-sans text-[9px] text-muted-foreground italic">
                                        Reason: {ver.evolutionReason}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              ))
                            ) : null}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Deprecated Reflections Timeline */}
        {allReflections.some(r => r.status === "deprecated") && (
          <section className="space-y-4">
            <span className="font-sans text-[9px] tracking-[0.25em] text-accent font-bold uppercase block">
              Deprecated Reflections & Behavioral Shifts
            </span>
            <div className="bg-card border border-border p-6 rounded-xl space-y-4 shadow-[0_2px_8px_rgba(0,0,0,0.01)]">
              <div className="relative pl-4 border-l border-muted-foreground/20 space-y-4">
                {allReflections.filter(r => r.status === "deprecated").map((r, idx) => (
                  <div key={r._id || `deprecated-${idx}`} className="relative">
                    <span className="absolute -left-[20.5px] top-1.5 w-2 h-2 rounded-full bg-muted border-2 border-background" />
                    <div className="flex flex-col gap-1">
                      <span className="font-sans text-[9px] text-muted-foreground flex items-center gap-1">
                        <Clock size={10} /> Archived on {new Date(r.updatedAt).toLocaleDateString()}
                      </span>
                      <h4 className="font-heading text-base font-light text-foreground">{r.title} ({r.category})</h4>
                      <p className="font-sans text-xs text-muted-foreground leading-relaxed">
                        {r.content}
                      </p>
                      <span className="font-sans text-[9px] text-accent italic">
                        Reason for deprecation: {r.evolutionReason}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Developer Diagnostics Mode Toggle */}
        <footer className="border-t border-border/40 pt-6 flex flex-col gap-4">
          <div className="flex justify-between items-center">
            <button 
              onClick={() => setDevMode(!devMode)}
              className="font-sans text-[9px] tracking-wider uppercase text-muted-foreground font-semibold hover:text-accent transition-colors flex items-center gap-1"
            >
              <Eye size={10} /> {devMode ? "Hide Diagnostics" : "Developer Diagnostics"}
            </button>
          </div>

          {devMode && (
            <div className="bg-secondary/40 border border-border p-4 rounded-xl flex flex-col gap-4 animate-fade-in">
              <div className="flex justify-between items-center border-b border-border/60 pb-3">
                <span className="font-sans text-[10px] font-bold text-accent tracking-wider uppercase">RAW DIAGNOSTICS</span>
                
                <button
                  onClick={handleForceReevaluate}
                  disabled={reEvaluating}
                  className="font-sans text-[9px] tracking-wider uppercase font-semibold bg-accent text-background px-3 py-1.5 rounded-lg hover:bg-accent/90 transition-colors flex items-center gap-1.5 disabled:opacity-50"
                >
                  <RefreshCw size={10} className={reEvaluating ? "animate-spin" : ""} />
                  {reEvaluating ? "Evaluating..." : "Force Re-evaluate Patterns"}
                </button>
              </div>

              {/* Developer specific details */}
              <div className="space-y-4 font-sans text-xs text-muted-foreground">
                {activeReflections.map((r, idx) => (
                  <div key={idx} className="border-b border-border/40 pb-4 last:border-0 last:pb-0">
                    <h5 className="font-heading text-sm font-light text-foreground mb-1">{r.title} (ID: {r._id})</h5>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-2 font-mono text-[9px]">
                      <div><strong>Confidence History:</strong> {JSON.stringify(r.confidenceHistory.map(h => `${h.confidence * 100}% on ${new Date(h.timestamp).toLocaleDateString()}`))}</div>
                      <div><strong>Supporting Memories:</strong> {JSON.stringify(r.supportingMemoryIds)}</div>
                      <div><strong>Supporting Traits:</strong> {JSON.stringify(r.supportingIdentityTraitIds)}</div>
                      <div><strong>Validation Stamp:</strong> {new Date(r.lastValidatedAt).toLocaleString()}</div>
                    </div>
                    <div className="mt-2 text-[10px] whitespace-pre-wrap bg-background/50 p-2.5 rounded border border-border/30">
                      <strong>LLM Reasoning:</strong> {r.llmReasoning}
                    </div>
                  </div>
                ))}
              </div>

              <div className="font-mono text-[9px] max-h-60 overflow-y-auto select-all">
                <pre className="text-foreground/90">
                  {JSON.stringify({ activeReflections, allReflections }, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </footer>

      </div>
    </div>
  );
}
