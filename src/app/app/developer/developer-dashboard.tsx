"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState, useTransition } from "react";
import { 
  CheckCircle2, XCircle, AlertTriangle, Terminal, 
  Coins, Zap, RefreshCw, Search, Copy, 
  ChevronDown, ChevronUp, FileText, Activity, Info, 
  Clock, ShieldAlert, Sparkles, Cpu
} from "lucide-react";
import { getWorkflows, getWorkflowDetails, getRpmTelemetry } from "./actions";

// Interfaces
interface AICall {
  model: string;
  prompt: string;
  systemInstruction?: string;
  responseMimeType?: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cost: number;
  duration: number;
  success: boolean;
  error?: string;
  timestamp: string;
  retrievedMemories?: string;
  identityContext?: string;
  reflectionContext?: string;
}

interface NodeLogEntry {
  nodeName: string;
  workflowId: string;
  success: boolean;
  duration: number;
  skipped: boolean;
  reason: string | null;
  startedAt?: string;
}

interface NodeError {
  nodeName: string;
  error: string;
  stack?: string;
  timestamp: string;
}

interface InternalEvent {
  name: string;
  payload: any;
  emittedAt: string;
}

interface GraphState {
  workflowId: string;
  workflowVersion: string;
  graphVersion: string;
  uid: string;
  conversationId: string;
  userMessage: string;
  startedAt: number;
  nodeLog: NodeLogEntry[];
  errors: NodeError[];
  emittedEvents: InternalEvent[];
  aiCalls?: AICall[];
  memoryContext?: {
    memories?: any[];
  } | null;
  routingDecision?: {
    reasoning?: string;
    foreground: string[];
    background: string[];
  } | null;
  checkpointIds?: string[];
  pluginData?: Record<string, any>;
}

interface WorkflowItem {
  workflowId: string;
  workflowVersion: string;
  graphVersion: string;
  afterNode: string;
  checkpointedAt: string;
  snapshot: GraphState;
}

