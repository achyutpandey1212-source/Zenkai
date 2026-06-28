"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState, useTransition } from "react";
import { 
  CheckCircle2, XCircle, AlertTriangle, Terminal, 
  Coins, Zap, RefreshCw, Search, Copy, 
  ChevronDown, ChevronUp, FileText, Activity, Info, 
  Clock, ShieldAlert, Sparkles, Cpu, Mail, Send, AlertCircle, Calendar, Loader2,
  Flame, Trophy, TrendingUp, BarChart3, PieChart, Award, BookOpen
} from "lucide-react";
import { 
  getWorkflows, 
  getWorkflowDetails, 
  getRpmTelemetry,
  getBriefingLogs,
  getDashboardUsers,
  triggerBriefing,
  getCalendarSyncLogs,
  getCalendarStats,
  triggerManualCalendarSync,
  getBehaviorProfile,
  recalculateBehaviorProfile,
  simulateBriefingOpen
} from "./actions";

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

  // Briefing and Calendar states
  const [dashboardView, setDashboardView] = useState<"workflows" | "briefings" | "calendar" | "behavior">("workflows");
  const [briefingLogs, setBriefingLogs] = useState<any[]>([]);
  const [dashboardUsers, setDashboardUsers] = useState<any[]>([]);
  const [selectedUserForBrief, setSelectedUserForBrief] = useState<string>("");
  const [briefType, setBriefType] = useState<"morning" | "evening">("morning");
  const [isTriggeringBrief, setIsTriggeringBrief] = useState(false);
  const [triggerResult, setTriggerResult] = useState<{ success?: boolean; message?: string; error?: string } | null>(null);

  // Calendar states
  const [calendarLogs, setCalendarLogs] = useState<any[]>([]);
  const [calendarStats, setCalendarStats] = useState<any>({
    connectedUsers: 0,
    eventsCreated: 0,
    eventsUpdated: 0,
    eventsDeleted: 0,
    eventsSkipped: 0,
    googleRequests: 0,
    avgDuration: 0,
    failures: 0,
    lastSync: null
  });
  const [selectedUserForCalendar, setSelectedUserForCalendar] = useState<string>("");
  const [isTriggeringCalendar, setIsTriggeringCalendar] = useState(false);
  const [calendarTriggerResult, setCalendarTriggerResult] = useState<any | null>(null);

  // Behavior states
  const [selectedUserForBehavior, setSelectedUserForBehavior] = useState<string>("");
  const [behaviorProfile, setBehaviorProfile] = useState<any>(null);
  const [isLoadingBehavior, setIsLoadingBehavior] = useState(false);
  const [isRecalculatingBehavior, setIsRecalculatingBehavior] = useState(false);
  const [behaviorError, setBehaviorError] = useState<string>("");

  // Load dashboard data
  const loadData = () => {
    startTransition(async () => {
      const data = await getWorkflows();
      setWorkflows(data);
      const rpm = await getRpmTelemetry();
      setRpmStats(rpm);
      
      const logs = await getBriefingLogs();
      setBriefingLogs(logs);
      const users = await getDashboardUsers();
      setDashboardUsers(users);
      if (users.length > 0) {
        if (!selectedUserForBrief) setSelectedUserForBrief(users[0].firebaseUid);
        if (!selectedUserForCalendar) setSelectedUserForCalendar(users[0].firebaseUid);
        if (!selectedUserForBehavior) setSelectedUserForBehavior(users[0].firebaseUid);
      }

      // Fetch calendar telemetry
      const calLogs = await getCalendarSyncLogs();
      setCalendarLogs(calLogs);
      const calStats = await getCalendarStats();
      setCalendarStats(calStats);
    });
  };

  const loadBehaviorProfile = async (uid: string) => {
    setIsLoadingBehavior(true);
    setBehaviorError("");
    try {
      const profile = await getBehaviorProfile(uid);
      setBehaviorProfile(profile);
    } catch (err: any) {
      console.error("Failed to load behavior profile:", err);
      setBehaviorError(err.message || "Failed to load behavior profile");
    } finally {
      setIsLoadingBehavior(false);
    }
  };

  const handleRecalculateBehavior = async () => {
    if (!selectedUserForBehavior) return;
    setIsRecalculatingBehavior(true);
    setBehaviorError("");
    try {
      const result = await recalculateBehaviorProfile(selectedUserForBehavior);
      if (result.success) {
        setBehaviorProfile(result.profile);
      } else {
        setBehaviorError(result.error || "Failed to recalculate profile");
      }
    } catch (err: any) {
      setBehaviorError(err.message || "Failed to recalculate profile");
    } finally {
      setIsRecalculatingBehavior(false);
    }
  };

  useEffect(() => {
    if (selectedUserForBehavior) {
      loadBehaviorProfile(selectedUserForBehavior);
    }
  }, [selectedUserForBehavior]);

  const handleTriggerBrief = async () => {
    if (!selectedUserForBrief) return;
    setIsTriggeringBrief(true);
    setTriggerResult(null);
    try {
      const res = await triggerBriefing(selectedUserForBrief, briefType);
      setTriggerResult(res);
      const logs = await getBriefingLogs();
      setBriefingLogs(logs);
    } catch (err: any) {
      setTriggerResult({ success: false, error: err.message || "Failed to trigger brief" });
    } finally {
      setIsTriggeringBrief(false);
    }
  };

  const handleTriggerCalendarSync = async () => {
    if (!selectedUserForCalendar) return;
    setIsTriggeringCalendar(true);
    setCalendarTriggerResult(null);
    try {
      const res = await triggerManualCalendarSync(selectedUserForCalendar);
      setCalendarTriggerResult(res);
      
      // Reload telemetry logs and stats
      const calLogs = await getCalendarSyncLogs();
      setCalendarLogs(calLogs);
      const calStats = await getCalendarStats();
      setCalendarStats(calStats);
    } catch (err: any) {
      setCalendarTriggerResult({ success: false, error: err.message || "Failed to trigger calendar sync" });
    } finally {
      setIsTriggeringCalendar(false);
    }
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
            Real-time workflow trace logs, token budgets, execution graphs, runtime checkpoints, and briefings telemetry.
          </p>
          <div className="flex gap-2 mt-4">
            <button
              onClick={() => setDashboardView("workflows")}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition ${
                dashboardView === "workflows"
                  ? "bg-accent text-white"
                  : "bg-secondary text-secondary-foreground hover:bg-muted"
              }`}
            >
              Workflow Logs
            </button>
            <button
              onClick={() => setDashboardView("briefings")}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition ${
                dashboardView === "briefings"
                  ? "bg-accent text-white"
                  : "bg-secondary text-secondary-foreground hover:bg-muted"
              }`}
            >
              Proactive Briefings
            </button>
            <button
              onClick={() => setDashboardView("calendar")}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition ${
                dashboardView === "calendar"
                  ? "bg-accent text-white"
                  : "bg-secondary text-secondary-foreground hover:bg-muted"
              }`}
            >
              Calendar Mirroring
            </button>
            <button
              onClick={() => setDashboardView("behavior")}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition ${
                dashboardView === "behavior"
                  ? "bg-accent text-white"
                  : "bg-secondary text-secondary-foreground hover:bg-muted"
              }`}
            >
              Behavior Intelligence
            </button>
          </div>
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

      {dashboardView === "workflows" ? (
        <>
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
                    const isFailed = wf.snapshot.errors && wf.snapshot.errors.length > 0;
                    const isCompleted = wf.afterNode === "assembler";
                    const statusText = isFailed ? "Failed" : isCompleted ? "Completed" : "Running";
                    const badgeColor = isFailed 
                      ? "bg-red-500/10 text-destructive border-red-500/20" 
                      : isCompleted 
                        ? "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20"
                        : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20";

                    return (
                      <button
                        key={wf.workflowId}
                        onClick={() => setSelectedWorkflowId(wf.workflowId)}
                        className={`w-full text-left p-3 rounded-lg border transition duration-200 flex flex-col gap-1.5 cursor-pointer ${
                          isSelected 
                            ? "bg-secondary border-accent" 
                            : "border-border bg-card/50 hover:bg-secondary/40"
                        }`}
                      >
                        <div className="flex justify-between items-center">
                          <span className="font-mono text-[10px] text-muted-foreground">
                            ID: {wf.workflowId.slice(0, 8)}...
                          </span>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded-full border font-semibold ${badgeColor}`}>
                            {statusText}
                          </span>
                        </div>
                        <p className="text-xs font-semibold truncate">
                          Msg: "{wf.snapshot.userMessage || "Init workflow"}"
                        </p>
                        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                          <span>Node: {wf.afterNode}</span>
                          <span>
                            {new Date(wf.checkpointedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </span>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </aside>

            {/* Right Side: Workflow Details panel */}
            <main className="lg:col-span-8 bg-card border border-border rounded-xl flex flex-col p-5 shadow-sm min-h-[500px]">
              {!selectedWorkflow ? (
                <div className="flex-grow flex flex-col items-center justify-center text-center p-8">
                  <Terminal className="w-12 h-12 text-muted-foreground mb-3 opacity-60" />
                  <h3 className="text-sm font-semibold">No Workflow Selected</h3>
                  <p className="text-xs text-muted-foreground max-w-xs mt-1">
                    Select a workflow run from the sidebar to inspect execution steps, LLM calls, prompts, and memory checkpoints.
                  </p>
                </div>
              ) : (
                <div className="flex-grow flex flex-col h-full justify-between">
                  {/* Selected workflow header info */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-4 mb-6">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold font-mono px-2 py-0.5 bg-secondary border border-border rounded">
                          WF: {selectedWorkflow.workflowId}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          v{selectedWorkflow.workflowVersion} (Graph v{selectedWorkflow.graphVersion})
                        </span>
                      </div>
                      <p className="text-xs font-semibold mt-2 text-muted-foreground truncate">
                        Conv: <span className="font-mono text-[10px] text-foreground">{selectedWorkflow.snapshot.conversationId}</span>
                      </p>
                    </div>

                    {/* Quick workflow stats */}
                    <div className="flex items-center gap-4 text-right">
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
                                    <p className="text-[11px] text-muted-foreground/80 mt-1 pl-2 border-l-2 border-secondary font-mono">
                                      {detailsText}
                                    </p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Emitted events list */}
                        {selectedWorkflow.snapshot.emittedEvents && selectedWorkflow.snapshot.emittedEvents.length > 0 && (
                          <div className="pt-4 border-t border-border">
                            <h4 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-3">Internal Emitted Events</h4>
                            <div className="space-y-2">
                              {selectedWorkflow.snapshot.emittedEvents.map((evt, idx) => (
                                <div key={idx} className="p-3 bg-secondary/30 rounded-lg flex flex-col gap-1 border border-border">
                                  <div className="flex justify-between items-center">
                                    <span className="text-xs font-semibold text-accent">{evt.name}</span>
                                    <span className="text-[9px] font-mono text-muted-foreground">
                                      {new Date(evt.emittedAt).toLocaleTimeString()}
                                    </span>
                                  </div>
                                  <pre className="text-[10px] text-muted-foreground font-mono overflow-x-auto p-1 bg-black/10 rounded">
                                    {JSON.stringify(evt.payload, null, 2)}
                                  </pre>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* 2. AI REQUESTS & PROMPTS TAB */}
                    {activeTab === "ai" && (
                      <div className="space-y-4">
                        <h4 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2">Gemini Model Transactions</h4>
                        
                        {selectedWfCalls.length === 0 ? (
                          <div className="text-center text-xs text-muted-foreground py-8">
                            No active AI calls made in this workflow run (e.g. bypassed by router).
                          </div>
                        ) : (
                          <div className="space-y-4">
                            {selectedWfCalls.map((call, idx) => {
                              const isExpanded = expandedPromptIdx === idx;
                              const costText = call.cost > 0.01 ? `$${call.cost.toFixed(4)}` : `$${call.cost.toFixed(6)}`;
                              return (
                                <div key={idx} className="border border-border rounded-xl bg-card overflow-hidden">
                                  {/* Call header bar */}
                                  <button 
                                    onClick={() => setExpandedPromptIdx(isExpanded ? null : idx)}
                                    className="w-full flex justify-between items-center p-3 bg-secondary/20 hover:bg-secondary/40 transition text-left cursor-pointer"
                                  >
                                    <div className="flex items-center gap-3">
                                      <Sparkles className={`w-4 h-4 text-accent ${call.success ? "" : "text-destructive"}`} />
                                      <div>
                                        <span className="text-xs font-semibold block">{call.model}</span>
                                        <span className="text-[10px] text-muted-foreground">
                                          {call.promptTokens} in / {call.completionTokens} out • {call.duration > 1000 ? `${(call.duration/1000).toFixed(2)}s` : `${call.duration}ms`}
                                        </span>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-3 text-right">
                                      <div className="text-right">
                                        <span className="text-xs font-semibold block">{costText}</span>
                                        <span className="text-[9px] text-muted-foreground">Token Cost</span>
                                      </div>
                                      {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                                    </div>
                                  </button>

                                  {/* Expanded content */}
                                  {isExpanded && (
                                    <div className="p-4 border-t border-border space-y-4 text-xs">
                                      {call.error && (
                                        <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive rounded-lg flex items-center gap-2 font-mono text-[10px]">
                                          <AlertCircle className="w-4 h-4 shrink-0" />
                                          <span>Error: {call.error}</span>
                                        </div>
                                      )}

                                      {/* Prompt Inspector: System Instruction */}
                                      {call.systemInstruction && (
                                        <div>
                                          <div className="flex justify-between items-center mb-1">
                                            <span className="font-semibold text-muted-foreground">System Instruction</span>
                                            <button 
                                              onClick={() => handleCopy(call.systemInstruction || "")}
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
        </>
      ) : dashboardView === "briefings" ? (
        <div className="space-y-6 flex-grow flex flex-col">
          {/* Briefing Telemetry Stats cards */}
          <section className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-8 gap-4">
            <div className="bg-card border border-border p-4 rounded-xl shadow-sm lg:col-span-2">
              <div className="text-xs text-muted-foreground flex items-center justify-between">
                <span>Morning Briefings</span>
                <Mail className="w-3.5 h-3.5 text-accent" />
              </div>
              <p className="text-2xl font-semibold mt-2">
                {briefingLogs.filter((l) => l.type === "morning" && l.status === "success").length}
              </p>
              <div className="text-[10px] text-muted-foreground mt-1">Total sent successfully</div>
            </div>

            <div className="bg-card border border-border p-4 rounded-xl shadow-sm lg:col-span-2">
              <div className="text-xs text-muted-foreground flex items-center justify-between">
                <span>Evening Briefings</span>
                <Mail className="w-3.5 h-3.5 text-accent" />
              </div>
              <p className="text-2xl font-semibold mt-2">
                {briefingLogs.filter((l) => l.type === "evening" && l.status === "success").length}
              </p>
              <div className="text-[10px] text-muted-foreground mt-1">Total sent successfully</div>
            </div>

            <div className="bg-card border border-border p-4 rounded-xl shadow-sm lg:col-span-1">
              <div className="text-xs text-muted-foreground flex items-center justify-between">
                <span>AI Cost</span>
                <Coins className="w-3.5 h-3.5 text-accent" />
              </div>
              <p className="text-2xl font-semibold mt-2">
                ${briefingLogs.reduce((acc, l) => acc + (l.cost || 0), 0).toFixed(4)}
              </p>
              <div className="text-[10px] text-muted-foreground mt-1">Accumulated LLM cost</div>
            </div>

            <div className="bg-card border border-border p-4 rounded-xl shadow-sm lg:col-span-1">
              <div className="text-xs text-muted-foreground flex items-center justify-between">
                <span>Tokens Used</span>
                <Sparkles className="w-3.5 h-3.5 text-accent" />
              </div>
              <p className="text-2xl font-semibold mt-2">
                {briefingLogs.reduce((acc, l) => acc + (l.tokensUsed || 0), 0).toLocaleString()}
              </p>
              <div className="text-[10px] text-muted-foreground mt-1">Total briefing tokens</div>
            </div>

            <div className="bg-card border border-border p-4 rounded-xl shadow-sm lg:col-span-1">
              <div className="text-xs text-muted-foreground flex items-center justify-between">
                <span>Success Rate</span>
                <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
              </div>
              <p className="text-2xl font-semibold mt-2">
                {briefingLogs.length > 0
                  ? `${Math.round(
                      (briefingLogs.filter((l) => l.status === "success").length / briefingLogs.length) * 100
                    )}%`
                  : "100%"}
              </p>
              <div className="text-[10px] text-muted-foreground mt-1">Delivery success</div>
            </div>

            <div className="bg-card border border-border p-4 rounded-xl shadow-sm lg:col-span-1">
              <div className="text-xs text-muted-foreground flex items-center justify-between">
                <span>Failures / Retries</span>
                <AlertCircle className="w-3.5 h-3.5 text-destructive" />
              </div>
              <p className="text-2xl font-semibold mt-2 text-destructive">
                {briefingLogs.filter((l) => l.status === "failed").length} /{" "}
                {briefingLogs.reduce((acc, l) => acc + (l.retryAttempts || 0), 0)}
              </p>
              <div className="text-[10px] text-muted-foreground mt-1">Failed sends / retries</div>
            </div>
          </section>

          {/* Grid Layout for manual trigger and scheduled info */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left side: Test Trigger Control */}
            <div className="lg:col-span-5 bg-card border border-border p-5 rounded-xl shadow-sm space-y-4">
              <div>
                <h3 className="text-sm font-semibold">Manual Briefing Dispatcher</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Trigger an email brief immediately to the target user. Uses Resend sandbox/production.
                </p>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] font-semibold text-muted-foreground mb-1">Target User</label>
                  <select
                    value={selectedUserForBrief}
                    onChange={(e) => setSelectedUserForBrief(e.target.value)}
                    className="w-full px-3 py-2 rounded-md border border-border bg-secondary text-xs focus:outline-none focus:ring-1 focus:ring-accent"
                  >
                    {dashboardUsers.length === 0 ? (
                      <option value="">No users found</option>
                    ) : (
                      dashboardUsers.map((u) => (
                        <option key={u.firebaseUid} value={u.firebaseUid}>
                          {u.name} ({u.email})
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-muted-foreground mb-1">Briefing Type</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setBriefType("morning")}
                      className={`flex-1 py-1.5 rounded-md text-xs font-semibold border cursor-pointer ${
                        briefType === "morning"
                          ? "bg-accent text-white border-accent"
                          : "border-border bg-secondary text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      🌅 Morning Brief
                    </button>
                    <button
                      onClick={() => setBriefType("evening")}
                      className={`flex-1 py-1.5 rounded-md text-xs font-semibold border cursor-pointer ${
                        briefType === "evening"
                          ? "bg-accent text-white border-accent"
                          : "border-border bg-secondary text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      🌇 Evening Reflection
                    </button>
                  </div>
                </div>

                <button
                  onClick={handleTriggerBrief}
                  disabled={isTriggeringBrief || !selectedUserForBrief}
                  className="w-full py-2 bg-accent text-white rounded-md text-xs font-semibold hover:bg-accent/90 transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Send className={`w-3.5 h-3.5 ${isTriggeringBrief ? "animate-pulse" : ""}`} />
                  {isTriggeringBrief ? "Generating & Sending..." : "Send Test Briefing"}
                </button>
              </div>

              {triggerResult && (
                <div
                  className={`p-3 rounded-lg border text-xs flex gap-2 ${
                    triggerResult.success
                      ? "bg-green-500/10 border-green-500/20 text-green-600 dark:text-green-400"
                      : "bg-destructive/10 border-destructive/20 text-destructive"
                  }`}
                >
                  {triggerResult.success ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <span className="font-semibold block">{triggerResult.success ? "Success" : "Failed"}</span>
                    <p className="mt-0.5">{triggerResult.message || triggerResult.error}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Right side: Scheduled Jobs */}
            <div className="lg:col-span-7 bg-card border border-border p-5 rounded-xl shadow-sm space-y-4">
              <div>
                <h3 className="text-sm font-semibold">Configured Schedules (Cron.org / GitHub Actions targets)</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  How cron scheduling variables are currently registered in this environment.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-3 bg-secondary/30 border border-border rounded-lg">
                  <span className="text-[10px] font-semibold text-muted-foreground block uppercase">Morning Cron Target</span>
                  <span className="text-sm font-bold text-accent block mt-1">/api/cron/morning</span>
                  <span className="text-[10px] text-muted-foreground block mt-1">
                    Triggers daily morning briefs
                  </span>
                </div>
                <div className="p-3 bg-secondary/30 border border-border rounded-lg">
                  <span className="text-[10px] font-semibold text-muted-foreground block uppercase">Evening Cron Target</span>
                  <span className="text-sm font-bold text-accent block mt-1">/api/cron/evening</span>
                  <span className="text-[10px] text-muted-foreground block mt-1">
                    Triggers daily evening reflections
                  </span>
                </div>
              </div>

              <div className="p-3 bg-secondary/20 rounded-lg text-xs text-muted-foreground flex gap-2">
                <Info className="w-4 h-4 shrink-0 text-accent mt-0.5" />
                <p>
                  In production, trigger HTTP requests to these endpoints with the environment configured secret token: e.g. <code className="px-1.5 py-0.5 bg-black/10 rounded">/api/cron/morning?secret=YOUR_CRON_SECRET</code>.
                </p>
              </div>
            </div>
          </div>

          {/* Logs Table */}
          <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden flex-grow flex flex-col p-4">
            <h3 className="text-sm font-semibold mb-3">Briefing Delivery Logs</h3>
            <div className="overflow-x-auto flex-grow max-h-[350px] scrollbar-custom">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-border bg-secondary/30 text-muted-foreground font-semibold">
                    <th className="py-2 px-3">Date/Time</th>
                    <th className="py-2 px-3">Target Email</th>
                    <th className="py-2 px-3">Type</th>
                    <th className="py-2 px-3">Status</th>
                    <th className="py-2 px-3 text-center">Open Tracking</th>
                    <th className="py-2 px-3">Generation Type</th>
                    <th className="py-2 px-3 text-right">Duration</th>
                    <th className="py-2 px-3 text-right">Tokens</th>
                    <th className="py-2 px-3 text-right">Cost</th>
                    <th className="py-2 px-3 text-center">Retries</th>
                  </tr>
                </thead>
                <tbody>
                  {briefingLogs.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="text-center py-6 text-muted-foreground">
                        No briefings have been sent or logged yet.
                      </td>
                    </tr>
                  ) : (
                    briefingLogs.map((log, idx) => (
                      <tr key={idx} className="border-b border-border hover:bg-secondary/10">
                        <td className="py-2.5 px-3 font-mono text-[10px]">
                          {new Date(log.createdAt).toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 font-semibold">{log.email}</td>
                        <td className="py-2.5 px-3 capitalize">
                          {log.type === "morning" ? "🌅 Morning" : "🌇 Evening"}
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                              log.status === "success"
                                ? "bg-green-500/10 text-green-600 dark:text-green-400"
                                : "bg-red-500/10 text-destructive border-red-500/20"
                            }`}
                          >
                            {log.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {log.status === "success" ? (
                            log.opened ? (
                              <span className="text-[10px] bg-green-500/10 text-green-600 dark:text-green-400 px-1.5 py-0.5 rounded font-semibold">
                                Opened ({new Date(log.openedAt).toLocaleTimeString()})
                              </span>
                            ) : (
                              <button
                                onClick={async () => {
                                  const res = await simulateBriefingOpen(log._id);
                                  if (res.success) {
                                    const freshLogs = await getBriefingLogs();
                                    setBriefingLogs(freshLogs);
                                    if (selectedUserForBehavior === log.uid) {
                                      loadBehaviorProfile(log.uid);
                                    }
                                  }
                                }}
                                className="text-[10px] bg-accent/20 hover:bg-accent/40 text-accent px-2 py-0.5 rounded cursor-pointer font-semibold transition"
                              >
                                Sim Open
                              </button>
                            )
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-muted-foreground">
                          {log.skipped ? (
                            <span className="text-[10px] bg-secondary px-1.5 py-0.5 rounded border border-border">Deterministic</span>
                          ) : (
                            <span className="text-[10px] bg-accent/10 text-accent px-1.5 py-0.5 rounded font-semibold border border-accent/20">AI Generated</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-[11px] text-muted-foreground">
                          {log.durationMs}ms
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-[11px] text-muted-foreground">
                          {log.tokensUsed.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-[11px] text-muted-foreground">
                          ${(log.cost || 0).toFixed(4)}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono text-muted-foreground">
                          {log.retryAttempts}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : dashboardView === "calendar" ? (
        /* 3. CALENDAR TELEMETRY VIEW */
        <div className="space-y-6 flex-grow flex flex-col min-h-0">
          
          {/* Calendar Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-8 gap-4">
            <div className="bg-card border border-border p-4 rounded-xl shadow-sm lg:col-span-2">
              <div className="text-xs text-muted-foreground flex items-center justify-between">
                <span>Connected Users</span>
                <Calendar className="w-3.5 h-3.5 text-accent" />
              </div>
              <p className="text-2xl font-semibold mt-2 text-accent">{calendarStats.connectedUsers}</p>
            </div>
            <div className="bg-card border border-border p-4 rounded-xl shadow-sm lg:col-span-2">
              <span className="text-xs text-muted-foreground font-medium block">Events Created</span>
              <p className="text-2xl font-semibold mt-2 text-green-500">{calendarStats.eventsCreated}</p>
            </div>
            <div className="bg-card border border-border p-4 rounded-xl shadow-sm lg:col-span-2">
              <span className="text-xs text-muted-foreground block">Events Updated</span>
              <p className="text-2xl font-semibold mt-2 text-blue-500">{calendarStats.eventsUpdated}</p>
            </div>
            <div className="bg-card border border-border p-4 rounded-xl shadow-sm lg:col-span-2">
              <span className="text-xs text-muted-foreground block">Events Deleted</span>
              <p className="text-2xl font-semibold mt-2 text-red-500">{calendarStats.eventsDeleted}</p>
            </div>
            <div className="bg-card border border-border p-4 rounded-xl shadow-sm lg:col-span-2">
              <span className="text-xs text-muted-foreground block">Events Skipped</span>
              <p className="text-2xl font-semibold mt-2 text-muted-foreground">{calendarStats.eventsSkipped}</p>
            </div>
            <div className="bg-card border border-border p-4 rounded-xl shadow-sm lg:col-span-2">
              <span className="text-xs text-muted-foreground block">Google API Requests</span>
              <p className="text-2xl font-semibold mt-2 text-indigo-400">{calendarStats.googleRequests}</p>
            </div>
            <div className="bg-card border border-border p-4 rounded-xl shadow-sm lg:col-span-2">
              <span className="text-xs text-muted-foreground block">Failures</span>
              <p className={`text-2xl font-semibold mt-2 ${calendarStats.failures > 0 ? "text-destructive font-bold" : "text-muted-foreground/60"}`}>{calendarStats.failures}</p>
            </div>
            <div className="bg-card border border-border p-4 rounded-xl shadow-sm lg:col-span-2">
              <span className="text-xs text-muted-foreground block">Avg Sync Duration</span>
              <p className="text-2xl font-semibold mt-2 text-orange-400">{calendarStats.avgDuration}ms</p>
            </div>
          </div>

          {/* User manual sync testing widget */}
          <div className="bg-card border border-border p-5 rounded-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="space-y-1">
              <h3 className="text-sm font-semibold flex items-center gap-1.5 text-foreground">
                <Calendar className="w-4 h-4 text-accent" /> Trigger Calendar Sync
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Manually run today's agenda synchronization for any system user. Useful for checking Mock / Real OAuth passes.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <select
                value={selectedUserForCalendar}
                onChange={(e) => setSelectedUserForCalendar(e.target.value)}
                className="bg-secondary border border-border px-3 py-1.5 rounded text-xs font-semibold"
              >
                {dashboardUsers.map((user) => (
                  <option key={user.firebaseUid} value={user.firebaseUid}>
                    {user.name} ({user.email})
                  </option>
                ))}
              </select>

              <button
                onClick={handleTriggerCalendarSync}
                disabled={isTriggeringCalendar || !selectedUserForCalendar}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-accent hover:bg-accent/80 text-white rounded text-xs font-semibold transition disabled:opacity-50 cursor-pointer"
              >
                {isTriggeringCalendar ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Syncing...
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    Trigger Sync
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Sync Trigger Result Banner */}
          {calendarTriggerResult && (
            <div className={`p-4 rounded-xl border flex items-start gap-2.5 text-xs ${
              calendarTriggerResult.success 
                ? "bg-green-500/10 border-green-500/20 text-green-600 dark:text-green-400" 
                : "bg-destructive/10 border-destructive/20 text-destructive"
            }`}>
              {calendarTriggerResult.success ? (
                <>
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <span className="font-semibold">Sync Successful!</span>
                    <p className="text-muted-foreground text-[10px]">
                      Created: {calendarTriggerResult.stats?.eventsCreated} | Updated: {calendarTriggerResult.stats?.eventsUpdated} | Deleted: {calendarTriggerResult.stats?.eventsDeleted} | Skipped: {calendarTriggerResult.stats?.eventsSkipped}
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <span className="font-semibold">Sync Failed</span>
                    <p className="text-muted-foreground/80 text-[10px]">{calendarTriggerResult.error}</p>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Sync Log Entries Table */}
          <div className="bg-card border border-border p-5 rounded-xl flex flex-col flex-grow min-h-0">
            <h3 className="text-sm font-semibold mb-3">Calendar Sync Telemetry Logs</h3>
            <div className="overflow-x-auto flex-grow max-h-[350px] scrollbar-custom text-xs">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border bg-secondary/30 text-muted-foreground font-semibold">
                    <th className="py-2 px-3">Date/Time</th>
                    <th className="py-2 px-3">User UID</th>
                    <th className="py-2 px-3">Status</th>
                    <th className="py-2 px-3 text-center">Created</th>
                    <th className="py-2 px-3 text-center">Updated</th>
                    <th className="py-2 px-3 text-center">Deleted</th>
                    <th className="py-2 px-3 text-center">Skipped</th>
                    <th className="py-2 px-3 text-center">Requests</th>
                    <th className="py-2 px-3 text-right font-mono">Duration</th>
                    <th className="py-2 px-3">Errors / Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {calendarLogs.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="text-center py-6 text-muted-foreground">
                        No calendar synchronization attempts have been logged yet.
                      </td>
                    </tr>
                  ) : (
                    calendarLogs.map((log, idx) => (
                      <tr key={idx} className="border-b border-border hover:bg-secondary/10">
                        <td className="py-2.5 px-3 font-mono text-[10px]">
                          {new Date(log.createdAt).toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-muted-foreground">{log.uid}</td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                              log.status === "success"
                                ? "bg-green-500/10 text-green-600 dark:text-green-400"
                                : "bg-red-500/10 text-destructive border-red-500/20"
                            }`}
                          >
                            {log.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center font-semibold text-green-500">{log.eventsCreated}</td>
                        <td className="py-2.5 px-3 text-center font-semibold text-blue-400">{log.eventsUpdated}</td>
                        <td className="py-2.5 px-3 text-center font-semibold text-red-500">{log.eventsDeleted}</td>
                        <td className="py-2.5 px-3 text-center text-muted-foreground">{log.eventsSkipped}</td>
                        <td className="py-2.5 px-3 text-center font-semibold text-indigo-400">{log.googleRequests}</td>
                        <td className="py-2.5 px-3 text-right font-mono text-muted-foreground">{log.duration}ms</td>
                        <td className="py-2.5 px-3 text-destructive max-w-[200px] truncate" title={log.error}>
                          {log.error || "-"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* 4. BEHAVIOR INTELLIGENCE VIEW */
        <div className="space-y-6 flex-grow flex flex-col min-h-0">
          {/* Header controls */}
          <div className="bg-card border border-border p-5 rounded-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="space-y-1">
              <h3 className="text-sm font-semibold flex items-center gap-1.5 text-foreground">
                <BarChart3 className="w-4 h-4 text-accent" /> Behavior Intelligence Profile
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Inspect 100% deterministic, explainable behavioral metrics, streaks, completions, and time preferences.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <select
                value={selectedUserForBehavior}
                onChange={(e) => setSelectedUserForBehavior(e.target.value)}
                className="bg-secondary border border-border px-3 py-1.5 rounded text-xs font-semibold"
              >
                {dashboardUsers.map((user) => (
                  <option key={user.firebaseUid} value={user.firebaseUid}>
                    {user.name} ({user.email})
                  </option>
                ))}
              </select>

              <button
                onClick={handleRecalculateBehavior}
                disabled={isRecalculatingBehavior || !selectedUserForBehavior}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-accent hover:bg-accent/80 text-white rounded text-xs font-semibold transition disabled:opacity-50 cursor-pointer"
              >
                {isRecalculatingBehavior ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Recalculating...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-3.5 h-3.5" />
                    Force Recalculate
                  </>
                )}
              </button>
            </div>
          </div>

          {behaviorError && (
            <div className="p-4 rounded-xl border border-destructive/20 bg-destructive/10 text-destructive text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              <span>{behaviorError}</span>
            </div>
          )}

          {isLoadingBehavior ? (
            <div className="flex-grow flex items-center justify-center py-20">
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="w-8 h-8 animate-spin text-accent" />
                <span className="text-xs text-muted-foreground">Loading Behavior Profile...</span>
              </div>
            </div>
          ) : !behaviorProfile ? (
            <div className="bg-card border border-border p-10 rounded-xl text-center">
              <BarChart3 className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm font-semibold text-foreground">No Profile Found</p>
              <p className="text-xs text-muted-foreground mt-1">
                Please click "Force Recalculate" above to initialize behavior intelligence for this user.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Overview grid */}
              <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 1. STREAKS */}
                <div className="bg-card border border-border p-4 rounded-xl shadow-sm space-y-3 relative overflow-hidden">
                  <div className="absolute right-3 top-3 text-orange-500/10">
                    <Flame className="w-12 h-12" />
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Flame className="w-3.5 h-3.5 text-orange-500" />
                    <span>Streaks</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div>
                      <span className="text-[10px] text-muted-foreground block">Current</span>
                      <p className="text-2xl font-bold text-orange-500">{behaviorProfile.Activity.currentStreak} days</p>
                    </div>
                    <div>
                      <span className="text-[10px] text-muted-foreground block">Longest</span>
                      <p className="text-2xl font-bold text-amber-500">{behaviorProfile.Activity.longestStreak} days</p>
                    </div>
                  </div>
                  <div className="text-[9px] text-muted-foreground border-t border-border/50 pt-2 flex justify-between">
                    <span>Active Days: {behaviorProfile.Activity.daysActive}</span>
                    <span>Last: {behaviorProfile.Activity.lastActivity ? new Date(behaviorProfile.Activity.lastActivity).toLocaleDateString() : "Never"}</span>
                  </div>
                </div>

                {/* 2. COMPLETION RATE */}
                <div className="bg-card border border-border p-4 rounded-xl shadow-sm space-y-3 relative overflow-hidden">
                  <div className="absolute right-3 top-3 text-green-500/10">
                    <CheckCircle2 className="w-12 h-12" />
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                    <span>Completion Rate</span>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-green-500">{behaviorProfile.Completion.completionRate.toFixed(1)}%</p>
                    <div className="w-full bg-secondary h-1.5 rounded-full mt-2 overflow-hidden">
                      <div className="bg-green-500 h-full rounded-full" style={{ width: `${behaviorProfile.Completion.completionRate}%` }} />
                    </div>
                  </div>
                  <div className="text-[9px] text-muted-foreground flex justify-between border-t border-border/50 pt-2">
                    <span>Comp: {behaviorProfile.Completion.completedTasks}</span>
                    <span>Skip: {behaviorProfile.Completion.skippedTasks}</span>
                    <span>Overdue: {behaviorProfile.Completion.overdueTasks}</span>
                  </div>
                </div>

                {/* 3. PRODUCTIVITY */}
                <div className="bg-card border border-border p-4 rounded-xl shadow-sm space-y-3 relative overflow-hidden">
                  <div className="absolute right-3 top-3 text-blue-500/10">
                    <Clock className="w-12 h-12" />
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-blue-500" />
                    <span>Focus Hours</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div>
                      <span className="text-[10px] text-muted-foreground block">Avg Planned</span>
                      <p className="text-xl font-bold text-blue-400">{behaviorProfile.Productivity.averagePlannedHours.toFixed(1)}h/d</p>
                    </div>
                    <div>
                      <span className="text-[10px] text-muted-foreground block">Avg Completed</span>
                      <p className="text-xl font-bold text-indigo-400">{behaviorProfile.Productivity.averageCompletedHours.toFixed(1)}h/d</p>
                    </div>
                  </div>
                  <div className="text-[9px] text-muted-foreground border-t border-border/50 pt-2 flex justify-between">
                    <span>Ratio: {(behaviorProfile.Productivity.workCompletionRatio * 100).toFixed(0)}% completion</span>
                  </div>
                </div>

                {/* 4. DEEP WORK */}
                <div className="bg-card border border-border p-4 rounded-xl shadow-sm space-y-3 relative overflow-hidden">
                  <div className="absolute right-3 top-3 text-red-500/10">
                    <Award className="w-12 h-12" />
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Award className="w-3.5 h-3.5 text-red-500" />
                    <span>Deep Work Sessions</span>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-red-500">{behaviorProfile.DeepWork.deepWorkSessions} sessions</p>
                    <div className="text-[9px] text-muted-foreground mt-2 flex justify-between">
                      <span>Average: {Math.round(behaviorProfile.DeepWork.averageDeepWorkMinutes)}m</span>
                      <span>Longest: {behaviorProfile.DeepWork.longestDeepWorkMinutes}m</span>
                    </div>
                  </div>
                  <div className="text-[9px] text-muted-foreground border-t border-border/50 pt-2">
                    <span>Def: Tasks completed ≥ 45 mins</span>
                  </div>
                </div>
              </section>

              {/* Second row grids: heatmap and preferences */}
              <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Heatmap column */}
                <div className="lg:col-span-8 bg-card border border-border p-5 rounded-xl shadow-sm space-y-4">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <BarChart3 className="w-4 h-4 text-accent" /> GitHub-Style 28-Day Activity
                  </h4>
                  {/* Contribution Heatmap */}
                  <div className="flex flex-wrap gap-1.5 p-3 bg-secondary/20 rounded-lg justify-start items-center">
                    {Array.from({ length: 28 }).map((_, idx) => {
                      const date = new Date();
                      date.setDate(date.getDate() - (27 - idx));
                      date.setHours(12, 0, 0, 0);
                      const dateStr = date.toISOString().split("T")[0];
                      const isActive = behaviorProfile.Activity.activeDates?.includes(dateStr);
                      return (
                        <div
                          key={idx}
                          title={`${date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}: ${isActive ? "Active Day" : "No Actions"}`}
                          className={`w-8 h-8 rounded transition duration-200 border flex items-center justify-center text-[10px] font-mono ${
                            isActive
                              ? "bg-green-500/20 text-green-600 border-green-500/40 dark:bg-green-500/30 dark:text-green-400 font-bold shadow-sm"
                              : "bg-secondary text-muted-foreground border-border/30"
                          }`}
                        >
                          {date.getDate()}
                        </div>
                      );
                    })}
                  </div>
                  <div className="text-[10px] text-muted-foreground flex justify-between items-center px-1">
                    <span>Showing trailing 28 days</span>
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-secondary border border-border/30 rounded inline-block"></span> Empty</span>
                      <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-green-500/20 border border-green-500/40 rounded inline-block"></span> Productive Day</span>
                    </div>
                  </div>
                </div>

                {/* Working hour preferences */}
                <div className="lg:col-span-4 bg-card border border-border p-5 rounded-xl shadow-sm space-y-4">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <PieChart className="w-4 h-4 text-accent" /> Time Preferences
                  </h4>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-muted-foreground">Preferred Window</span>
                      <span className="text-xs font-bold text-foreground px-2 py-0.5 bg-secondary rounded border border-border">
                        {behaviorProfile.TimePreference.preferredWorkingWindow}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-muted-foreground">Peak Window (3h)</span>
                      <span className="text-xs font-bold text-accent px-2 py-0.5 bg-accent/10 rounded border border-accent/20">
                        {behaviorProfile.TimePreference.peakHours}
                      </span>
                    </div>

                    <div className="border-t border-border/50 pt-3 space-y-2">
                      <div className="text-[11px] font-semibold text-muted-foreground">Weekly Rhythms</div>
                      <div className="space-y-2 text-xs">
                        <div>
                          <div className="flex justify-between mb-1 text-[10px]">
                            <span>Weekdays (Mon-Fri)</span>
                            <span className="font-semibold text-green-500">{behaviorProfile.Weekly.weekdayCompletionRate.toFixed(1)}%</span>
                          </div>
                          <div className="w-full bg-secondary h-1.5 rounded-full overflow-hidden">
                            <div className="bg-green-500 h-full" style={{ width: `${behaviorProfile.Weekly.weekdayCompletionRate}%` }}></div>
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between mb-1 text-[10px]">
                            <span>Weekends (Sat-Sun)</span>
                            <span className="font-semibold text-blue-500">{behaviorProfile.Weekly.weekendCompletionRate.toFixed(1)}%</span>
                          </div>
                          <div className="w-full bg-secondary h-1.5 rounded-full overflow-hidden">
                            <div className="bg-blue-500 h-full" style={{ width: `${behaviorProfile.Weekly.weekendCompletionRate}%` }}></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* Third row grids: planning vs execution reliability */}
              <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Execution reliability details */}
                <div className="bg-card border border-border p-5 rounded-xl shadow-sm space-y-4">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4 text-accent" /> Execution Reliability
                  </h4>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="p-3 bg-secondary/30 rounded-lg">
                      <span className="text-[10px] text-muted-foreground block">Agendas Generated</span>
                      <span className="text-lg font-bold text-foreground">{behaviorProfile.Execution.dailyAgendaGenerated}</span>
                    </div>
                    <div className="p-3 bg-secondary/30 rounded-lg">
                      <span className="text-[10px] text-muted-foreground block">Agendas Finished</span>
                      <span className="text-lg font-bold text-green-500">{behaviorProfile.Execution.dailyAgendaCompleted}</span>
                    </div>
                    <div className="p-3 bg-secondary/30 rounded-lg">
                      <span className="text-[10px] text-muted-foreground block">Avg Task Completion</span>
                      <span className="text-lg font-bold text-accent">{behaviorProfile.Execution.averageAgendaCompletion.toFixed(1)}%</span>
                    </div>
                  </div>
                  <div className="text-[10px] text-muted-foreground leading-relaxed">
                    Tracks how many days of agenda tasks were completed in full. An agenda counts as finished when all scheduled focus tasks in work blocks are completed.
                  </div>
                </div>

                {/* Planning & Reliability details */}
                <div className="bg-card border border-border p-5 rounded-xl shadow-sm space-y-4">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <BookOpen className="w-4 h-4 text-accent" /> Planning Reliability
                  </h4>
                  <div className="grid grid-cols-4 gap-2 text-center">
                    <div className="p-3 bg-secondary/30 rounded-lg">
                      <span className="text-[9px] text-muted-foreground block">Created</span>
                      <span className="text-lg font-bold text-foreground">{behaviorProfile.Planning.plansCreated}</span>
                    </div>
                    <div className="p-3 bg-secondary/30 rounded-lg">
                      <span className="text-[9px] text-muted-foreground block">Completed</span>
                      <span className="text-lg font-bold text-green-500">{behaviorProfile.Planning.plansCompleted}</span>
                    </div>
                    <div className="p-3 bg-secondary/30 rounded-lg">
                      <span className="text-[9px] text-muted-foreground block">Abandoned</span>
                      <span className="text-lg font-bold text-red-500">{behaviorProfile.Planning.plansAbandoned}</span>
                    </div>
                    <div className="p-3 bg-secondary/30 rounded-lg">
                      <span className="text-[9px] text-muted-foreground block">Avg Lifetime</span>
                      <span className="text-xs font-bold text-amber-500 block mt-1">{behaviorProfile.Planning.averagePlanLifetime} days</span>
                    </div>
                  </div>
                  <div className="text-[10px] text-muted-foreground leading-relaxed">
                    Tracks structured planning behavior. Shows the ratio of active vs completed/abandoned plans and how long plans live before archiving/completing.
                  </div>
                </div>
              </section>

              {/* Metadata details */}
              <div className="text-[10px] text-muted-foreground flex justify-between px-1">
                <span>Engine Version: {behaviorProfile.Metadata.engineVersion}</span>
                <span>Last Computed: {new Date(behaviorProfile.Metadata.lastComputed).toLocaleString()}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
