"use client";

import React, { useState, useEffect } from "react";
import { Brain, Trash2, RefreshCw, Database, Clock, Info, ShieldCheck, Tag, Sparkles } from "lucide-react";

interface Memory {
  _id: string;
  category: string;
  content: string;
  summary: string;
  confidence: number;
  importance: number;
  importanceReason?: string;
  reason: string;
  status: string;
  version: number;
  retrievalCount: number;
  lastRetrievedAt?: string;
  createdAt: string;
  conversationId?: string;
  messageId?: string;
  keywords: string[];
}

export default function MemoryDebug() {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isClearingAll, setIsClearingAll] = useState(false);

  const fetchMemories = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/memory/debug");
      if (!res.ok) {
        if (res.status === 403) {
          throw new Error("Memory Inspector is only available in development mode.");
        }
        throw new Error(`Failed to fetch: ${res.statusText}`);
      }
      const data = await res.json();
      if (data.success) {
        setMemories(data.memories || []);
      } else {
        throw new Error(data.error || "Failed to load memories");
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An unexpected error occurred";
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    async function load() {
      await new Promise((resolve) => setTimeout(resolve, 0));
      if (!active) return;
      fetchMemories();
    }
    load();
    return () => {
      active = false;
    };
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this memory?")) return;
    setIsDeleting(id);
    try {
      const res = await fetch(`/api/memory/debug?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete memory");
      const data = await res.json();
      if (data.success) {
        setMemories((prev) => prev.filter((m) => m._id !== id));
      } else {
        throw new Error(data.error || "Failed to delete memory");
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Could not delete memory";
      alert(errorMessage);
    } finally {
      setIsDeleting(null);
    }
  };

  const handleClearAll = async () => {
    if (!confirm("CRITICAL: Are you sure you want to clear ALL memories? This cannot be undone.")) return;
    setIsClearingAll(true);
    try {
      const res = await fetch("/api/memory/debug?all=true", { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to clear memories");
      const data = await res.json();
      if (data.success) {
        setMemories([]);
      } else {
        throw new Error(data.error || "Failed to clear memories");
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Could not clear memories";
      alert(errorMessage);
    } finally {
      setIsClearingAll(false);
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "Goal":
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
      case "Preference":
        return "bg-amber-500/10 text-amber-400 border-amber-500/20";
      case "Habit":
        return "bg-blue-500/10 text-blue-400 border-blue-500/20";
      case "Constraint":
        return "bg-rose-500/10 text-rose-400 border-rose-500/20";
      case "Identity":
        return "bg-purple-500/10 text-purple-400 border-purple-500/20";
      case "Project":
        return "bg-indigo-500/10 text-indigo-400 border-indigo-500/20";
      case "Achievement":
        return "bg-teal-500/10 text-teal-400 border-teal-500/20";
      case "Relationship":
        return "bg-pink-500/10 text-pink-400 border-pink-500/20";
      case "Behavior":
        return "bg-sky-500/10 text-sky-400 border-sky-500/20";
      case "Motivation":
        return "bg-orange-500/10 text-orange-400 border-orange-500/20";
      case "Knowledge":
        return "bg-cyan-500/10 text-cyan-400 border-cyan-500/20";
      default:
        return "bg-muted text-muted-foreground border-border";
    }
  };

  return (
    <div className="h-full w-full overflow-y-auto p-6 md:p-12 bg-background">
      <div className="max-w-6xl mx-auto flex flex-col gap-8 mt-4">
        
        {/* Header Section */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="font-sans text-xs tracking-[0.25em] text-accent font-semibold uppercase">
                System Diagnostics
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-accent/15 text-accent font-medium uppercase border border-accent/20">
                Development Mode
              </span>
            </div>
            <h1 className="font-heading text-3xl font-light text-foreground flex items-center gap-3">
              <Brain className="text-accent h-8 w-8" />
              Memory Inspector
            </h1>
            <p className="font-sans text-xs text-muted-foreground">
              Direct introspection into Zenkai&apos;s long-term memory store. View, inspect, or manage admitted knowledge structures.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchMemories}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 text-xs font-sans font-medium rounded-lg border border-border bg-card text-foreground hover:bg-background/80 transition-colors disabled:opacity-50"
            >
              <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
              Refresh
            </button>
            <button
              onClick={handleClearAll}
              disabled={isLoading || isClearingAll || memories.length === 0}
              className="flex items-center gap-2 px-4 py-2 text-xs font-sans font-medium rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500/20 transition-colors disabled:opacity-30"
            >
              <Trash2 size={14} />
              Clear All Memories
            </button>
          </div>
        </header>

        {/* Loading and Error States */}
        {isLoading && memories.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <RefreshCw size={32} className="animate-spin text-accent" />
            <p className="font-sans text-xs text-muted-foreground">Reading database collections...</p>
          </div>
        ) : error ? (
          <div className="bg-rose-500/10 border border-rose-500/25 p-6 rounded-xl text-center">
            <h3 className="font-heading text-lg font-medium text-rose-400 mb-2">Access Restrained</h3>
            <p className="font-sans text-xs text-muted-foreground">{error}</p>
          </div>
        ) : memories.length === 0 ? (
          <div className="bg-card border border-border p-12 rounded-2xl text-center flex flex-col items-center justify-center gap-4">
            <Database size={48} className="text-muted-foreground/30" />
            <h3 className="font-heading text-xl font-light">Memory is Stateless</h3>
            <p className="font-sans text-xs text-muted-foreground max-w-sm">
              Zenkai hasn&apos;t admitted any facts to long-term memory yet. Teach Zenkai some goals, preferences, or projects in the Companion Chat.
            </p>
          </div>
        ) : (
          /* Memories Table */
          <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border bg-secondary/30 text-xs font-semibold text-muted-foreground uppercase tracking-wider font-sans">
                    <th className="p-4 pl-6">Memory Summary & Content</th>
                    <th className="p-4 w-28">Category</th>
                    <th className="p-4 w-40">Importance & Confidence</th>
                    <th className="p-4 w-44">Lifecycle & Stats</th>
                    <th className="p-4 w-24 text-right pr-6">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {memories.map((memory) => (
                    <tr key={memory._id} className="hover:bg-secondary/10 transition-colors font-sans text-xs">
                      {/* Summary & Content */}
                      <td className="p-4 pl-6 max-w-lg">
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center gap-2">
                            <span className="font-heading text-sm font-medium text-foreground">{memory.summary}</span>
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-secondary border border-border text-muted-foreground">
                              v{memory.version}
                            </span>
                          </div>
                          <span className="text-muted-foreground leading-relaxed text-xs">{memory.content}</span>
                          
                          {/* Admission Reason */}
                          {memory.reason && (
                            <div className="mt-2 flex items-start gap-1.5 p-2 rounded bg-secondary/50 text-[11px] border border-border/40 text-muted-foreground">
                              <Info size={12} className="text-accent shrink-0 mt-0.5" />
                              <p><strong>Admission Context:</strong> {memory.reason}</p>
                            </div>
                          )}

                          {/* Importance Reason */}
                          {memory.importanceReason && (
                            <div className="mt-1 flex items-start gap-1.5 p-2 rounded bg-secondary/30 text-[11px] border border-border/20 text-muted-foreground">
                              <Sparkles size={12} className="text-emerald-400 shrink-0 mt-0.5" />
                              <p><strong>Importance Context:</strong> {memory.importanceReason}</p>
                            </div>
                          )}

                          {/* Keywords */}
                          {memory.keywords && memory.keywords.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {memory.keywords.map((kw, i) => (
                                <span key={i} className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-mono bg-secondary border border-border text-muted-foreground">
                                  <Tag size={8} />
                                  {kw}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Category */}
                      <td className="p-4">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider border ${getCategoryColor(memory.category)}`}>
                          {memory.category}
                        </span>
                      </td>

                      {/* Importance & Confidence */}
                      <td className="p-4">
                        <div className="flex flex-col gap-2">
                          <div>
                            <div className="flex justify-between text-[10px] text-muted-foreground mb-1 font-mono">
                              <span>Importance</span>
                              <span>{memory.importance.toFixed(1)}/10</span>
                            </div>
                            <div className="w-full bg-secondary h-1.5 rounded-full overflow-hidden border border-border/40">
                              <div
                                className="bg-accent h-full rounded-full"
                                style={{ width: `${memory.importance * 10}%` }}
                              />
                            </div>
                          </div>

                          <div>
                            <div className="flex justify-between text-[10px] text-muted-foreground mb-1 font-mono">
                              <span>Confidence</span>
                              <span>{Math.round(memory.confidence * 100)}%</span>
                            </div>
                            <div className="w-full bg-secondary h-1.5 rounded-full overflow-hidden border border-border/40">
                              <div
                                className="bg-primary-foreground/45 bg-blue-400 h-full rounded-full"
                                style={{ width: `${memory.confidence * 100}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Lifecycle Stats */}
                      <td className="p-4 text-muted-foreground">
                        <div className="flex flex-col gap-1.5 font-mono text-[10px]">
                          <div className="flex items-center gap-1.5">
                            <ShieldCheck size={12} className="text-accent" />
                            <span>Retrieved: {memory.retrievalCount} times</span>
                          </div>
                          
                          {memory.lastRetrievedAt ? (
                            <div className="flex items-center gap-1.5">
                              <Clock size={12} />
                              <span>
                                Active: {new Date(memory.lastRetrievedAt).toLocaleDateString()}
                              </span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 text-muted-foreground/50">
                              <Clock size={12} />
                              <span>Never accessed</span>
                            </div>
                          )}

                          <span className="text-[9px] text-muted-foreground/60">
                            Created: {new Date(memory.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="p-4 text-right pr-6">
                        <button
                          onClick={() => handleDelete(memory._id)}
                          disabled={isDeleting === memory._id}
                          className="p-2 text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors disabled:opacity-50"
                          title="Delete memory"
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
