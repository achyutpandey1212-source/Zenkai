"use client";

import React, { useState, useEffect } from "react";
import { Compass, ShieldCheck, HelpCircle, ChevronDown, ChevronUp, History, Eye, Check, X, Clock } from "lucide-react";

interface Trait {
  _id: string;
  trait: string;
  category: "core_identity" | "aspiration" | "principle" | "behavior_pattern" | "current_state";
  description: string;
  confidence: number;
  stability: number;
  version: number;
  status: "active" | "candidate" | "deprecated";
  evidence?: string;
  createdAt: string;
  updatedAt: string;
}

interface Proposal {
  _id: string;
  trait: string;
  category: string;
  confidence: number;
  reason: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
}

export default function Identity() {
  const [profile, setProfile] = useState<{
    coreIdentity: Trait[];
    aspirations: Trait[];
    principles: Trait[];
    patterns: Trait[];
    currentState: Trait[];
    emergingTraits: Trait[];
  } | null>(null);

  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [timeline, setTimeline] = useState<Trait[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedEvidence, setExpandedEvidence] = useState<Record<string, boolean>>({});
  const [devMode, setDevMode] = useState(false);
  const [processingProposalId, setProcessingProposalId] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      // 1. Fetch Profile
      const profileRes = await fetch("/api/identity");
      if (profileRes.ok) {
        const data = await profileRes.json();
        if (data.success) {
          setProfile(data.profile);
        }
      }

      // 2. Fetch Proposals
      const proposalsRes = await fetch("/api/identity/proposals");
      if (proposalsRes.ok) {
        const data = await proposalsRes.json();
        if (data.success) {
          setProposals(data.proposals);
        }
      }

      // 3. Fetch Timeline
      const timelineRes = await fetch("/api/identity/timeline");
      if (timelineRes.ok) {
        const data = await timelineRes.json();
        if (data.success) {
          setTimeline(data.timeline);
        }
      }
    } catch (error) {
      console.error("Failed to fetch identity data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
  }, []);

  const handleRespondProposal = async (proposalId: string, action: "accept" | "dismiss" | "later") => {
    setProcessingProposalId(proposalId);
    try {
      const res = await fetch("/api/identity/proposals/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proposalId, action }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          // Re-fetch data on successful action
          await fetchData();
        }
      }
    } catch (error) {
      console.error("Error responding to proposal:", error);
    } finally {
      setProcessingProposalId(null);
    }
  };

  const toggleEvidence = (traitId: string) => {
    setExpandedEvidence((prev) => ({
      ...prev,
      [traitId]: !prev[traitId],
    }));
  };

  const getStageLabel = (trait: Trait): string => {
    if (trait.status === "deprecated") return "Archived";
    if (trait.status === "active") {
      return trait.confidence >= 0.8 && trait.stability >= 0.8 ? "Stable" : "Confirmed";
    }
    return trait.confidence >= 0.4 ? "Emerging" : "Hypothesis";
  };

  const getStageBadgeColor = (stage: string): string => {
    switch (stage) {
      case "Stable":
        return "bg-accent/25 text-accent border border-accent/40";
      case "Confirmed":
        return "bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20";
      case "Emerging":
        return "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20";
      case "Hypothesis":
        return "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border border-yellow-500/20";
      default:
        return "bg-muted text-muted-foreground border border-border";
    }
  };

  const getCategoryLabel = (cat: string): string => {
    switch (cat) {
      case "core_identity": return "Core Identity";
      case "aspiration": return "Aspiration";
      case "principle": return "Operating Principle";
      case "behavior_pattern": return "Behavioral Pattern";
      case "current_state": return "Current State";
      default: return cat;
    }
  };

  if (loading) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-6 w-6 rounded-full border-2 border-accent border-t-transparent animate-spin" />
          <span className="font-sans text-xs tracking-wider text-muted-foreground uppercase">Aligning self-awareness...</span>
        </div>
      </div>
    );
  }

  // Calculate Primary Identity (highest confidence core_identity trait)
  const allActiveCore = profile?.coreIdentity || [];
  const primaryTrait = allActiveCore.length > 0
    ? [...allActiveCore].sort((a, b) => b.confidence - a.confidence)[0]
    : null;

  // Calculate averages
  const allActive = [
    ...(profile?.coreIdentity || []),
    ...(profile?.aspirations || []),
    ...(profile?.principles || []),
    ...(profile?.patterns || []),
    ...(profile?.currentState || []),
  ];

  const avgConfidence = allActive.length > 0
    ? Math.round((allActive.reduce((sum, t) => sum + t.confidence, 0) / allActive.length) * 100)
    : 0;

  const avgStability = allActive.length > 0
    ? Math.round((allActive.reduce((sum, t) => sum + t.stability, 0) / allActive.length) * 100)
    : 0;

  return (
    <div className="h-full w-full overflow-y-auto p-6 md:p-12 lg:p-16 flex flex-col items-center bg-background scrollbar-none">
      <div className="max-w-2xl w-full flex flex-col gap-12 mt-4 pb-20">
        
        {/* Header Section */}
        <header className="flex flex-col gap-2">
          <span className="font-sans text-[10px] tracking-[0.25em] text-accent font-semibold uppercase">
            Internal Blueprint
          </span>
          <h1 className="font-heading text-4xl md:text-5xl font-light text-foreground tracking-wide">
            Identity Blueprint
          </h1>
          <p className="font-sans text-xs text-muted-foreground leading-relaxed">
            Zenkai continually synthesizes a deep, evolving model of who you are based on your admitted memories and values.
          </p>
        </header>

        {/* Identity Overview Panel */}
        <section className="bg-secondary/40 border border-border p-6 rounded-2xl flex flex-col gap-5 relative overflow-hidden">
          <div className="absolute right-0 bottom-0 translate-x-8 translate-y-8 opacity-5 pointer-events-none">
            <Compass size={140} className="text-accent" />
          </div>
          
          <span className="font-sans text-[9px] tracking-[0.2em] text-accent font-bold uppercase">
            Current Status Overview
          </span>
          
          <div className="flex flex-col gap-4 z-10">
            <div>
              <span className="font-sans text-xs text-muted-foreground">Primary Identity</span>
              <h2 className="font-heading text-2xl md:text-3xl font-light text-foreground mt-0.5">
                {primaryTrait ? primaryTrait.trait : "Determining Trait..."}
              </h2>
            </div>
            
            <div className="grid grid-cols-2 gap-4 border-t border-border/60 pt-4">
              <div>
                <span className="font-sans text-[10px] text-muted-foreground block">Blueprint Confidence</span>
                <span className="font-heading text-xl font-light text-foreground">{avgConfidence}%</span>
              </div>
              <div>
                <span className="font-sans text-[10px] text-muted-foreground block">System Stability</span>
                <span className="font-heading text-xl font-light text-foreground">{avgStability}%</span>
              </div>
            </div>
          </div>
        </section>

        {/* Identity Proposals Section */}
        {proposals.length > 0 && (
          <section className="space-y-4">
            <span className="font-sans text-[9px] tracking-[0.25em] text-accent font-bold uppercase block">
              Identity Proposals
            </span>
            <div className="space-y-3">
              {proposals.map((p, idx) => (
                <div 
                  key={p._id || `proposal-${idx}`} 
                  className="bg-card border border-accent/40 shadow-[0_2px_12px_rgba(201,168,106,0.06)] p-6 rounded-xl flex flex-col gap-4 relative overflow-hidden transition-all duration-300"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex flex-col gap-1">
                      <span className="font-sans text-[9px] tracking-wider text-accent font-semibold uppercase">
                        {getCategoryLabel(p.category)}
                      </span>
                      <h3 className="font-heading text-lg font-medium text-foreground">
                        {`Would you like me to remember that you are a "${p.trait}"?`}
                      </h3>
                    </div>
                    <span className="font-sans text-[10px] font-semibold text-accent whitespace-nowrap bg-accent/10 px-2 py-0.5 rounded-full border border-accent/20">
                      {Math.round(p.confidence * 100)}% Confidence
                    </span>
                  </div>

                  <p className="font-sans text-xs text-muted-foreground leading-relaxed italic bg-secondary/20 p-3 rounded-lg border border-border/40">
                    {`"${p.reason}"`}
                  </p>

                  <div className="flex gap-2.5 mt-1 justify-end">
                    <button 
                      onClick={() => handleRespondProposal(p._id, "accept")}
                      disabled={processingProposalId !== null}
                      className="font-sans text-[10px] tracking-wider uppercase font-semibold bg-accent text-background px-4 py-2 rounded-lg hover:bg-accent/90 transition-colors flex items-center gap-1.5"
                    >
                      <Check size={11} /> Accept
                    </button>
                    <button 
                      onClick={() => handleRespondProposal(p._id, "dismiss")}
                      disabled={processingProposalId !== null}
                      className="font-sans text-[10px] tracking-wider uppercase font-semibold bg-secondary/80 text-foreground border border-border px-4 py-2 rounded-lg hover:bg-secondary transition-colors flex items-center gap-1.5"
                    >
                      <X size={11} /> Dismiss
                    </button>
                    <button 
                      onClick={() => handleRespondProposal(p._id, "later")}
                      disabled={processingProposalId !== null}
                      className="font-sans text-[10px] tracking-wider uppercase font-semibold bg-transparent text-muted-foreground border border-border px-3 py-2 rounded-lg hover:bg-secondary/40 transition-colors"
                    >
                      Later
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Core Traits Section */}
        <section className="space-y-6">
          <span className="font-sans text-[9px] tracking-[0.25em] text-accent font-bold uppercase block">
            Core Blueprint Traits
          </span>
          
          {allActive.length === 0 ? (
            <div className="text-center py-10 bg-secondary/20 rounded-xl border border-dashed border-border/80">
              <Compass size={24} className="mx-auto text-accent/40 mb-3" />
              <p className="font-sans text-xs text-muted-foreground">No confirmed identity traits yet. Keep conversing to allow Zenkai to map your identity.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {allActive.map((t, idx) => {
                const stage = getStageLabel(t);
                return (
                  <div 
                    key={t._id || `${t.category}-${t.trait}-${idx}`} 
                    className="bg-card border border-border p-5 rounded-xl flex flex-col gap-3 hover:border-accent/30 transition-all duration-300 shadow-[0_2px_8px_rgba(0,0,0,0.02)]"
                  >
                    <div className="flex justify-between items-start gap-4">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-heading text-lg font-medium text-foreground">{t.trait}</span>
                          <span className="font-sans text-[9px] text-muted-foreground tracking-wider uppercase">
                            • {getCategoryLabel(t.category)}
                          </span>
                        </div>
                        <p className="font-sans text-xs text-muted-foreground mt-1 leading-relaxed">
                          {t.description}
                        </p>
                      </div>
                      
                      <div className="flex flex-col items-end gap-1.5 whitespace-nowrap">
                        <span className={`font-sans text-[8px] font-bold tracking-wider uppercase px-2 py-0.5 rounded ${getStageBadgeColor(stage)}`}>
                          {stage}
                        </span>
                        <span className="font-sans text-[9px] text-muted-foreground">Version {t.version}</span>
                      </div>
                    </div>

                    {/* Progress bars (subtle luxury style) */}
                    <div className="grid grid-cols-2 gap-6 border-t border-border/40 pt-3 mt-1">
                      <div className="flex flex-col gap-1">
                        <div className="flex justify-between text-[9px] text-muted-foreground font-sans">
                          <span>Confidence</span>
                          <span className="font-semibold">{Math.round(t.confidence * 100)}%</span>
                        </div>
                        <div className="w-full bg-secondary h-0.5 rounded-full overflow-hidden">
                          <div 
                            className="bg-accent h-full transition-all duration-500" 
                            style={{ width: `${t.confidence * 100}%` }} 
                          />
                        </div>
                      </div>

                      <div className="flex flex-col gap-1">
                        <div className="flex justify-between text-[9px] text-muted-foreground font-sans">
                          <span>Stability</span>
                          <span className="font-semibold">{Math.round(t.stability * 100)}%</span>
                        </div>
                        <div className="w-full bg-secondary h-0.5 rounded-full overflow-hidden">
                          <div 
                            className="bg-accent h-full transition-all duration-500" 
                            style={{ width: `${t.stability * 100}%` }} 
                          />
                        </div>
                      </div>
                    </div>

                    {/* Evidence Drawer Toggle */}
                    {t.evidence && (
                      <div className="mt-1">
                        <button 
                          onClick={() => toggleEvidence(t._id)}
                          className="font-sans text-[9px] tracking-wider uppercase text-accent font-semibold flex items-center gap-1 hover:text-accent/80 transition-colors"
                        >
                          {expandedEvidence[t._id] ? (
                            <>Hide Evidence <ChevronUp size={10} /></>
                          ) : (
                            <>View Evidence <ChevronDown size={10} /></>
                          )}
                        </button>
                        
                        {expandedEvidence[t._id] && (
                          <div className="mt-2.5 bg-secondary/30 border border-border/40 p-3 rounded-lg text-[11px] font-sans text-muted-foreground leading-relaxed whitespace-pre-line animate-fade-in">
                            {t.evidence}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Emerging Traits Section */}
        {profile && profile.emergingTraits.length > 0 && (
          <section className="space-y-4">
            <span className="font-sans text-[9px] tracking-[0.25em] text-accent font-bold uppercase block">
              Emerging Traits & Hypotheses
            </span>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {profile.emergingTraits.map((t, idx) => (
                <div 
                  key={t._id || `emerging-${t.trait}-${idx}`} 
                  className="bg-card border border-border/60 p-4 rounded-xl flex flex-col gap-2 hover:border-accent/20 transition-all duration-300"
                >
                  <div className="flex justify-between items-center">
                    <span className="font-heading text-base font-medium text-foreground">{t.trait}</span>
                    <span className="font-sans text-[8px] font-semibold text-accent bg-accent/5 border border-accent/15 px-1.5 py-0.5 rounded">
                      {Math.round(t.confidence * 100)}% Confidence
                    </span>
                  </div>
                  <span className="font-sans text-[8px] text-muted-foreground tracking-wider uppercase">
                    {getCategoryLabel(t.category)}
                  </span>
                  <p className="font-sans text-[11px] text-muted-foreground leading-relaxed">
                    {t.description}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Identity Timeline */}
        {timeline.length > 0 && (
          <section className="space-y-4">
            <span className="font-sans text-[9px] tracking-[0.25em] text-accent font-bold uppercase block">
              Identity Trajectory
            </span>
            <div className="bg-card border border-border p-6 rounded-xl space-y-5 shadow-[0_2px_8px_rgba(0,0,0,0.01)]">
              <div className="relative pl-4 border-l border-accent/30 space-y-5">
                {timeline.slice(0, 5).map((t, idx) => {
                  const dateStr = new Date(t.updatedAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric"
                  });
                  return (
                    <div key={(t._id || t.trait) + "-" + idx} className="relative">
                      {/* Timeline dot */}
                      <span className="absolute -left-[20.5px] top-1.5 w-2 h-2 rounded-full bg-accent border-2 border-background" />
                      
                      <div className="flex flex-col gap-1">
                        <span className="font-sans text-[9px] text-muted-foreground font-semibold flex items-center gap-1.5">
                          <Clock size={10} /> {dateStr}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="font-heading text-sm font-medium text-foreground">
                            {t.trait}
                          </span>
                          <span className="font-sans text-[8px] tracking-wider uppercase text-muted-foreground">
                            ({getCategoryLabel(t.category)})
                          </span>
                        </div>
                        <p className="font-sans text-[11px] text-muted-foreground leading-relaxed">
                          {t.status === "active" 
                            ? `Stabilized as Confirmed Trait (Version ${t.version}, Confidence ${Math.round(t.confidence * 100)}%).` 
                            : t.status === "candidate"
                            ? `Proposed as candidate trait for confirmation.`
                            : `Archived and deprecated due to evolving patterns.`}
                        </p>
                      </div>
                    </div>
                  );
                })}
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
            <div className="bg-secondary/40 border border-border p-4 rounded-lg flex flex-col gap-3 font-mono text-[10px] text-muted-foreground overflow-x-auto select-all">
              <span className="font-sans text-[9px] font-bold text-accent tracking-wider uppercase">RAW DIAGNOSTICS</span>
              <pre className="text-foreground/90 max-h-60 overflow-y-auto">
                {JSON.stringify({ profile, proposals, timeline }, null, 2)}
              </pre>
            </div>
          )}
        </footer>

      </div>
    </div>
  );
}