export default function DeveloperDashboard() {
  const [workflows, setWorkflows] = useState<WorkflowItem[]>([]);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(null);
  const [workflowHistory, setWorkflowHistory] = useState<any[]>([]); // Detailed checkpoints
  const [rpmStats, setRpmStats] = useState({ currentRpm: 0, peakRpm: 0 });
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [activeTab, setActiveTab] = useState<"timeline" | "ai" | "insights" | "raw">("timeline");
  const [expandedPromptIdx, setExpandedPromptIdx] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();

  // Load dashboard data
  const loadData = () => {
    startTransition(async () => {
      const data = await getWorkflows();
      setWorkflows(data);
      const rpm = await getRpmTelemetry();
      setRpmStats(rpm);
    });
  };

  useEffect(() => {
    loadData();
    // Auto-refresh stats every 8 seconds
    const interval = setInterval(async () => {
      const rpm = await getRpmTelemetry();
      setRpmStats(rpm);
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  // Handle workflow selection
  useEffect(() => {
    if (selectedWorkflowId) {
      getWorkflowDetails(selectedWorkflowId).then((history) => {
        setWorkflowHistory(history);
      });
    } else {
      setWorkflowHistory([]);
    }
  }, [selectedWorkflowId]);

  const selectedWorkflow = workflows.find(
    (w) => w.workflowId === selectedWorkflowId
  );

  // Copy helper
  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  // Aggregated "Today" metrics
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const todayWorkflows = workflows.filter((w) => {
    const time = w.snapshot.startedAt ? new Date(w.snapshot.startedAt) : new Date(w.checkpointedAt);
    return time >= todayStart;
  });

  const todayMetrics = todayWorkflows.reduce(
    (acc, w) => {
      const calls = w.snapshot.aiCalls ?? [];
      acc.requests += calls.length;
      calls.forEach((c) => {
        acc.promptTokens += c.promptTokens;
        acc.completionTokens += c.completionTokens;
        acc.totalTokens += c.totalTokens;
        acc.cost += c.cost;
      });
      return acc;
    },
    { requests: 0, promptTokens: 0, completionTokens: 0, totalTokens: 0, cost: 0 }
  );

  // Selected workflow metrics
  const selectedWfCalls = selectedWorkflow?.snapshot.aiCalls ?? [];
  const selectedWfMetrics = selectedWfCalls.reduce(
    (acc, c) => {
      acc.promptTokens += c.promptTokens;
      acc.completionTokens += c.completionTokens;
      acc.totalTokens += c.totalTokens;
      acc.cost += c.cost;
      return acc;
    },
    { promptTokens: 0, completionTokens: 0, totalTokens: 0, cost: 0 }
  );

  // RPM Warnings & Warnings array
  const warnings: string[] = [];
  if (rpmStats.currentRpm >= 12) {
    warnings.push("Near RPM Limit: Current rate is approaching API limits.");
  }
  
  // Large prompt check
  const hasLargePromptToday = todayWorkflows.some((w) => 
    (w.snapshot.aiCalls ?? []).some((c) => c.prompt.length + (c.systemInstruction?.length ?? 0) > 15000)
  );
  if (hasLargePromptToday) {
    warnings.push("Large Prompt Detected: One or more prompts today exceeded 15,000 characters.");
  }

  // High cost check
  if (todayMetrics.cost > 0.10) {
    warnings.push("High API Cost: Daily token expenditures exceed $0.10.");
  }

  // Filter workflows list
  const filteredWorkflows = workflows.filter((w) => {
    const idMatch = 
      w.workflowId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      w.snapshot.conversationId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      w.snapshot.uid.toLowerCase().includes(searchTerm.toLowerCase());
    
    const isFailed = w.snapshot.errors && w.snapshot.errors.length > 0;
    const isCompleted = w.afterNode === "assembler";
    const status = isFailed ? "failed" : isCompleted ? "completed" : "running";

    if (statusFilter === "all") return idMatch;
    return idMatch && status === statusFilter;
  });

  // Calculate order of nodes dynamically for the timeline
  const getOrderedNodes = (item: WorkflowItem) => {
    const standardOrder = ["router", "context", "companion", "planning", "execution", "background", "assembler"];
    const loggedNames = item.snapshot.nodeLog.map(n => n.nodeName);
    const extraNames = loggedNames.filter(n => !standardOrder.includes(n));
    
    // Insert extra names (e.g. plugins like calendar) right before assembler
    const combined = [...standardOrder];
    const assemblerIdx = combined.indexOf("assembler");
    if (assemblerIdx !== -1) {
      combined.splice(assemblerIdx, 0, ...extraNames);
    } else {
      combined.push(...extraNames);
    }
    return combined;
  };

  // Optimization insights heuristics
  const getInsights = (item: WorkflowItem) => {
    const insights = [];
    const calls = item.snapshot.aiCalls ?? [];
    const logs = item.snapshot.nodeLog ?? [];
    
    // Heuristic: Slowest Node
    const activeLogs = logs.filter(l => !l.skipped);
    if (activeLogs.length > 0) {
      const slowest = activeLogs.reduce((prev, curr) => prev.duration > curr.duration ? prev : curr);
      if (slowest.duration > 3000) {
        insights.push({
          type: "warning",
          title: `Slow Node: ${slowest.nodeName}`,
          description: `Node took ${(slowest.duration / 1000).toFixed(2)}s to complete. Consider optimizing database queries or lowering model tokens.`
        });
      }
    }

    // Heuristic: Largest Prompt
    if (calls.length > 0) {
      const largestCall = calls.reduce((prev, curr) => 
        (prev.prompt.length + (prev.systemInstruction?.length ?? 0)) > (curr.prompt.length + (curr.systemInstruction?.length ?? 0)) ? prev : curr
      );
      const totalLen = largestCall.prompt.length + (largestCall.systemInstruction?.length ?? 0);
      if (totalLen > 20000) {
        insights.push({
          type: "warning",
          title: `Large Prompt Size (${(totalLen / 1000).toFixed(1)}k chars)`,
          description: `The prompt for model '${largestCall.model}' is very large. Consider compressing user memories or pruning trait contexts.`
        });
      }
    }

    // Heuristic: Most Expensive Node
    if (calls.length > 0) {
      const mostExpensive = calls.reduce((prev, curr) => prev.cost > curr.cost ? prev : curr);
      if (mostExpensive.cost > 0.005) {
        insights.push({
          type: "info",
          title: `High Cost Call ($${mostExpensive.cost.toFixed(5)})`,
          description: `Model '${mostExpensive.model}' generated an expensive request. Evaluate if a lighter model or smaller prompt could be used.`
        });
      }
    }

    // Heuristic: High Memory Retrieval
    const memoryCount = item.snapshot.memoryContext?.memories?.length ?? 0;
    if (memoryCount > 5) {
      insights.push({
        type: "warning",
        title: `High Memory Retrieval Count (${memoryCount} memories)`,
        description: `Retrieved ${memoryCount} facts in context. Weaving too many memories into the prompt causes token bloat. Limit memory retrieval size.`
      });
    }

    // Heuristic: Duplicate AI Calls
    const promptSet = new Set<string>();
    let duplicateCount = 0;
    calls.forEach((c) => {
      const normalizedPrompt = c.prompt.trim();
      if (promptSet.has(normalizedPrompt)) {
        duplicateCount++;
      } else {
        promptSet.add(normalizedPrompt);
      }
    });
    if (duplicateCount > 0) {
      insights.push({
        type: "error",
        title: `Duplicate AI Calls Detected (${duplicateCount})`,
        description: `${duplicateCount} requests had identical prompt contents. Consider caching responses or combining agent calls.`
      });
    }

    // Extensible empty state fallback
    if (insights.length === 0) {
      insights.push({
        type: "success",
        title: "Clean Execution Flow",
        description: "No performance warning flags raised. Tokens, costs, duplicate queries, and execution times are healthy."
      });
    }

    return insights;
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col p-6 font-sans">
      {/* Upper Navigation Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 pb-4 border-b border-border gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Cpu className="text-accent w-6 h-6 animate-pulse" />
            <h1 className="text-2xl font-semibold tracking-tight font-heading">Zenkai Developer Dashboard</h1>
            <span className="text-xs uppercase px-2 py-0.5 rounded-full bg-accent/15 text-accent font-semibold">V1 Observability</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Real-time workflow trace logs, token budgets, execution graphs, and runtime checkpoints.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={loadData}
            disabled={isPending}
            className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-secondary hover:bg-muted text-secondary-foreground text-xs transition duration-200"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isPending ? "animate-spin" : ""}`} />
            Refresh Logs
          </button>
        </div>
      </header>

      {/* Top Warning Banner if exists */}
      {warnings.length > 0 && (
        <div className="mb-6 p-3 bg-destructive/10 border border-destructive/20 text-destructive text-xs rounded-lg flex flex-col gap-1">
          {warnings.map((w, idx) => (
            <div key={idx} className="flex items-center gap-2 font-semibold">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>{w}</span>
            </div>
          ))}
        </div>
      )}

      {/* Usage Summary Card at the Top */}
      <section className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-8 gap-4 mb-6">
        <div className="bg-card border border-border p-4 rounded-xl shadow-sm lg:col-span-2">
          <div className="text-xs text-muted-foreground flex items-center justify-between">
            <span>AI Requests Today</span>
            <Activity className="w-3.5 h-3.5 text-accent" />
          </div>
          <p className="text-2xl font-semibold mt-2">{todayMetrics.requests}</p>
          <div className="text-[10px] text-muted-foreground mt-1">
            Active: {rpmStats.currentRpm} RPM
          </div>
        </div>

        <div className="bg-card border border-border p-4 rounded-xl shadow-sm lg:col-span-2">
          <div className="text-xs text-muted-foreground flex items-center justify-between">
            <span>Prompt Tokens</span>
            <Terminal className="w-3.5 h-3.5 text-muted-foreground" />
          </div>
          <p className="text-2xl font-semibold mt-2">{todayMetrics.promptTokens.toLocaleString()}</p>
          <div className="text-[10px] text-muted-foreground mt-1">
            Current Session Total
          </div>
        </div>

        <div className="bg-card border border-border p-4 rounded-xl shadow-sm lg:col-span-2">
          <div className="text-xs text-muted-foreground flex items-center justify-between">
            <span>Completion Tokens</span>
            <Sparkles className="w-3.5 h-3.5 text-accent" />
          </div>
          <p className="text-2xl font-semibold mt-2">{todayMetrics.completionTokens.toLocaleString()}</p>
          <div className="text-[10px] text-muted-foreground mt-1">
            Completion Generation
          </div>
        </div>

        <div className="bg-card border border-border p-4 rounded-xl shadow-sm lg:col-span-1">
          <div className="text-xs text-muted-foreground flex items-center justify-between">
            <span>Total Cost</span>
            <Coins className="w-3.5 h-3.5 text-accent" />
          </div>
          <p className="text-2xl font-semibold mt-2">${todayMetrics.cost.toFixed(4)}</p>
          <div className="text-[10px] text-muted-foreground mt-1">
            Gemini 2.5 Flash Rates
          </div>
        </div>

        <div className="bg-card border border-border p-4 rounded-xl shadow-sm lg:col-span-1">
          <div className="text-xs text-muted-foreground flex items-center justify-between">
            <span>Peak Rate</span>
            <Zap className="w-3.5 h-3.5 text-accent" />
          </div>
          <p className="text-2xl font-semibold mt-2">{rpmStats.peakRpm} <span className="text-xs text-muted-foreground">RPM</span></p>
          <div className="text-[10px] text-muted-foreground mt-1">
            Peak load logged
          </div>
        </div>
      </section>

      {/* Main Content Area: Left list, Right detail */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-grow items-stretch">
        
        {/* Left Side: Recent Workflows list */}
        <aside className="lg:col-span-4 bg-card border border-border rounded-xl flex flex-col p-4 shadow-sm min-h-[500px]">
          <div className="mb-4">
            <h2 className="text-sm font-semibold mb-2">Execution Log History</h2>
            <div className="flex gap-2">
              <div className="relative flex-grow">
                <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-2.5" />
                <input 
                  type="text"
                  placeholder="Search workflow / conv ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 rounded-md border border-border bg-secondary text-xs focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>
              <select 
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-2 py-1.5 rounded-md border border-border bg-secondary text-xs focus:outline-none focus:ring-1 focus:ring-accent"
              >
                <option value="all">All</option>
                <option value="completed">Success</option>
                <option value="failed">Failed</option>
                <option value="running">Running</option>
              </select>
            </div>
          </div>

          <div className="flex-grow overflow-y-auto space-y-2 max-h-[600px] scrollbar-custom">
            {filteredWorkflows.length === 0 ? (
              <div className="text-center text-xs text-muted-foreground py-8">
                No recent workflows found matching filters.
              </div>
            ) : (
              filteredWorkflows.map((wf) => {
                const isSelected = wf.workflowId === selectedWorkflowId;
                const totalDuration = wf.snapshot.nodeLog?.reduce((sum, n) => sum + (n.skipped ? 0 : n.duration), 0) ?? 0;
                
                const isFailed = wf.snapshot.errors && wf.snapshot.errors.length > 0;
                const isCompleted = wf.afterNode === "assembler";
                
                let badgeClass = "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300";
                let badgeText = "Running";
                if (isFailed) {
                  badgeClass = "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300";
                  badgeText = "Failed";
                } else if (isCompleted) {
                  badgeClass = "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
                  badgeText = "Success";
                }

                const startedTime = wf.snapshot.startedAt 
                  ? new Date(wf.snapshot.startedAt).toLocaleTimeString() 
                  : new Date(wf.checkpointedAt).toLocaleTimeString();

                return (
                  <div 
                    key={wf.workflowId}
                    onClick={() => setSelectedWorkflowId(wf.workflowId)}
                    className={`p-3 rounded-lg border text-xs cursor-pointer transition duration-200 ${
                      isSelected 
                        ? "border-accent bg-accent/5" 
                        : "border-border hover:bg-secondary/40"
                    }`}
                  >
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-mono font-medium text-accent">
                        {wf.workflowId.slice(0, 10)}...
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${badgeClass}`}>
                        {badgeText}
                      </span>
                    </div>

                    <div className="text-[11px] text-muted-foreground space-y-1 mt-2">
                      <div className="flex justify-between">
                        <span>Started:</span>
                        <span>{startedTime}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Duration:</span>
                        <span>{totalDuration > 1000 ? `${(totalDuration / 1000).toFixed(2)}s` : `${totalDuration}ms`}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Conv ID:</span>
                        <span className="font-mono">{wf.snapshot.conversationId.slice(0, 8)}...</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </aside>

        {/* Right Side: Detailed logs & diagnostics */}
        <main className="lg:col-span-8 bg-card border border-border rounded-xl flex flex-col p-6 shadow-sm min-h-[500px]">
          {!selectedWorkflow ? (
            <div className="flex-grow flex flex-col justify-center items-center text-center text-xs text-muted-foreground p-8">
              <Info className="w-10 h-10 text-muted-foreground mb-3 animate-pulse" />
              <p className="text-sm font-semibold mb-1">No Workflow Selected</p>
              <p>Choose an active or completed workflow trace from the sidebar to inspect detailed diagnostics.</p>
            </div>
          ) : (
            <div className="flex flex-col h-full">
              {/* Detailed Header */}
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center pb-4 border-b border-border gap-4 mb-6">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base font-semibold font-mono text-accent">
                      {selectedWorkflow.workflowId}
                    </h3>
                    <button 
                      onClick={() => handleCopy(selectedWorkflow.workflowId)}
                      className="p-1 hover:bg-secondary rounded text-muted-foreground"
                      title="Copy Workflow ID"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1 flex-wrap">
                    <span>Conv: <span className="font-mono text-foreground">{selectedWorkflow.snapshot.conversationId}</span></span>
                    <span>User: <span className="font-mono text-foreground">{selectedWorkflow.snapshot.uid}</span></span>
                    <span>Started: <span className="text-foreground">{new Date(selectedWorkflow.snapshot.startedAt || selectedWorkflow.checkpointedAt).toLocaleString()}</span></span>
                  </div>
                </div>
              </div>

              {/* Workflow stats card */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-secondary/30 rounded-xl mb-6 border border-border">
                <div className="text-xs">
                  <span className="text-muted-foreground block">Workflow Cost</span>
                  <span className="text-base font-semibold text-accent">${selectedWfMetrics.cost.toFixed(5)}</span>
                </div>
                <div className="text-xs">
                  <span className="text-muted-foreground block">AI Requests</span>
                  <span className="text-base font-semibold">{selectedWfCalls.length} calls</span>
                </div>
                <div className="text-xs">
                  <span className="text-muted-foreground block">Total Tokens</span>
                  <span className="text-base font-semibold">{selectedWfMetrics.totalTokens.toLocaleString()}</span>
                </div>
                <div className="text-xs">
                  <span className="text-muted-foreground block">Errors</span>
                  <span className={`text-base font-semibold ${selectedWorkflow.snapshot.errors?.length > 0 ? "text-destructive" : "text-green-600"}`}>
                    {selectedWorkflow.snapshot.errors?.length ?? 0}
                  </span>
                </div>
              </div>

              {/* Tabs list */}
              <div className="flex border-b border-border mb-6">
                {[
                  { id: "timeline", label: "Timeline & Flow", icon: Clock },
                  { id: "ai", label: "AI Requests & Prompts", icon: Sparkles },
                  { id: "insights", label: "Optimization Insights", icon: AlertTriangle },
                  { id: "raw", label: "Raw State", icon: FileText },
                ].map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as any)}
                      className={`flex items-center gap-1.5 px-4 py-2 text-xs font-medium border-b-2 -mb-px transition duration-200 ${
                        isActive
                          ? "border-accent text-accent"
                          : "border-transparent text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              {/* Tab Contents */}
              <div className="flex-grow overflow-y-auto max-h-[500px] pr-2 scrollbar-custom">
                {/* 1. TIMELINE TAB */}
                {activeTab === "timeline" && (
                  <div className="space-y-6">
                    {/* Node checklist visualization */}
                    <div>
                      <h4 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-4">Node Execution Path</h4>
                      <div className="relative pl-6 space-y-6 border-l border-border ml-3">
                        {getOrderedNodes(selectedWorkflow).map((nodeName, idx) => {
                          const log = selectedWorkflow.snapshot.nodeLog.find(n => n.nodeName === nodeName);
                          const isFailed = log && !log.success && !log.skipped;
                          const isSuccess = log && log.success && !log.skipped;

                          let colorClass = "text-muted-foreground bg-secondary border-border";
                          let labelText = "Bypassed";
                          let durationText = "";
                          let detailsText = log?.reason ?? "Routing path decision";

                          if (isSuccess) {
                            colorClass = "text-green-600 bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-900";
                            labelText = "Completed";
                            durationText = log.duration > 1000 ? `${(log.duration / 1000).toFixed(2)}s` : `${log.duration}ms`;
                          } else if (isFailed) {
                            colorClass = "text-destructive bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-900";
                            labelText = "Failed";
                            durationText = log.duration > 1000 ? `${(log.duration / 1000).toFixed(2)}s` : `${log.duration}ms`;
                            detailsText = log.reason ?? "Unknown error occurred";
                          } else if (log?.skipped) {
                            colorClass = "text-amber-600 bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-900";
                            labelText = "Skipped";
                            detailsText = log.reason ?? "Routing path decision";
                          }

                          return (
                            <div key={idx} className="relative">
                              {/* Connector dot */}
                              <div className={`absolute -left-[31px] top-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${colorClass}`}>
                                {isSuccess ? (
                                  <CheckCircle2 className="w-2.5 h-2.5 fill-current" />
                                ) : isFailed ? (
                                  <XCircle className="w-2.5 h-2.5 fill-current" />
                                ) : (
                                  <div className="w-1.5 h-1.5 rounded-full bg-current" />
                                )}
                              </div>

                              <div className="flex flex-col gap-0.5">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-semibold capitalize">{nodeName}</span>
                                  {durationText && (
                                    <span className="text-[10px] px-1.5 py-0.5 bg-secondary text-muted-foreground rounded">
                                      {durationText}
                                    </span>
                                  )}
                                </div>
                                <span className="text-[10px] text-muted-foreground">
                                  Status: <span className="font-semibold">{labelText}</span>
                                </span>
                                {detailsText && (
                                  <p className="text-[10px] text-muted-foreground/80 mt-1 italic">
                                    Reason: {detailsText}
                                  </p>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Emitted Events */}
                    <div className="pt-4 border-t border-border">
                      <h4 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-3">Emitted Events ({selectedWorkflow.snapshot.emittedEvents?.length ?? 0})</h4>
                      {(!selectedWorkflow.snapshot.emittedEvents || selectedWorkflow.snapshot.emittedEvents.length === 0) ? (
                        <p className="text-xs text-muted-foreground">No events were emitted during this execution run.</p>
                      ) : (
                        <div className="space-y-3">
                          {selectedWorkflow.snapshot.emittedEvents.map((evt, idx) => (
                            <div key={idx} className="p-3 bg-secondary/20 border border-border rounded-lg text-[11px]">
                              <div className="flex justify-between items-center mb-1">
                                <span className="font-semibold text-accent">{evt.name}</span>
                                <span className="text-muted-foreground text-[10px]">
                                  {evt.emittedAt ? new Date(evt.emittedAt).toLocaleTimeString() : ""}
                                </span>
                              </div>
                              <pre className="mt-1 bg-secondary/50 p-2 rounded overflow-x-auto text-[10px] text-muted-foreground font-mono scrollbar-custom">
                                {JSON.stringify(evt.payload, null, 2)}
                              </pre>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Checkpoints */}
                    <div className="pt-4 border-t border-border">
                      <h4 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-3">Saved Checkpoints ({workflowHistory.length})</h4>
                      {workflowHistory.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No checkpoints saved (running in-memory or bypassed).</p>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {workflowHistory.map((item, idx) => (
                            <div key={idx} className="p-3 border border-border rounded-lg bg-secondary/15 flex items-center justify-between text-xs">
                              <div>
                                <span className="font-semibold block capitalize">Saved after: {item.afterNode}</span>
                                <span className="text-[10px] text-muted-foreground">Time: {new Date(item.checkpointedAt).toLocaleTimeString()}</span>
                              </div>
                              <span className="text-[10px] bg-green-50 text-green-700 border border-green-200 dark:bg-green-950/20 dark:text-green-300 dark:border-green-900 px-2 py-0.5 rounded-full font-medium">
                                Succeeded
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* 2. AI REQUESTS & PROMPT INSPECTOR */}
                {activeTab === "ai" && (
                  <div className="space-y-4">
                    <h4 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2">Chronological Gemini Calls</h4>
                    {selectedWfCalls.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No AI requests logged for this workflow (or telemetry skipped).</p>
                    ) : (
                      <div className="space-y-4">
                        {selectedWfCalls.map((call, idx) => {
                          const isExpanded = expandedPromptIdx === idx;
                          const totalPromptChars = call.prompt.length + (call.systemInstruction?.length ?? 0);
                          
                          return (
                            <div key={idx} className="border border-border rounded-xl bg-card overflow-hidden">
                              <div 
                                onClick={() => setExpandedPromptIdx(isExpanded ? null : idx)}
                                className="flex justify-between items-center p-3 bg-secondary/15 hover:bg-secondary/35 cursor-pointer text-xs transition duration-200"
                              >
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <span className="font-semibold text-accent capitalize">Call #{idx + 1}: {call.model}</span>
                                    <span className={`px-1.5 py-0.2 rounded text-[10px] ${
                                      call.success 
                                        ? "bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-300" 
                                        : "bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-300"
                                    }`}>
                                      {call.success ? "Success" : "Failed"}
                                    </span>
                                  </div>
                                  <div className="text-[10px] text-muted-foreground">
                                    Tokens: {call.promptTokens} in / {call.completionTokens} out (Total: {call.totalTokens}) | Duration: {call.duration > 1000 ? `${(call.duration / 1000).toFixed(2)}s` : `${call.duration}ms`}
                                  </div>
                                </div>
                                <div className="flex items-center gap-3">
                                  <span className="font-semibold">${call.cost.toFixed(5)}</span>
                                  {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                </div>
                              </div>

                              {isExpanded && (
                                <div className="p-4 border-t border-border bg-secondary/5 text-xs space-y-4">
                                  {/* Error display */}
                                  {call.error && (
                                    <div className="p-3 bg-red-100/20 border border-red-200 text-destructive text-xs rounded-lg font-mono">
                                      <span className="font-semibold">Error Message:</span> {call.error}
                                    </div>
                                  )}

                                  {/* Prompt metrics */}
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-2.5 bg-secondary/35 rounded-lg border border-border text-[11px]">
                                    <div>
                                      <span className="text-muted-foreground block">Merged Prompt Size</span>
                                      <span className="font-semibold">{totalPromptChars.toLocaleString()} characters</span>
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground block">Response Format</span>
                                      <span className="font-semibold">{call.responseMimeType ?? "text/plain"}</span>
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground block">Time Recorded</span>
                                      <span className="font-semibold">{new Date(call.timestamp).toLocaleTimeString()}</span>
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground block">Cost Contribution</span>
                                      <span className="font-semibold">${call.cost.toFixed(5)}</span>
                                    </div>
                                  </div>

                                  {/* Prompt Inspector: System prompt */}
                                  {call.systemInstruction && (
                                    <div>
                                      <div className="flex justify-between items-center mb-1">
                                        <span className="font-semibold text-muted-foreground">System Prompt</span>
                                        <button 
                                          onClick={() => handleCopy(call.systemInstruction ?? "")}
                                          className="text-[10px] text-accent hover:underline flex items-center gap-1"
                                        >
                                          <Copy className="w-3 h-3" /> Copy
                                        </button>
                                      </div>
                                      <pre className="p-3 bg-secondary/45 border border-border rounded-lg text-[10px] font-mono text-muted-foreground max-h-40 overflow-y-auto whitespace-pre-wrap scrollbar-custom">
                                        {call.systemInstruction.trim()}
                                      </pre>
                                    </div>
                                  )}

                                  {/* Prompt Inspector: Prompt Sent */}
                                  <div>
                                    <div className="flex justify-between items-center mb-1">
                                      <span className="font-semibold text-muted-foreground">Prompt Context (Contents)</span>
                                      <button 
                                        onClick={() => handleCopy(call.prompt)}
                                        className="text-[10px] text-accent hover:underline flex items-center gap-1"
                                      >
                                        <Copy className="w-3 h-3" /> Copy
                                      </button>
                                    </div>
                                    <pre className="p-3 bg-secondary/45 border border-border rounded-lg text-[10px] font-mono text-muted-foreground max-h-48 overflow-y-auto whitespace-pre-wrap scrollbar-custom">
                                      {call.prompt.trim()}
                                    </pre>
                                  </div>

                                  {/* Dynamic context extracts */}
                                  {call.retrievedMemories && (
                                    <div>
                                      <span className="font-semibold text-muted-foreground block mb-1">Weaved Memories</span>
                                      <pre className="p-3 bg-amber-50/10 border border-amber-200/20 rounded-lg text-[10px] font-mono text-muted-foreground max-h-32 overflow-y-auto whitespace-pre-wrap scrollbar-custom">
                                        {call.retrievedMemories.trim()}
                                      </pre>
                                    </div>
                                  )}

                                  {call.identityContext && (
                                    <div>
                                      <span className="font-semibold text-muted-foreground block mb-1">Weaved Identity Context</span>
                                      <pre className="p-3 bg-blue-50/10 border border-blue-200/20 rounded-lg text-[10px] font-mono text-muted-foreground max-h-32 overflow-y-auto whitespace-pre-wrap scrollbar-custom">
                                        {call.identityContext.trim()}
                                      </pre>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* 3. OPTIMIZATION INSIGHTS TAB */}
                {activeTab === "insights" && (
                  <div className="space-y-4">
                    <h4 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2">Automated Heuristic Diagnostics</h4>
                    <div className="space-y-3">
                      {getInsights(selectedWorkflow).map((insight, idx) => {
                        let cardColor = "bg-green-50/30 border-green-200 dark:border-green-950 text-green-700 dark:text-green-300";
                        let Icon = CheckCircle2;

                        if (insight.type === "warning") {
                          cardColor = "bg-amber-50/30 border-amber-200 dark:border-amber-950 text-amber-700 dark:text-amber-300";
                          Icon = AlertTriangle;
                        } else if (insight.type === "error") {
                          cardColor = "bg-red-50/30 border-red-200 dark:border-red-950 text-red-700 dark:text-red-300";
                          Icon = ShieldAlert;
                        } else if (insight.type === "info") {
                          cardColor = "bg-blue-50/30 border-blue-200 dark:border-blue-950 text-blue-700 dark:text-blue-300";
                          Icon = Info;
                        }

                        return (
                          <div key={idx} className={`p-4 border rounded-xl flex items-start gap-3 text-xs ${cardColor}`}>
                            <Icon className="w-5 h-5 shrink-0 mt-0.5" />
                            <div>
                              <span className="font-semibold block mb-1">{insight.title}</span>
                              <p className="opacity-95">{insight.description}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 4. RAW STATE TAB */}
                {activeTab === "raw" && (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h4 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">GraphState Snapshot</h4>
                      <button 
                        onClick={() => handleCopy(JSON.stringify(selectedWorkflow.snapshot, null, 2))}
                        className="text-xs text-accent hover:underline flex items-center gap-1"
                      >
                        <Copy className="w-3.5 h-3.5" /> Copy JSON
                      </button>
                    </div>
                    <pre className="p-4 bg-secondary/35 border border-border rounded-xl text-[10px] font-mono overflow-auto max-h-96 text-muted-foreground scrollbar-custom">
                      {JSON.stringify(selectedWorkflow.snapshot, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
