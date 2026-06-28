"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState, useTransition } from "react";
import { 
  CheckCircle2, XCircle, AlertTriangle, Terminal, 
  Coins, Zap, RefreshCw, Search, Copy, 
  ChevronDown, ChevronUp, FileText, Activity, Info, 
  Clock, ShieldAlert, Sparkles, Cpu, Mail, Send, AlertCircle, Calendar, Loader2,
  Flame, Trophy, TrendingUp, BarChart3, PieChart, Award, BookOpen,
  Shield, UserCheck, Target, Repeat, CheckSquare, AlertOctagon, History,
  LineChart, TrendingDown, ZapOff
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
  simulateBriefingOpen,
  getConsistencyProfile,
  recalculateConsistencyProfile,
  getConsistencyEvents,
  getPredictionProfile,
  recalculatePredictionProfile,
  getPredictionEvents,
  getRiskProfile,
  recalculateRiskProfile,
  getRiskEvents,
  getAdaptivePolicy,
  recalculateAdaptivePolicy,
  simulateAdaptiveScenario
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
  const [dashboardView, setDashboardView] = useState<"workflows" | "briefings" | "calendar" | "behavior" | "consistency" | "prediction" | "risk" | "adaptive">("workflows");
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

  // Consistency states
  const [selectedUserForConsistency, setSelectedUserForConsistency] = useState<string>("");
  const [consistencyProfile, setConsistencyProfile] = useState<any>(null);
  const [consistencyEvents, setConsistencyEvents] = useState<any[]>([]);
  const [isLoadingConsistency, setIsLoadingConsistency] = useState(false);
  const [isRecalculatingConsistency, setIsRecalculatingConsistency] = useState(false);
  const [consistencyError, setConsistencyError] = useState<string>("");
  const [expandedEvidenceMetric, setExpandedEvidenceMetric] = useState<string | null>(null);

  // Prediction states
  const [selectedUserForPrediction, setSelectedUserForPrediction] = useState<string>("");
  const [predictionProfile, setPredictionProfile] = useState<any>(null);
  const [predictionEvents, setPredictionEvents] = useState<any[]>([]);
  const [isLoadingPrediction, setIsLoadingPrediction] = useState(false);
  const [isRecalculatingPrediction, setIsRecalculatingPrediction] = useState(false);
  const [predictionError, setPredictionError] = useState<string>("");
  const [expandedPredictionEvidence, setExpandedPredictionEvidence] = useState<string | null>(null);

  // Risk states
  const [selectedUserForRisk, setSelectedUserForRisk] = useState<string>("");
  const [riskProfile, setRiskProfile] = useState<any>(null);
  const [riskEvents, setRiskEvents] = useState<any[]>([]);
  const [isLoadingRisk, setIsLoadingRisk] = useState(false);
  const [isRecalculatingRisk, setIsRecalculatingRisk] = useState(false);
  const [riskError, setRiskError] = useState<string>("");
  const [expandedRiskEvidence, setExpandedRiskEvidence] = useState<string | null>(null);

  // Adaptive states
  const [selectedUserForAdaptive, setSelectedUserForAdaptive] = useState<string>("");
  const [adaptivePolicy, setAdaptivePolicy] = useState<any>(null);
  const [isLoadingAdaptive, setIsLoadingAdaptive] = useState(false);
  const [isRecalculatingAdaptive, setIsRecalculatingAdaptive] = useState(false);
  const [isSimulatingScenario, setIsSimulatingScenario] = useState(false);
  const [adaptiveError, setAdaptiveError] = useState<string>("");
  const [expandedAdaptationKey, setExpandedAdaptationKey] = useState<string | null>(null);

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
        if (!selectedUserForConsistency) setSelectedUserForConsistency(users[0].firebaseUid);
        if (!selectedUserForPrediction) setSelectedUserForPrediction(users[0].firebaseUid);
        if (!selectedUserForRisk) setSelectedUserForRisk(users[0].firebaseUid);
        if (!selectedUserForAdaptive) setSelectedUserForAdaptive(users[0].firebaseUid);
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

  const loadConsistencyProfile = async (uid: string) => {
    setIsLoadingConsistency(true);
    setConsistencyError("");
    try {
      const [profile, events] = await Promise.all([
        getConsistencyProfile(uid),
        getConsistencyEvents(uid)
      ]);
      setConsistencyProfile(profile);
      setConsistencyEvents(events);
    } catch (err: any) {
      console.error("Failed to load consistency profile:", err);
      setConsistencyError(err.message || "Failed to load consistency profile");
    } finally {
      setIsLoadingConsistency(false);
    }
  };

  const handleRecalculateConsistency = async () => {
    if (!selectedUserForConsistency) return;
    setIsRecalculatingConsistency(true);
    setConsistencyError("");
    try {
      const result = await recalculateConsistencyProfile(selectedUserForConsistency);
      if (result.success) {
        setConsistencyProfile(result.profile);
        const events = await getConsistencyEvents(selectedUserForConsistency);
        setConsistencyEvents(events);
      } else {
        setConsistencyError(result.error || "Failed to recalculate consistency profile");
      }
    } catch (err: any) {
      setConsistencyError(err.message || "Failed to recalculate consistency profile");
    } finally {
      setIsRecalculatingConsistency(false);
    }
  };

  useEffect(() => {
    if (selectedUserForConsistency) {
      loadConsistencyProfile(selectedUserForConsistency);
    }
  }, [selectedUserForConsistency]);

  const loadPredictionProfile = async (uid: string) => {
    setIsLoadingPrediction(true);
    setPredictionError("");
    try {
      const [profile, events] = await Promise.all([
        getPredictionProfile(uid),
        getPredictionEvents(uid)
      ]);
      setPredictionProfile(profile);
      setPredictionEvents(events);
    } catch (err: any) {
      console.error("Failed to load prediction profile:", err);
      setPredictionError(err.message || "Failed to load prediction profile");
    } finally {
      setIsLoadingPrediction(false);
    }
  };

  const handleRecalculatePrediction = async () => {
    if (!selectedUserForPrediction) return;
    setIsRecalculatingPrediction(true);
    setPredictionError("");
    try {
      const result = await recalculatePredictionProfile(selectedUserForPrediction);
      if (result.success) {
        setPredictionProfile(result.profile);
        const events = await getPredictionEvents(selectedUserForPrediction);
        setPredictionEvents(events);
      } else {
        setPredictionError(result.error || "Failed to recalculate prediction profile");
      }
    } catch (err: any) {
      setPredictionError(err.message || "Failed to recalculate prediction profile");
    } finally {
      setIsRecalculatingPrediction(false);
    }
  };

  useEffect(() => {
    if (selectedUserForPrediction) {
      loadPredictionProfile(selectedUserForPrediction);
    }
  }, [selectedUserForPrediction]);

  const loadRiskProfile = async (uid: string) => {
    setIsLoadingRisk(true);
    setRiskError("");
    try {
      const [profile, events, pred] = await Promise.all([
        getRiskProfile(uid),
        getRiskEvents(uid),
        getPredictionProfile(uid)
      ]);
      setRiskProfile(profile);
      setRiskEvents(events);
      setPredictionProfile(pred);
    } catch (err: any) {
      console.error("Failed to load risk profile:", err);
      setRiskError(err.message || "Failed to load risk profile");
    } finally {
      setIsLoadingRisk(false);
    }
  };

  const handleRecalculateRisk = async () => {
    if (!selectedUserForRisk) return;
    setIsRecalculatingRisk(true);
    setRiskError("");
    try {
      const result = await recalculateRiskProfile(selectedUserForRisk);
      if (result.success) {
        setRiskProfile(result.profile);
        const [events, pred] = await Promise.all([
          getRiskEvents(selectedUserForRisk),
          getPredictionProfile(selectedUserForRisk)
        ]);
        setRiskEvents(events);
        setPredictionProfile(pred);
      } else {
        setRiskError(result.error || "Failed to recalculate risk profile");
      }
    } catch (err: any) {
      setRiskError(err.message || "Failed to recalculate risk profile");
    } finally {
      setIsRecalculatingRisk(false);
    }
  };

  useEffect(() => {
    if (selectedUserForRisk) {
      loadRiskProfile(selectedUserForRisk);
    }
  }, [selectedUserForRisk]);

  const loadAdaptivePolicy = async (uid: string) => {
    setIsLoadingAdaptive(true);
    setAdaptiveError("");
    try {
      const policy = await getAdaptivePolicy(uid);
      setAdaptivePolicy(policy);
    } catch (err: any) {
      console.error("Failed to load adaptive policy:", err);
      setAdaptiveError(err.message || "Failed to load adaptive policy");
    } finally {
      setIsLoadingAdaptive(false);
    }
  };

  const handleRecalculateAdaptive = async () => {
    if (!selectedUserForAdaptive) return;
    setIsRecalculatingAdaptive(true);
    setAdaptiveError("");
    try {
      const result = await recalculateAdaptivePolicy(selectedUserForAdaptive);
      if (result.success) {
        setAdaptivePolicy(result.policy);
      } else {
        setAdaptiveError(result.error || "Failed to recalculate adaptive policy");
      }
    } catch (err: any) {
      setAdaptiveError(err.message || "Failed to recalculate adaptive policy");
    } finally {
      setIsRecalculatingAdaptive(false);
    }
  };

  const handleSimulateScenario = async (scenarioType: string) => {
    if (!selectedUserForAdaptive) return;
    setIsSimulatingScenario(true);
    setAdaptiveError("");
    try {
      const result = await simulateAdaptiveScenario(selectedUserForAdaptive, scenarioType);
      if (result.success) {
        setAdaptivePolicy(result.policy);
      } else {
        setAdaptiveError(result.error || `Failed to simulate scenario: ${scenarioType}`);
      }
    } catch (err: any) {
      setAdaptiveError(err.message || "Failed to run simulation scenario");
    } finally {
      setIsSimulatingScenario(false);
    }
  };

  useEffect(() => {
    if (selectedUserForAdaptive) {
      loadAdaptivePolicy(selectedUserForAdaptive);
    }
  }, [selectedUserForAdaptive]);

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
            <button
              onClick={() => setDashboardView("consistency")}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition ${
                dashboardView === "consistency"
                  ? "bg-accent text-white"
                  : "bg-secondary text-secondary-foreground hover:bg-muted"
              }`}
            >
              Consistency Intelligence
            </button>
            <button
              onClick={() => setDashboardView("prediction")}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition ${
                dashboardView === "prediction"
                  ? "bg-accent text-white"
                  : "bg-secondary text-secondary-foreground hover:bg-muted"
              }`}
            >
              Prediction Intelligence
            </button>
            <button
              onClick={() => setDashboardView("risk")}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition ${
                dashboardView === "risk"
                  ? "bg-accent text-white"
                  : "bg-secondary text-secondary-foreground hover:bg-muted"
              }`}
            >
              Risk Intelligence
            </button>
            <button
              onClick={() => setDashboardView("adaptive")}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition ${
                dashboardView === "adaptive"
                  ? "bg-accent text-white"
                  : "bg-secondary text-secondary-foreground hover:bg-muted"
              }`}
            >
              Adaptive Intelligence
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
      ) : dashboardView === "behavior" ? (
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
      ) : dashboardView === "consistency" ? (
        /* 5. CONSISTENCY INTELLIGENCE VIEW */
        <div className="space-y-6 flex-grow flex flex-col min-h-0">
          {/* Header controls */}
          <div className="bg-card border border-border p-5 rounded-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="space-y-1">
              <h3 className="text-sm font-semibold flex items-center gap-1.5 text-foreground">
                <Shield className="w-4 h-4 text-accent" /> Consistency Intelligence Profile
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Compare actual behavior against identity aspirations, goal priorities, and routines to calculate absolute alignment.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <select
                value={selectedUserForConsistency}
                onChange={(e) => setSelectedUserForConsistency(e.target.value)}
                className="bg-secondary border border-border px-3 py-1.5 rounded text-xs font-semibold"
              >
                {dashboardUsers.map((user) => (
                  <option key={user.firebaseUid} value={user.firebaseUid}>
                    {user.name} ({user.email})
                  </option>
                ))}
              </select>

              <button
                onClick={handleRecalculateConsistency}
                disabled={isRecalculatingConsistency || !selectedUserForConsistency}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-accent hover:bg-accent/80 text-white rounded text-xs font-semibold transition disabled:opacity-50 cursor-pointer"
              >
                {isRecalculatingConsistency ? (
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

          {consistencyError && (
            <div className="p-4 rounded-xl border border-destructive/20 bg-destructive/10 text-destructive text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              <span>{consistencyError}</span>
            </div>
          )}

          {isLoadingConsistency ? (
            <div className="flex-grow flex items-center justify-center py-20">
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="w-8 h-8 animate-spin text-accent" />
                <span className="text-xs text-muted-foreground">Loading Consistency Profile...</span>
              </div>
            </div>
          ) : !consistencyProfile ? (
            <div className="bg-card border border-border p-10 rounded-xl text-center">
              <Shield className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm font-semibold text-foreground">No Profile Found</p>
              <p className="text-xs text-muted-foreground mt-1">
                Please click "Force Recalculate" above to initialize consistency intelligence for this user.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Overview grid */}
              <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 1. OVERALL CONSISTENCY */}
                <div className="bg-card border border-border p-4 rounded-xl shadow-sm space-y-3 relative overflow-hidden">
                  <div className="absolute right-3 top-3 text-accent/10">
                    <Shield className="w-12 h-12" />
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-accent" />
                    <span>Overall Consistency</span>
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-accent">{consistencyProfile.overallConsistency}%</p>
                    <div className="w-full bg-secondary h-1.5 rounded-full mt-2 overflow-hidden">
                      <div className="bg-accent h-full rounded-full" style={{ width: `${consistencyProfile.overallConsistency}%` }} />
                    </div>
                  </div>
                  <div className="text-[9px] text-muted-foreground pt-1 flex justify-between border-t border-border/50">
                    <span>Trends: 7d: {consistencyProfile.Trends?.sevenDayAvg || 0}%</span>
                    <span>30d: {consistencyProfile.Trends?.thirtyDayAvg || 0}%</span>
                  </div>
                </div>

                {/* 2. IDENTITY ALIGNMENT */}
                <div className="bg-card border border-border p-4 rounded-xl shadow-sm space-y-3 relative overflow-hidden">
                  <div className="absolute right-3 top-3 text-green-500/10">
                    <UserCheck className="w-12 h-12" />
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5 text-green-500" />
                    <span>Identity Alignment</span>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-green-500">{consistencyProfile.Identity?.identityAlignmentScore || 0}%</p>
                    <div className="w-full bg-secondary h-1.5 rounded-full mt-2 overflow-hidden">
                      <div className="bg-green-500 h-full rounded-full" style={{ width: `${consistencyProfile.Identity?.identityAlignmentScore || 0}%` }} />
                    </div>
                  </div>
                  <div className="text-[9px] text-muted-foreground pt-1 flex justify-between border-t border-border/50">
                    <span>Relevant: {consistencyProfile.Identity?.completedRelevantHours?.toFixed(1)}h</span>
                    <span>Unrelated: {consistencyProfile.Identity?.completedIrrelevantHours?.toFixed(1)}h</span>
                  </div>
                </div>

                {/* 3. GOAL CONSISTENCY */}
                <div className="bg-card border border-border p-4 rounded-xl shadow-sm space-y-3 relative overflow-hidden">
                  <div className="absolute right-3 top-3 text-blue-500/10">
                    <Target className="w-12 h-12" />
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Target className="w-3.5 h-3.5 text-blue-500" />
                    <span>Goal Consistency</span>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-blue-500">{consistencyProfile.Goals?.goalConsistencyScore || 0}%</p>
                    <div className="w-full bg-secondary h-1.5 rounded-full mt-2 overflow-hidden">
                      <div className="bg-blue-500 h-full rounded-full" style={{ width: `${consistencyProfile.Goals?.goalConsistencyScore || 0}%` }} />
                    </div>
                  </div>
                  <div className="text-[9px] text-muted-foreground pt-1 flex justify-between border-t border-border/50">
                    <span className="truncate max-w-[120px]">Top: {consistencyProfile.Goals?.topGoal || "None"}</span>
                  </div>
                </div>

                {/* 4. GOAL DRIFT */}
                <div className={`p-4 rounded-xl shadow-sm space-y-3 relative overflow-hidden border ${
                  consistencyProfile.Drift?.goalDriftDetected
                    ? "bg-red-500/10 border-red-500/30"
                    : "bg-card border-border"
                }`}>
                  <div className={`absolute right-3 top-3 ${consistencyProfile.Drift?.goalDriftDetected ? "text-red-500/20" : "text-muted-foreground/10"}`}>
                    <AlertOctagon className="w-12 h-12" />
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <AlertOctagon className={`w-3.5 h-3.5 ${consistencyProfile.Drift?.goalDriftDetected ? "text-red-500 animate-pulse" : "text-muted-foreground"}`} />
                    <span>Priority Goal Drift</span>
                  </div>
                  <div>
                    {consistencyProfile.Drift?.goalDriftDetected ? (
                      <div>
                        <p className="text-xl font-bold text-red-500">Drift Detected</p>
                        <p className="text-[10px] text-red-400 mt-1 leading-snug truncate">
                          {consistencyProfile.Drift?.goalDriftPercentage}% time on unrelated tasks!
                        </p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-xl font-bold text-green-500">Aligned</p>
                        <p className="text-[10px] text-muted-foreground mt-1 leading-snug">
                          Work matches active priorities.
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="text-[9px] text-muted-foreground pt-1 border-t border-border/50">
                    <span className="truncate block">Goal: {consistencyProfile.Drift?.driftingGoal || "All Aligned"}</span>
                  </div>
                </div>
              </section>

              {/* Second row: Radar chart & Trend distribution */}
              <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Radar chart column */}
                <div className="lg:col-span-6 bg-card border border-border p-5 rounded-xl shadow-sm flex flex-col items-center justify-center space-y-4">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground self-start flex items-center gap-1.5">
                    <Activity className="w-4 h-4 text-accent" /> Alignment Radar Graph
                  </h4>
                  
                  {/* SVG Radar Chart */}
                  {(() => {
                    const dimensions = [
                      { name: "Identity", val: consistencyProfile.Identity?.identityAlignmentScore || 0 },
                      { name: "Goals", val: consistencyProfile.Goals?.goalConsistencyScore || 0 },
                      { name: "Routine", val: consistencyProfile.Routine?.routineScore || 0 },
                      { name: "Planning", val: consistencyProfile.Planning?.planningConsistencyScore || 0 },
                      { name: "Execution", val: consistencyProfile.Schedule?.scheduleReliabilityScore || 0 },
                      { name: "Commitment", val: consistencyProfile.Commitment?.commitmentScore || 0 }
                    ];

                    const cx = 150;
                    const cy = 150;
                    const rMax = 90;

                    const points = dimensions.map((d, i) => {
                      const angle = i * (Math.PI / 3) - Math.PI / 2;
                      const r = (d.val / 100) * rMax;
                      const x = cx + r * Math.cos(angle);
                      const y = cy + r * Math.sin(angle);
                      return `${x},${y}`;
                    }).join(" ");

                    const rings = [25, 50, 75, 100].map(val => {
                      return dimensions.map((_, i) => {
                        const angle = i * (Math.PI / 3) - Math.PI / 2;
                        const r = (val / 100) * rMax;
                        const x = cx + r * Math.cos(angle);
                        const y = cy + r * Math.sin(angle);
                        return `${x},${y}`;
                      }).join(" ");
                    });

                    const axes = dimensions.map((d, i) => {
                      const angle = i * (Math.PI / 3) - Math.PI / 2;
                      const xOuter = cx + rMax * Math.cos(angle);
                      const yOuter = cy + rMax * Math.sin(angle);
                      // Label position offsets
                      const rLabel = rMax + 20;
                      const xLabel = cx + rLabel * Math.cos(angle);
                      // Push labels up/down slightly to prevent overlaps
                      let yLabel = cy + rLabel * Math.sin(angle);
                      if (i === 0) yLabel -= 5;
                      if (i === 3) yLabel += 10;
                      return { x2: xOuter, y2: yOuter, xl: xLabel, yl: yLabel, name: d.name, val: d.val };
                    });

                    return (
                      <svg width="320" height="320" className="overflow-visible select-none">
                        {/* Ring Grids */}
                        {rings.map((ringPts, idx) => (
                          <polygon
                            key={idx}
                            points={ringPts}
                            className="fill-none stroke-border/40 stroke-1 stroke-dashed"
                          />
                        ))}
                        {/* Axes lines */}
                        {axes.map((axis, idx) => (
                          <line
                            key={idx}
                            x1={cx}
                            y1={cy}
                            x2={axis.x2}
                            y2={axis.y2}
                            className="stroke-border/40 stroke-1"
                          />
                        ))}
                        {/* Data Polygon */}
                        <polygon
                          points={points}
                          className="fill-accent/15 stroke-accent stroke-2"
                        />
                        {/* Data Points Dots */}
                        {dimensions.map((d, i) => {
                          const angle = i * (Math.PI / 3) - Math.PI / 2;
                          const r = (d.val / 100) * rMax;
                          const x = cx + r * Math.cos(angle);
                          const y = cy + r * Math.sin(angle);
                          return (
                            <circle
                              key={i}
                              cx={x}
                              cy={y}
                              r="3.5"
                              className="fill-accent stroke-background stroke-2"
                            />
                          );
                        })}
                        {/* Labels */}
                        {axes.map((axis, idx) => (
                          <text
                            key={idx}
                            x={axis.xl}
                            y={axis.yl}
                            textAnchor="middle"
                            className="text-[9px] font-bold fill-muted-foreground"
                          >
                            {axis.name} ({axis.val}%)
                          </text>
                        ))}
                      </svg>
                    );
                  })()}
                </div>

                {/* Trend logs & Routine Rhythm */}
                <div className="lg:col-span-6 flex flex-col gap-6">
                  {/* Trend Windows */}
                  <div className="bg-card border border-border p-5 rounded-xl shadow-sm space-y-4">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <TrendingUp className="w-4 h-4 text-accent" /> Rolling Consistency Averages
                    </h4>
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div className="p-3 bg-secondary/20 rounded-lg border border-border/50">
                        <span className="text-[10px] text-muted-foreground block uppercase font-semibold">7 Days</span>
                        <p className="text-2xl font-bold text-foreground mt-1">{consistencyProfile.Trends?.sevenDayAvg || 0}%</p>
                      </div>
                      <div className="p-3 bg-secondary/20 rounded-lg border border-border/50">
                        <span className="text-[10px] text-muted-foreground block uppercase font-semibold">30 Days</span>
                        <p className="text-2xl font-bold text-foreground mt-1">{consistencyProfile.Trends?.thirtyDayAvg || 0}%</p>
                      </div>
                      <div className="p-3 bg-secondary/20 rounded-lg border border-border/50">
                        <span className="text-[10px] text-muted-foreground block uppercase font-semibold">Lifetime</span>
                        <p className="text-2xl font-bold text-accent mt-1">{consistencyProfile.Trends?.lifetimeAvg || 0}%</p>
                      </div>
                    </div>
                  </div>

                  {/* Routine window details */}
                  <div className="bg-card border border-border p-5 rounded-xl shadow-sm space-y-3">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Repeat className="w-4 h-4 text-accent" /> Routine Consistency
                    </h4>
                    <div className="space-y-3 text-xs">
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Routine Score</span>
                        <span className="font-semibold text-foreground bg-secondary/50 px-2 py-0.5 rounded border border-border">
                          {consistencyProfile.Routine?.routineScore || 0}%
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Average Schedule Start</span>
                        <span className="font-semibold text-accent bg-accent/10 px-2 py-0.5 rounded border border-accent/20">
                          {consistencyProfile.Routine?.preferredRoutine || "Not established"}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Days Following Routine</span>
                        <span className="font-semibold text-foreground">
                          {consistencyProfile.Routine?.daysFollowingRoutine || 0} of last 14 days
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* Collapsible Evidence Explorer & Consistency Events */}
              <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Consistency Events feed */}
                <div className="bg-card border border-border p-5 rounded-xl shadow-sm flex flex-col">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-1.5">
                    <History className="w-4 h-4 text-accent" /> Recent Consistency Event Logs
                  </h4>
                  <div className="flex-grow max-h-[300px] overflow-y-auto space-y-4 pr-1 scrollbar-custom">
                    {consistencyEvents.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-10">
                        No consistency events have been logged yet.
                      </p>
                    ) : (
                      consistencyEvents.map((evt, idx) => (
                        <div key={idx} className="flex gap-3 items-start border-b border-border/40 pb-3 last:border-0 last:pb-0">
                          <div className={`p-1 rounded-full mt-0.5 ${
                            evt.type === "goal_drift_detected" ? "bg-red-500/10 text-red-500" :
                            evt.type === "planning_reliability_dropped" ? "bg-amber-500/10 text-amber-500" :
                            evt.type === "identity_alignment_improved" ? "bg-green-500/10 text-green-600 dark:text-green-400" :
                            "bg-accent/15 text-accent"
                          }`}>
                            {evt.type === "goal_drift_detected" ? <AlertOctagon className="w-3.5 h-3.5" /> :
                             evt.type === "planning_reliability_dropped" ? <AlertTriangle className="w-3.5 h-3.5" /> :
                             evt.type === "identity_alignment_improved" ? <UserCheck className="w-3.5 h-3.5" /> :
                             <History className="w-3.5 h-3.5" />}
                          </div>
                          <div className="space-y-1">
                            <div className="text-[11px] font-bold text-foreground flex items-center gap-1.5 flex-wrap">
                              <span className="capitalize">{evt.type.replace(/_/g, " ")}</span>
                              <span className="text-[9px] text-muted-foreground font-normal">
                                {new Date(evt.timestamp).toLocaleString()}
                              </span>
                            </div>
                            <p className="text-[11px] text-muted-foreground leading-relaxed">{evt.reason}</p>
                            {evt.evidence && evt.evidence.length > 0 && (
                              <div className="text-[9px] text-muted-foreground/80 pl-2 border-l border-border mt-1.5 space-y-0.5">
                                {evt.evidence.map((ev: string, i: number) => <div key={i}>{ev}</div>)}
                              </div>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Evidence Explorer */}
                <div className="bg-card border border-border p-5 rounded-xl shadow-sm flex flex-col">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-1.5">
                    <Search className="w-4 h-4 text-accent" /> Explainable Evidence Explorer
                  </h4>
                  <div className="space-y-2.5 flex-grow overflow-y-auto max-h-[300px] pr-1 scrollbar-custom">
                    {(() => {
                      const explorerData = [
                        { key: "identity", label: "Identity Alignment", score: consistencyProfile.Identity?.identityAlignmentScore || 0, evidence: consistencyProfile.Identity?.evidence || [] },
                        { key: "goals", label: "Goal Consistency", score: consistencyProfile.Goals?.goalConsistencyScore || 0, evidence: consistencyProfile.Goals?.evidence || [] },
                        { key: "planning", label: "Planning Consistency", score: consistencyProfile.Planning?.planningConsistencyScore || 0, evidence: consistencyProfile.Planning?.evidence || [] },
                        { key: "schedule", label: "Schedule Consistency", score: consistencyProfile.Schedule?.scheduleReliabilityScore || 0, evidence: consistencyProfile.Schedule?.evidence || [] },
                        { key: "routine", label: "Routine Consistency", score: consistencyProfile.Routine?.routineScore || 0, evidence: consistencyProfile.Routine?.evidence || [] },
                        { key: "calendar", label: "Calendar Consistency", score: consistencyProfile.Calendar?.calendarConsistencyScore || 0, evidence: consistencyProfile.Calendar?.evidence || [] },
                        { key: "commitment", label: "Commitment Reliability", score: consistencyProfile.Commitment?.commitmentScore || 0, evidence: consistencyProfile.Commitment?.evidence || [] },
                        { key: "drift", label: "Goal Drift Status", score: consistencyProfile.Drift?.goalDriftDetected ? 0 : 100, evidence: consistencyProfile.Drift?.evidence || [] }
                      ];

                      return explorerData.map((exp) => {
                        const isExpanded = expandedEvidenceMetric === exp.key;
                        return (
                          <div key={exp.key} className="border border-border/60 rounded-lg overflow-hidden">
                            <button
                              onClick={() => setExpandedEvidenceMetric(isExpanded ? null : exp.key)}
                              className="w-full bg-secondary/20 hover:bg-secondary/40 px-3.5 py-2.5 flex justify-between items-center text-xs font-semibold transition cursor-pointer text-left"
                            >
                              <span className="flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full ${
                                  exp.score >= 80 ? "bg-green-500" :
                                  exp.score >= 50 ? "bg-amber-500" : "bg-red-500"
                                }`} />
                                {exp.label}
                              </span>
                              <span className="text-muted-foreground flex items-center gap-1.5 font-mono text-[10px]">
                                {exp.key === "drift" ? (exp.score === 100 ? "Aligned" : "Drifting") : `${exp.score}%`}
                                {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                              </span>
                            </button>
                            {isExpanded && (
                              <div className="p-3 bg-secondary/10 border-t border-border/50 text-[10px] text-muted-foreground space-y-1.5 leading-relaxed font-mono">
                                {exp.evidence.length === 0 ? (
                                  <div className="italic">No evidence registered for this dimension.</div>
                                ) : (
                                  exp.evidence.map((line: string, i: number) => (
                                    <div key={i} className="pl-1 text-foreground/95">{line}</div>
                                  ))
                                )}
                              </div>
                            )}
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              </section>

              {/* Footer metadata */}
              <div className="text-[10px] text-muted-foreground flex justify-between px-1 border-t border-border/30 pt-3">
                <span>Engine Version: 1.0.0</span>
                <span>Last Computed: {new Date(consistencyProfile.lastUpdated).toLocaleString()}</span>
              </div>
            </div>
          )}
        </div>
      ) : dashboardView === "prediction" ? (
        /* 6. PREDICTION INTELLIGENCE VIEW */
        <div className="space-y-6 flex-grow flex flex-col min-h-0">
          {/* Header controls */}
          <div className="bg-card border border-border p-5 rounded-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="space-y-1">
              <h3 className="text-sm font-semibold flex items-center gap-1.5 text-foreground">
                <LineChart className="w-4 h-4 text-accent" /> Prediction Intelligence Profile
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Analyze future project completion dates, daily task probabilities, and productivity forecast ranges derived from statistical models.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <select
                value={selectedUserForPrediction}
                onChange={(e) => setSelectedUserForPrediction(e.target.value)}
                className="bg-secondary border border-border px-3 py-1.5 rounded text-xs font-semibold"
              >
                {dashboardUsers.map((user) => (
                  <option key={user.firebaseUid} value={user.firebaseUid}>
                    {user.name} ({user.email})
                  </option>
                ))}
              </select>

              <button
                onClick={handleRecalculatePrediction}
                disabled={isRecalculatingPrediction || !selectedUserForPrediction}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-accent hover:bg-accent/80 text-white rounded text-xs font-semibold transition disabled:opacity-50 cursor-pointer"
              >
                {isRecalculatingPrediction ? (
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

          {predictionError && (
            <div className="p-4 rounded-xl border border-destructive/20 bg-destructive/10 text-destructive text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              <span>{predictionError}</span>
            </div>
          )}

          {isLoadingPrediction ? (
            <div className="flex-grow flex items-center justify-center py-20">
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="w-8 h-8 animate-spin text-accent" />
                <span className="text-xs text-muted-foreground">Loading Predictions...</span>
              </div>
            </div>
          ) : !predictionProfile ? (
            <div className="bg-card border border-border p-10 rounded-xl text-center">
              <LineChart className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm font-semibold text-foreground">No Profile Found</p>
              <p className="text-xs text-muted-foreground mt-1">
                Please click "Force Recalculate" above to initialize prediction intelligence for this user.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Overview grid */}
              <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 1. ROADMAP COMPLETION */}
                <div className="bg-card border border-border p-4 rounded-xl shadow-sm space-y-3 relative overflow-hidden">
                  <div className="absolute right-3 top-3 text-accent/10">
                    <Calendar className="w-12 h-12" />
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-accent" />
                    <span>Projected Completion</span>
                  </div>
                  <div>
                    <p className="text-xl font-bold text-foreground truncate">
                      {new Date(predictionProfile.completionForecast.estimatedCompletionDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      In ~{predictionProfile.completionForecast.estimatedRemainingDays} days (Confidence: {predictionProfile.completionForecast.confidence}%)
                    </p>
                  </div>
                </div>

                {/* 2. CONSISTENCY FORECAST */}
                <div className="bg-card border border-border p-4 rounded-xl shadow-sm space-y-3 relative overflow-hidden">
                  <div className="absolute right-3 top-3 text-green-500/10">
                    <Shield className="w-12 h-12" />
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-green-500" />
                    <span>Consistency Projection</span>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-green-500">{predictionProfile.consistencyForecast.predictedConsistencyNextWeek}%</p>
                    <div className="text-[10px] text-muted-foreground mt-1.5 flex items-center gap-1">
                      {predictionProfile.consistencyForecast.trendDirection === "up" ? (
                        <span className="text-green-500 flex items-center gap-0.5"><TrendingUp className="w-3.5 h-3.5" /> Trending Up</span>
                      ) : predictionProfile.consistencyForecast.trendDirection === "down" ? (
                        <span className="text-red-500 flex items-center gap-0.5"><TrendingDown className="w-3.5 h-3.5" /> Trending Down</span>
                      ) : (
                        <span className="text-muted-foreground">Stable Trend</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* 3. PRODUCTIVITY FORECAST */}
                <div className="bg-card border border-border p-4 rounded-xl shadow-sm space-y-3 relative overflow-hidden">
                  <div className="absolute right-3 top-3 text-blue-500/10">
                    <Clock className="w-12 h-12" />
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-blue-500" />
                    <span>Focus Hours (7d)</span>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-blue-500">
                      {predictionProfile.productivityForecast.expectedFocusHours7d.min}–{predictionProfile.productivityForecast.expectedFocusHours7d.max} hrs
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Expected tasks: {predictionProfile.productivityForecast.expectedCompletedTasks7d.min}–{predictionProfile.productivityForecast.expectedCompletedTasks7d.max}
                    </p>
                  </div>
                </div>

                {/* 4. AVERAGE CONFIDENCE */}
                <div className="bg-card border border-border p-4 rounded-xl shadow-sm space-y-3 relative overflow-hidden">
                  <div className="absolute right-3 top-3 text-indigo-500/10">
                    <Trophy className="w-12 h-12" />
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Trophy className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Average Confidence</span>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-indigo-500">{predictionProfile.averageConfidence}%</p>
                    <div className="w-full bg-secondary h-1.5 rounded-full mt-2 overflow-hidden">
                      <div className="bg-indigo-500 h-full rounded-full" style={{ width: `${predictionProfile.averageConfidence}%` }} />
                    </div>
                  </div>
                </div>
              </section>

              {/* Second row: SVG Line graph & task probability */}
              <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Rolling prediction curve */}
                <div className="lg:col-span-8 bg-card border border-border p-5 rounded-xl shadow-sm flex flex-col space-y-4">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <LineChart className="w-4 h-4 text-accent" /> Rolling Roadmap Completion Forecast
                  </h4>

                  {/* SVG line chart */}
                  {(() => {
                    const pts = predictionProfile.rollingPredictions || [];
                    const maxDays = Math.max(...pts.map((p: any) => p.roadmapEstimatedRemainingDays), 30);
                    const minDays = Math.min(...pts.map((p: any) => p.roadmapEstimatedRemainingDays), 0);
                    const range = maxDays - minDays || 1;

                    const width = 500;
                    const height = 120;

                    const linePoints = pts.map((p: any, idx: number) => {
                      const x = pts.length > 1 ? (idx / (pts.length - 1)) * (width - 40) + 20 : width / 2;
                      const y = height - 20 - ((p.roadmapEstimatedRemainingDays - minDays) / range) * (height - 40);
                      return `${x},${y}`;
                    }).join(" ");

                    return (
                      <div className="w-full bg-secondary/10 p-4 rounded-xl border border-border/50">
                        {pts.length < 2 ? (
                          <div className="h-[100px] flex items-center justify-center text-xs text-muted-foreground">
                            Insufficient rolling prediction points. Perform actions to plot graph over time.
                          </div>
                        ) : (
                          <svg className="w-full overflow-visible" height={height} viewBox={`0 0 ${width} ${height}`}>
                            {/* Gridlines */}
                            {[0, 0.5, 1].map((val: number, i: number) => {
                              const y = height - 20 - val * (height - 40);
                              const label = Math.round(minDays + val * range);
                              return (
                                <g key={i} className="opacity-40">
                                  <line x1="20" y1={y} x2={width - 20} y2={y} className="stroke-border stroke-1 stroke-dashed" />
                                  <text x="5" y={y + 3} className="text-[8px] font-mono fill-muted-foreground">{label}d</text>
                                </g>
                              );
                            })}
                            
                            {/* Sparkline curve */}
                            <polyline
                              points={linePoints}
                              className="fill-none stroke-accent stroke-2"
                            />
                            
                            {/* Sparkline points */}
                            {pts.map((p: any, idx: number) => {
                              const x = (idx / (pts.length - 1)) * (width - 40) + 20;
                              const y = height - 20 - ((p.roadmapEstimatedRemainingDays - minDays) / range) * (height - 40);
                              return (
                                <circle
                                  key={idx}
                                  cx={x}
                                  cy={y}
                                  r="3"
                                  className="fill-accent stroke-background stroke-2 hover:r-4 transition duration-200 cursor-pointer"
                                />
                              );
                            })}
                          </svg>
                        )}
                        <div className="text-[9px] text-muted-foreground flex justify-between px-1 mt-2">
                          <span>Oldest Calculation</span>
                          <span>Latest calculation (Remaining days over time)</span>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Today's task completion probabilities */}
                <div className="lg:col-span-4 bg-card border border-border p-5 rounded-xl shadow-sm flex flex-col space-y-4">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <CheckSquare className="w-4 h-4 text-accent" /> Today's Completion Probability
                  </h4>
                  <div className="flex-grow overflow-y-auto max-h-[160px] pr-1 space-y-3 scrollbar-custom">
                    {predictionProfile.dailyTaskForecast.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-8">
                        No tasks scheduled in today's agenda to analyze.
                      </p>
                    ) : (
                      predictionProfile.dailyTaskForecast.map((t: any, idx: number) => (
                        <div key={idx} className="flex justify-between items-center border-b border-border/40 pb-2 last:border-0 last:pb-0">
                          <span className="text-xs text-foreground/90 truncate max-w-[170px]" title={t.title}>
                            {t.title}
                          </span>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className={`text-[10px] font-mono font-semibold ${
                              t.completionProbability >= 80 ? "text-green-500" :
                              t.completionProbability >= 50 ? "text-amber-500" : "text-red-500"
                            }`}>{t.completionProbability}%</span>
                            <div className="w-12 bg-secondary h-1.5 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${
                                t.completionProbability >= 80 ? "bg-green-500" :
                                t.completionProbability >= 50 ? "bg-amber-500" : "bg-red-500"
                              }`} style={{ width: `${t.completionProbability}%` }} />
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </section>

              {/* Third row: Goal Forecast Table & Deadline Probabilities */}
              <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Goal Forecast Table */}
                <div className="lg:col-span-8 bg-card border border-border rounded-xl shadow-sm p-5 flex flex-col">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-1.5">
                    <Target className="w-4 h-4 text-accent" /> Goal Completion Timelines & Deadline Forecasts
                  </h4>
                  <div className="overflow-x-auto flex-grow max-h-[220px] scrollbar-custom text-xs">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-border bg-secondary/30 text-muted-foreground font-semibold">
                          <th className="py-2 px-3">Goal</th>
                          <th className="py-2 px-3">Projected Date</th>
                          <th className="py-2 px-3">Likelihood</th>
                          <th className="py-2 px-3">Deadline Status (Early / On Time / Late)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {predictionProfile.goalForecast.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="text-center py-6 text-muted-foreground">
                              No active goals to project.
                            </td>
                          </tr>
                        ) : (
                          predictionProfile.goalForecast.map((gf: any, idx: number) => {
                            const df = predictionProfile.deadlineForecast.find((d: any) => d.goalId === gf.goalId);
                            return (
                              <tr key={idx} className="border-b border-border hover:bg-secondary/10">
                                <td className="py-2.5 px-3 font-semibold">{gf.goalTitle}</td>
                                <td className="py-2.5 px-3 font-mono text-[10px] text-muted-foreground">
                                  {new Date(gf.estimatedCompletionDate).toLocaleDateString()}
                                </td>
                                <td className="py-2.5 px-3">
                                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                    gf.likelihood === "High" ? "bg-green-500/10 text-green-600 dark:text-green-400" :
                                    gf.likelihood === "Medium" ? "bg-amber-500/10 text-amber-500" :
                                    "bg-red-500/10 text-red-500"
                                  }`}>{gf.likelihood}</span>
                                </td>
                                <td className="py-2.5 px-3">
                                  {df ? (
                                    <div className="flex items-center gap-2 w-full max-w-[200px]">
                                      <div className="flex h-2.5 rounded-full overflow-hidden flex-grow bg-secondary/30 border border-border/30">
                                        <div title={`Early: ${df.probabilityEarly}%`} className="bg-green-500 h-full" style={{ width: `${df.probabilityEarly}%` }} />
                                        <div title={`On Time: ${df.probabilityOnTime}%`} className="bg-blue-400 h-full" style={{ width: `${df.probabilityOnTime}%` }} />
                                        <div title={`Late: ${df.probabilityLate}%`} className="bg-red-500 h-full" style={{ width: `${df.probabilityLate}%` }} />
                                      </div>
                                      <span className="text-[9px] font-mono text-red-400 flex-shrink-0">
                                        L: {df.probabilityLate}%
                                      </span>
                                    </div>
                                  ) : (
                                    <span className="text-muted-foreground text-[10px]">-</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Habit Streak Prediction */}
                <div className="lg:col-span-4 bg-card border border-border p-5 rounded-xl shadow-sm flex flex-col space-y-4">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Flame className="w-4 h-4 text-accent" /> Streak Survival Forecast
                  </h4>
                  <div className="space-y-4 text-xs flex-grow justify-center flex flex-col">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Current Active Streak</span>
                      <span className="font-bold text-orange-500 px-2 py-0.5 bg-orange-500/10 rounded border border-orange-500/20 flex items-center gap-1">
                        <Flame className="w-3.5 h-3.5" /> {predictionProfile.habitForecast.currentStreak} days
                      </span>
                    </div>

                    <div className="border-t border-border/40 pt-3 space-y-2.5">
                      <div>
                        <div className="flex justify-between text-[10px] mb-1">
                          <span>Probability Continue Tomorrow</span>
                          <span className="font-semibold text-green-500">{predictionProfile.habitForecast.probabilityContinueTomorrow}%</span>
                        </div>
                        <div className="w-full bg-secondary h-1.5 rounded-full overflow-hidden">
                          <div className="bg-green-500 h-full" style={{ width: `${predictionProfile.habitForecast.probabilityContinueTomorrow}%` }}></div>
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-[10px] mb-1">
                          <span>Probability Continue Next Week</span>
                          <span className="font-semibold text-blue-500">{predictionProfile.habitForecast.probabilityContinueNextWeek}%</span>
                        </div>
                        <div className="w-full bg-secondary h-1.5 rounded-full overflow-hidden">
                          <div className="bg-blue-500 h-full" style={{ width: `${predictionProfile.habitForecast.probabilityContinueNextWeek}%` }}></div>
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-[10px] mb-1">
                          <span>Risk of Streak Failure</span>
                          <span className="font-semibold text-red-500">{predictionProfile.habitForecast.probabilityLoseStreak}%</span>
                        </div>
                        <div className="w-full bg-secondary h-1.5 rounded-full overflow-hidden">
                          <div className="bg-red-500 h-full" style={{ width: `${predictionProfile.habitForecast.probabilityLoseStreak}%` }}></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* Fourth row: Collapsible Evidence Explorer & Prediction Events */}
              <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Prediction Events timeline */}
                <div className="bg-card border border-border p-5 rounded-xl shadow-sm flex flex-col">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-1.5">
                    <History className="w-4 h-4 text-accent" /> Recent Prediction Shift Events
                  </h4>
                  <div className="flex-grow max-h-[300px] overflow-y-auto space-y-4 pr-1 scrollbar-custom">
                    {predictionEvents.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-10">
                        No prediction change events have been logged yet.
                      </p>
                    ) : (
                      predictionEvents.map((evt: any, idx: number) => (
                        <div key={idx} className="flex gap-3 items-start border-b border-border/40 pb-3 last:border-0 last:pb-0">
                          <div className={`p-1 rounded-full mt-0.5 ${
                            evt.predictionType === "burnout_risk" ? "bg-red-500/10 text-red-500" :
                            evt.predictionType === "roadmap_completion" ? "bg-green-500/10 text-green-600 dark:text-green-400" :
                            "bg-accent/15 text-accent"
                          }`}>
                            <History className="w-3.5 h-3.5" />
                          </div>
                          <div className="space-y-1">
                            <div className="text-[11px] font-bold text-foreground flex items-center gap-1.5 flex-wrap">
                              <span className="capitalize">{evt.predictionType.replace(/_/g, " ")}</span>
                              <span className="text-[9px] text-muted-foreground font-normal">
                                {new Date(evt.timestamp).toLocaleString()}
                              </span>
                            </div>
                            <p className="text-[11px] text-muted-foreground leading-relaxed">{evt.reason}</p>
                            <div className="text-[9px] text-muted-foreground font-mono flex gap-4 pt-0.5">
                              <span>Before: {evt.oldPrediction}</span>
                              <span>After: {evt.newPrediction}</span>
                              <span>Confidence: {evt.confidence}%</span>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Evidence Explorer */}
                <div className="bg-card border border-border p-5 rounded-xl shadow-sm flex flex-col">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-1.5">
                    <Search className="w-4 h-4 text-accent" /> Explainable Evidence Explorer
                  </h4>
                  <div className="space-y-2.5 flex-grow overflow-y-auto max-h-[300px] pr-1 scrollbar-custom">
                    {(() => {
                      const goalEvidence = (predictionProfile.goalForecast || []).map((gf: any) => 
                        `* Goal "${gf.goalTitle}": Likelihood = ${gf.likelihood}, projected date = ${new Date(gf.estimatedCompletionDate).toLocaleDateString()}, confidence = ${gf.confidence}%`
                      );
                      const explorerData = [
                        { key: "completion", label: "Roadmap Completion Forecast", score: predictionProfile.completionForecast.confidence, evidence: predictionProfile.completionForecast.evidence || [] },
                        { key: "productivity", label: "Productivity Range Forecast", score: 85, evidence: predictionProfile.productivityForecast.evidence || [] },
                        { key: "consistency", label: "Consistency Projection", score: predictionProfile.consistencyForecast.predictedConsistencyNextWeek, evidence: predictionProfile.consistencyForecast.evidence || [] },
                        { key: "habit", label: "Streak Survival Forecast", score: predictionProfile.habitForecast.probabilityContinueTomorrow, evidence: predictionProfile.habitForecast.evidence || [] },
                        { key: "goals", label: "Goal Completed timelines", score: 80, evidence: goalEvidence }
                      ];

                      return explorerData.map((exp) => {
                        const isExpanded = expandedPredictionEvidence === exp.key;
                        return (
                          <div key={exp.key} className="border border-border/60 rounded-lg overflow-hidden">
                            <button
                              onClick={() => setExpandedPredictionEvidence(isExpanded ? null : exp.key)}
                              className="w-full bg-secondary/20 hover:bg-secondary/40 px-3.5 py-2.5 flex justify-between items-center text-xs font-semibold transition cursor-pointer text-left"
                            >
                              <span className="flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full ${
                                  exp.score >= 80 ? "bg-green-500" :
                                  exp.score >= 50 ? "bg-amber-500" : "bg-red-500"
                                }`} />
                                {exp.label}
                              </span>
                              <span className="text-muted-foreground flex items-center gap-1.5 font-mono text-[10px]">
                                {exp.score}%
                                {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                              </span>
                            </button>
                            {isExpanded && (
                              <div className="p-3 bg-secondary/10 border-t border-border/50 text-[10px] text-muted-foreground space-y-1.5 leading-relaxed font-mono">
                                {exp.evidence.length === 0 ? (
                                  <div className="italic">No evidence registered for this prediction.</div>
                                ) : (
                                  exp.evidence.map((line: string, i: number) => (
                                    <div key={i} className="pl-1 text-foreground/95">{line}</div>
                                  ))
                                )}
                              </div>
                            )}
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              </section>

            </div>
          )}
        </div>
      ) : dashboardView === "risk" ? (
        /* 7. RISK INTELLIGENCE VIEW */
        <div className="space-y-6 flex-grow flex flex-col min-h-0">
          {/* Header controls */}
          <div className="bg-card border border-border p-5 rounded-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="space-y-1">
              <h3 className="text-sm font-semibold flex items-center gap-1.5 text-foreground">
                <AlertTriangle className="w-4 h-4 text-red-500 animate-pulse" /> Risk Intelligence Profile
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Observe potential threats, burnout indicators, goal drift analysis, and deadline vulnerabilities calculated from trailing behavioral history.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <select
                value={selectedUserForRisk}
                onChange={(e) => setSelectedUserForRisk(e.target.value)}
                className="bg-secondary border border-border px-3 py-1.5 rounded text-xs font-semibold"
              >
                {dashboardUsers.map((user) => (
                  <option key={user.firebaseUid} value={user.firebaseUid}>
                    {user.name} ({user.email})
                  </option>
                ))}
              </select>

              <button
                onClick={handleRecalculateRisk}
                disabled={isRecalculatingRisk || !selectedUserForRisk}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-accent hover:bg-accent/80 text-white rounded text-xs font-semibold transition disabled:opacity-50 cursor-pointer"
              >
                {isRecalculatingRisk ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Analyzing...
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

          {riskError && (
            <div className="p-4 rounded-xl border border-destructive/20 bg-destructive/10 text-destructive text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              <span>{riskError}</span>
            </div>
          )}

          {isLoadingRisk ? (
            <div className="flex-grow flex items-center justify-center py-20">
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="w-8 h-8 animate-spin text-accent" />
                <span className="text-xs text-muted-foreground">Evaluating Trajectory Risks...</span>
              </div>
            </div>
          ) : !riskProfile ? (
            <div className="bg-card border border-border p-10 rounded-xl text-center">
              <AlertTriangle className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm font-semibold text-foreground">No Risk Profile Found</p>
              <p className="text-xs text-muted-foreground mt-1">
                Please click "Force Recalculate" above to initialize risk analysis for this user.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Top Overview Level */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Overall Risk Score */}
                <div className="bg-card border border-border p-5 rounded-xl shadow-sm space-y-3 relative overflow-hidden flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <ShieldAlert className="w-3.5 h-3.5 text-accent" />
                      <span>Overall Trajectory Threat</span>
                    </div>
                    <div>
                      <p className="text-3xl font-extrabold text-foreground">
                        {riskProfile.overallRisk}%
                      </p>
                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold mt-1.5 ${
                        riskProfile.overallRisk >= 81 ? "bg-red-500/10 text-red-500 border border-red-500/20" :
                        riskProfile.overallRisk >= 61 ? "bg-orange-500/10 text-orange-500 border border-orange-500/20" :
                        riskProfile.overallRisk >= 31 ? "bg-yellow-500/10 text-yellow-600 border border-yellow-500/20" :
                        "bg-green-500/10 text-green-500 border border-green-500/20"
                      }`}>
                        {riskProfile.overallRisk >= 81 ? "CRITICAL" :
                         riskProfile.overallRisk >= 61 ? "HIGH" :
                         riskProfile.overallRisk >= 31 ? "MODERATE" : "LOW"}
                      </span>
                    </div>
                  </div>
                  <div className="w-full bg-secondary h-1.5 rounded-full overflow-hidden mt-3">
                    <div className={`h-full rounded-full ${
                      riskProfile.overallRisk >= 61 ? "bg-red-500" :
                      riskProfile.overallRisk >= 31 ? "bg-yellow-500" : "bg-green-500"
                    }`} style={{ width: `${riskProfile.overallRisk}%` }} />
                  </div>
                </div>

                {/* Primary Risk Drivers */}
                <div className="bg-card border border-border p-5 rounded-xl shadow-sm md:col-span-3 space-y-3">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-accent" /> Active Trajectory Warning Center
                  </h4>
                  <div className="min-h-[70px] flex flex-wrap gap-2.5 items-center">
                    {riskProfile.activeWarnings.length === 0 ? (
                      <div className="p-3 bg-green-500/5 text-green-600 border border-green-500/10 rounded-xl text-xs flex items-center gap-2 w-full">
                        <Shield className="w-4 h-4" />
                        <span>All trajectory threat parameters are within safe thresholds. No warning interventions required.</span>
                      </div>
                    ) : (
                      riskProfile.activeWarnings.map((warn: string, idx: number) => (
                        <div key={idx} className="flex items-center gap-1.5 px-3.5 py-1.5 bg-red-500/10 text-red-500 border border-red-500/20 rounded-lg text-xs font-bold font-mono">
                          <AlertOctagon className="w-3.5 h-3.5 text-red-500" />
                          {warn}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Threat Matrix Heatmap / Distribution */}
              <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Horizontal Threat Matrix chart */}
                <div className="lg:col-span-8 bg-card border border-border p-5 rounded-xl shadow-sm flex flex-col space-y-4">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Deterministic Threat Dimensions (Heatmap)
                  </h4>
                  
                  {/* Heatmap Layout */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {[
                      { key: "Burnout", val: riskProfile.burnoutRisk?.score || 0, label: "Burnout Risk" },
                      { key: "Goal Drift", val: riskProfile.goalDriftRisk?.score || 0, label: "Goal Drift" },
                      { key: "Deadline", val: riskProfile.deadlineRisk?.score || 0, label: "Deadline Risk" },
                      { key: "Consistency", val: riskProfile.consistencyRisk?.score || 0, label: "Consistency" },
                      { key: "Execution", val: riskProfile.executionRisk?.score || 0, label: "Execution" },
                      { key: "Schedule", val: riskProfile.scheduleRisk?.score || 0, label: "Schedule Match" },
                      { key: "Calendar", val: riskProfile.calendarRisk?.score || 0, label: "Calendar Sync" },
                      { key: "Abandonment", val: riskProfile.abandonmentRisk?.score || 0, label: "Abandonment" }
                    ].map((metric) => {
                      const score = metric.val;
                      return (
                        <div key={metric.key} className="border border-border/80 p-3.5 rounded-xl bg-secondary/15 flex flex-col justify-between gap-3 text-xs">
                          <span className="text-muted-foreground font-semibold">{metric.label}</span>
                          <div className="flex justify-between items-center mt-1">
                            <span className="font-mono text-xl font-black">{score}%</span>
                            <span className={`px-2 py-0.5 rounded text-[8px] font-mono font-bold ${
                              score >= 81 ? "bg-red-950 text-red-200" :
                              score >= 61 ? "bg-orange-950 text-orange-200" :
                              score >= 31 ? "bg-yellow-950 text-yellow-200" :
                              "bg-green-950 text-green-200"
                            }`}>
                              {score >= 81 ? "Critical" :
                               score >= 61 ? "High" :
                               score >= 31 ? "Moderate" : "Low"}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Vertical Distribution view */}
                <div className="lg:col-span-4 bg-card border border-border p-5 rounded-xl shadow-sm flex flex-col space-y-4">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <BarChart3 className="w-4 h-4 text-accent" /> Prediction-Risk Alignment Links
                  </h4>
                  <div className="space-y-3.5 text-xs flex-grow justify-center flex flex-col">
                    <div className="bg-secondary/20 p-3.5 rounded-lg border border-border/40">
                      <span className="text-[10px] text-muted-foreground block uppercase font-bold">Prediction Anchor</span>
                      <p className="font-semibold text-foreground mt-1">
                        Finish roadmap in approx. ~{predictionProfile?.completionForecast?.estimatedRemainingDays || "N/A"} days
                      </p>
                    </div>
                    
                    <div className="flex items-center justify-center py-1">
                      <div className="h-6 w-0.5 bg-accent/40 border-dashed border-l" />
                    </div>

                    <div className="bg-secondary/20 p-3.5 rounded-lg border border-border/40">
                      <span className="text-[10px] text-muted-foreground block uppercase font-bold">Aligned Deadline Threat</span>
                      <div className="flex justify-between items-center mt-1">
                        <span className="font-semibold text-foreground">Capacity / Deadline Risk</span>
                        <span className="font-black text-red-500 font-mono text-sm">{riskProfile.deadlineRisk?.score || 0}%</span>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* Timeline Trend & Event log */}
              <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* SVG Risk Timeline Plot */}
                <div className="lg:col-span-8 bg-card border border-border p-5 rounded-xl shadow-sm flex flex-col space-y-4">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <LineChart className="w-4 h-4 text-accent" /> Historical Risk Evolution (7d/30d)
                  </h4>
                  {(() => {
                    const pts = riskProfile.rollingRisk || [];
                    const maxVal = 100;
                    const minVal = 0;
                    const range = 100;

                    const width = 500;
                    const height = 120;

                    const overallPoints = pts.map((p: any, idx: number) => {
                      const x = pts.length > 1 ? (idx / (pts.length - 1)) * (width - 40) + 20 : width / 2;
                      const y = height - 20 - ((p.overallRisk - minVal) / range) * (height - 40);
                      return `${x},${y}`;
                    }).join(" ");

                    const burnoutPoints = pts.map((p: any, idx: number) => {
                      const x = pts.length > 1 ? (idx / (pts.length - 1)) * (width - 40) + 20 : width / 2;
                      const y = height - 20 - ((p.burnoutRisk - minVal) / range) * (height - 40);
                      return `${x},${y}`;
                    }).join(" ");

                    return (
                      <div className="w-full bg-secondary/10 p-4 rounded-xl border border-border/50">
                        {pts.length < 2 ? (
                          <div className="h-[100px] flex items-center justify-center text-xs text-muted-foreground">
                            Insufficient rolling risk timeline points. Perform actions to plot trend.
                          </div>
                        ) : (
                          <svg className="w-full overflow-visible" height={height} viewBox={`0 0 ${width} ${height}`}>
                            {/* Gridlines */}
                            {[0, 0.5, 1].map((val: number, i: number) => {
                              const y = height - 20 - val * (height - 40);
                              return (
                                <g key={i} className="opacity-40">
                                  <line x1="20" y1={y} x2={width - 20} y2={y} className="stroke-border stroke-1 stroke-dashed" />
                                  <text x="5" y={y + 3} className="text-[8px] font-mono fill-muted-foreground">{Math.round(val * 100)}%</text>
                                </g>
                              );
                            })}
                            
                            {/* Burnout Sparkline */}
                            <polyline
                              points={burnoutPoints}
                              className="fill-none stroke-red-500/40 stroke-1.5"
                            />

                            {/* Overall Risk Sparkline */}
                            <polyline
                              points={overallPoints}
                              className="fill-none stroke-accent stroke-2"
                            />
                            
                            {/* Overall Points */}
                            {pts.map((p: any, idx: number) => {
                              const x = (idx / (pts.length - 1)) * (width - 40) + 20;
                              const y = height - 20 - ((p.overallRisk - minVal) / range) * (height - 40);
                              return (
                                <circle
                                  key={idx}
                                  cx={x}
                                  cy={y}
                                  r="3.5"
                                  className="fill-accent stroke-background stroke-2 hover:r-4 cursor-pointer"
                                />
                              );
                            })}
                          </svg>
                        )}
                        <div className="text-[9px] text-muted-foreground flex justify-between px-1 mt-2">
                          <div className="flex gap-4">
                            <span className="flex items-center gap-1"><span className="w-2 h-2 bg-accent rounded-full" /> Overall Threat</span>
                            <span className="flex items-center gap-1"><span className="w-2 h-2 bg-red-500/40 rounded-full" /> Burnout Factor</span>
                          </div>
                          <span>Rolling Timeline</span>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Risk Events timeline */}
                <div className="lg:col-span-4 bg-card border border-border p-5 rounded-xl shadow-sm flex flex-col">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-1.5">
                    <History className="w-4 h-4 text-accent" /> Recent Threat Shift Events
                  </h4>
                  <div className="flex-grow max-h-[160px] overflow-y-auto space-y-3.5 pr-1 scrollbar-custom">
                    {riskEvents.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-6">
                        No risk transition events logged.
                      </p>
                    ) : (
                      riskEvents.map((evt: any, idx: number) => (
                        <div key={idx} className="flex gap-2 items-start border-b border-border/40 pb-2.5 last:border-0 last:pb-0 text-xs">
                          <div className={`p-1 rounded-full mt-0.5 ${
                            evt.severity === "Critical" ? "bg-red-500/20 text-red-500" :
                            evt.severity === "High" ? "bg-orange-500/10 text-orange-500" :
                            "bg-yellow-500/10 text-yellow-600"
                          }`}>
                            <AlertCircle className="w-3 h-3" />
                          </div>
                          <div className="space-y-0.5">
                            <div className="font-bold text-foreground flex items-center gap-1.5 flex-wrap">
                              <span className="capitalize">{evt.riskType} Risk Shift</span>
                              <span className="text-[8px] text-muted-foreground font-normal">
                                {new Date(evt.timestamp).toLocaleString()}
                              </span>
                            </div>
                            <p className="text-[10px] text-muted-foreground leading-snug">{evt.reason}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </section>

              {/* Explainable Evidence Explorer */}
              <section className="bg-card border border-border p-5 rounded-xl shadow-sm">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-1.5">
                  <Search className="w-4 h-4 text-accent" /> Explainable Risk Heuristic Evidence
                </h4>
                <div className="space-y-2.5">
                  {[
                    { key: "burnout", label: "Burnout Risk Heuristic Details", data: riskProfile.burnoutRisk },
                    { key: "drift", label: "Goal Drift Heuristic Details", data: riskProfile.goalDriftRisk },
                    { key: "deadline", label: "Deadline Risk Heuristic Details", data: riskProfile.deadlineRisk },
                    { key: "consistency", label: "Consistency Collapse Heuristic Details", data: riskProfile.consistencyRisk },
                    { key: "execution", label: "Execution Capacity Heuristic Details", data: riskProfile.executionRisk },
                    { key: "schedule", label: "Schedule Mismatch Heuristic Details", data: riskProfile.scheduleRisk },
                    { key: "calendar", label: "Calendar Alignment Heuristic Details", data: riskProfile.calendarRisk },
                    { key: "abandonment", label: "Abandonment Heuristic Details", data: riskProfile.abandonmentRisk }
                  ].map((exp) => {
                    const isExpanded = expandedRiskEvidence === exp.key;
                    const score = exp.data?.score || 0;
                    return (
                      <div key={exp.key} className="border border-border/60 rounded-lg overflow-hidden">
                        <button
                          onClick={() => setExpandedRiskEvidence(isExpanded ? null : exp.key)}
                          className="w-full bg-secondary/20 hover:bg-secondary/40 px-3.5 py-2.5 flex justify-between items-center text-xs font-semibold transition cursor-pointer text-left"
                        >
                          <span className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${
                              score >= 81 ? "bg-red-500" :
                              score >= 61 ? "bg-orange-500" :
                              score >= 31 ? "bg-yellow-500" : "bg-green-500"
                            }`} />
                            {exp.label}
                          </span>
                          <span className="text-muted-foreground flex items-center gap-1.5 font-mono text-[10px]">
                            {score}% (Conf: {exp.data?.confidence || 100}%)
                            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          </span>
                        </button>
                        {isExpanded && (
                          <div className="p-3 bg-secondary/10 border-t border-border/50 text-[10px] text-muted-foreground space-y-1.5 leading-relaxed font-mono">
                            {(!exp.data?.evidence || exp.data.evidence.length === 0) ? (
                              <div className="italic">No evidence recorded for this heuristic.</div>
                            ) : (
                              exp.data.evidence.map((line: string, i: number) => (
                                <div key={i} className="pl-1 text-foreground/95">{line}</div>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* Footer metadata */}
              <div className="text-[10px] text-muted-foreground flex justify-between px-1 border-t border-border/30 pt-3">
                <span>Engine Version: 1.0.0</span>
                <span>Last Computed: {new Date(riskProfile.lastUpdated).toLocaleString()}</span>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* 8. ADAPTIVE INTELLIGENCE VIEW */
        <div className="space-y-6 flex-grow flex flex-col min-h-0">
          {/* Header controls */}
          <div className="bg-card border border-border p-5 rounded-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="space-y-1">
              <h3 className="text-sm font-semibold flex items-center gap-1.5 text-foreground">
                <Cpu className="w-4 h-4 text-accent animate-pulse" /> Adaptive Cognition Engine
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Observe long-term behavioral adaptation policies, Motivation style drivers, and gradual safety tier adjustments.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <select
                value={selectedUserForAdaptive}
                onChange={(e) => setSelectedUserForAdaptive(e.target.value)}
                className="bg-secondary border border-border px-3 py-1.5 rounded text-xs font-semibold"
              >
                {dashboardUsers.map((user) => (
                  <option key={user.firebaseUid} value={user.firebaseUid}>
                    {user.name} ({user.email})
                  </option>
                ))}
              </select>

              <button
                onClick={handleRecalculateAdaptive}
                disabled={isRecalculatingAdaptive || !selectedUserForAdaptive}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-accent hover:bg-accent/80 text-white rounded text-xs font-semibold transition disabled:opacity-50 cursor-pointer"
              >
                {isRecalculatingAdaptive ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Calibrating...
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

          {adaptiveError && (
            <div className="p-4 rounded-xl border border-destructive/20 bg-destructive/10 text-destructive text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              <span>{adaptiveError}</span>
            </div>
          )}

          {isLoadingAdaptive ? (
            <div className="flex-grow flex items-center justify-center py-20">
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="w-8 h-8 animate-spin text-accent" />
                <span className="text-xs text-muted-foreground">Evaluating Adaptive Policy...</span>
              </div>
            </div>
          ) : !adaptivePolicy ? (
            <div className="bg-card border border-border p-10 rounded-xl text-center">
              <Cpu className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm font-semibold text-foreground">No Adaptive Policy Found</p>
              <p className="text-xs text-muted-foreground mt-1">
                Please click "Force Recalculate" above to initialize adaptive policies for this user.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Upper Overview Grid */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Overall Adaptation Confidence */}
                <div className="bg-card border border-border p-5 rounded-xl shadow-sm space-y-3 relative overflow-hidden flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-accent" />
                      <span>Policy Adaptability Confidence</span>
                    </div>
                    <div>
                      <p className="text-3xl font-extrabold text-foreground">
                        {Math.round(adaptivePolicy.confidence * 100)}%
                      </p>
                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold mt-1.5 ${
                        adaptivePolicy.confidence >= 0.80 ? "bg-green-500/10 text-green-500 border border-green-500/20" :
                        adaptivePolicy.confidence >= 0.60 ? "bg-yellow-500/10 text-yellow-600 border border-yellow-500/20" :
                        "bg-red-500/10 text-red-500 border border-red-500/20"
                      }`}>
                        {adaptivePolicy.confidence >= 0.80 ? "TIER 3 (FULL ADAPTATION)" :
                         adaptivePolicy.confidence >= 0.60 ? "TIER 2 (SOFT ADAPTATIONS ONLY)" :
                         "TIER 1 (OBSERVE ONLY - DEFAULTS APPLIED)"}
                      </span>
                    </div>
                  </div>
                  <div className="w-full bg-secondary h-1.5 rounded-full overflow-hidden mt-3">
                    <div className={`h-full rounded-full ${
                      adaptivePolicy.confidence >= 0.80 ? "bg-green-500" :
                      adaptivePolicy.confidence >= 0.60 ? "bg-yellow-500" : "bg-red-500"
                    }`} style={{ width: `${adaptivePolicy.confidence * 100}%` }} />
                  </div>
                </div>

                {/* Simulation Control Panel */}
                <div className="bg-card border border-border p-5 rounded-xl shadow-sm md:col-span-3 space-y-4">
                  <div className="flex justify-between items-center border-b border-border/40 pb-2">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Terminal className="w-4 h-4 text-accent" /> Developer Scenario Simulation Panel
                    </h4>
                    {isSimulatingScenario && (
                      <span className="text-[10px] text-accent animate-pulse font-mono flex items-center gap-1">
                        <Loader2 className="w-3 h-3 animate-spin" /> Simulating 30 days...
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2.5">
                    {[
                      { type: "burnout", label: "🔥 30d High Burnout" },
                      { type: "night_owl", label: "🦉 30d Night Owl" },
                      { type: "low_consistency", label: "📉 30d Low Consistency" },
                      { type: "morning_user", label: "🌅 30d Morning User" },
                      { type: "high_productivity", label: "⚡ 30d High Productivity" },
                      { type: "student", label: "🎓 Student Profile" },
                      { type: "professional", label: "💼 Working Professional" }
                    ].map((scen) => (
                      <button
                        key={scen.type}
                        onClick={() => handleSimulateScenario(scen.type)}
                        disabled={isSimulatingScenario}
                        className="px-3 py-1.5 bg-secondary hover:bg-muted text-secondary-foreground rounded border border-border text-[11px] font-semibold transition cursor-pointer disabled:opacity-50"
                      >
                        {scen.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Categorized Policy Adaptations Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Category 1: Planning & Roadmap */}
                <div className="bg-card border border-border p-5 rounded-xl shadow-sm space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border/30 pb-2">
                    1. Planning & Roadmap Settings
                  </h4>
                  <div className="space-y-3 text-xs">
                    {[
                      { key: "planningAggressiveness", label: "Planning Aggressiveness" },
                      { key: "roadmapGranularity", label: "Roadmap Granularity" },
                      { key: "preferredPlanningDepth", label: "Planning Depth" },
                      { key: "preferredDeadlineBuffer", label: "Deadline Safety Buffer", suffix: " days" }
                    ].map((pref) => {
                      const data = adaptivePolicy.adaptations?.[pref.key];
                      return (
                        <div key={pref.key} className="flex justify-between items-center border-b border-border/30 pb-2.5 last:border-0 last:pb-0">
                          <div>
                            <span className="font-semibold block text-foreground">{pref.label}</span>
                            <span className="text-[10px] text-muted-foreground">Confidence: {Math.round(data?.confidence * 100)}%</span>
                          </div>
                          <span className="px-2.5 py-0.5 rounded font-mono font-bold bg-accent/10 text-accent capitalize">
                            {String(data?.value)}{(pref as any).suffix || ""}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Category 2: Work & Focus Blocks */}
                <div className="bg-card border border-border p-5 rounded-xl shadow-sm space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border/30 pb-2">
                    2. Work & Focus Window Calibrations
                  </h4>
                  <div className="space-y-3 text-xs">
                    {[
                      { key: "preferredWorkWindow", label: "Preferred Work Window" },
                      { key: "preferredFocusSessionLength", label: "Focus Session Length", suffix: " mins" },
                      { key: "preferredBreakDuration", label: "Break Duration", suffix: " mins" },
                      { key: "preferredTaskDuration", label: "Standard Task Scope", suffix: " mins" }
                    ].map((pref) => {
                      const data = adaptivePolicy.adaptations?.[pref.key];
                      return (
                        <div key={pref.key} className="flex justify-between items-center border-b border-border/30 pb-2.5 last:border-0 last:pb-0">
                          <div>
                            <span className="font-semibold block text-foreground">{pref.label}</span>
                            <span className="text-[10px] text-muted-foreground">Confidence: {Math.round(data?.confidence * 100)}%</span>
                          </div>
                          <span className="px-2.5 py-0.5 rounded font-mono font-bold bg-accent/10 text-accent capitalize">
                            {String(data?.value)}{(pref as any).suffix || ""}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Category 3: Execution & Calendar */}
                <div className="bg-card border border-border p-5 rounded-xl shadow-sm space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border/30 pb-2">
                    3. Agenda Density & Calendar Offsets
                  </h4>
                  <div className="space-y-3 text-xs">
                    {[
                      { key: "preferredAgendaDensity", label: "Agenda Task Density" },
                      { key: "executionStyle", label: "Execution Block Mode" },
                      { key: "calendarBufferMinutes", label: "Inter-task Sync Buffer", suffix: " mins" },
                      { key: "scheduleFlexibility", label: "Schedule Rigidity / Flexibility" }
                    ].map((pref) => {
                      const data = adaptivePolicy.adaptations?.[pref.key];
                      return (
                        <div key={pref.key} className="flex justify-between items-center border-b border-border/30 pb-2.5 last:border-0 last:pb-0">
                          <div>
                            <span className="font-semibold block text-foreground">{pref.label}</span>
                            <span className="text-[10px] text-muted-foreground">Confidence: {Math.round(data?.confidence * 100)}%</span>
                          </div>
                          <span className="px-2.5 py-0.5 rounded font-mono font-bold bg-accent/10 text-accent capitalize">
                            {String(data?.value)}{(pref as any).suffix || ""}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Category 4: Briefing & Companion Tone */}
                <div className="bg-card border border-border p-5 rounded-xl shadow-sm space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border/30 pb-2">
                    4. Briefs & Companion Adaptations
                  </h4>
                  <div className="space-y-3 text-xs">
                    {[
                      { key: "preferredBriefStyle", label: "Morning/Evening Brief Length" },
                      { key: "preferredReflectionLength", label: "Daily Reflection length" },
                      { key: "preferredCompanionTone", label: "Companion Response Style" },
                      { key: "motivationStyle", label: "Primary Motivational Driver" }
                    ].map((pref) => {
                      const data = adaptivePolicy.adaptations?.[pref.key];
                      return (
                        <div key={pref.key} className="flex justify-between items-center border-b border-border/30 pb-2.5 last:border-0 last:pb-0">
                          <div>
                            <span className="font-semibold block text-foreground">{pref.label}</span>
                            <span className="text-[10px] text-muted-foreground">Confidence: {Math.round(data?.confidence * 100)}%</span>
                          </div>
                          <span className="px-2.5 py-0.5 rounded font-mono font-bold bg-accent/10 text-accent capitalize">
                            {String(data?.value)}{(pref as any).suffix || ""}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Policy Evolution and Explainable Evidence Accordions */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* Evolution timeline */}
                <div className="lg:col-span-6 bg-card border border-border p-5 rounded-xl shadow-sm flex flex-col">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-1.5">
                    <History className="w-4 h-4 text-accent" /> Policy Modification History
                  </h4>
                  <div className="flex-grow max-h-[300px] overflow-y-auto space-y-4 pr-1 scrollbar-custom">
                    {!adaptivePolicy.history || adaptivePolicy.history.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-10">
                        No adaptive policy adjustments have been logged yet.
                      </p>
                    ) : (
                      adaptivePolicy.history.map((evt: any, idx: number) => (
                        <div key={idx} className="flex gap-3 items-start border-b border-border/40 pb-3 last:border-0 last:pb-0">
                          <div className="p-1 rounded-full bg-accent/15 text-accent mt-0.5">
                            <History className="w-3.5 h-3.5" />
                          </div>
                          <div className="space-y-1">
                            <div className="text-[11px] font-bold text-foreground flex items-center gap-1.5 flex-wrap">
                              <span className="capitalize">{evt.adaptationKey.replace(/([A-Z])/g, " $1")}</span>
                              <span className="text-[9px] text-muted-foreground font-normal">
                                {new Date(evt.timestamp).toLocaleString()}
                              </span>
                            </div>
                            <p className="text-[11px] text-muted-foreground leading-relaxed">{evt.reason}</p>
                            <div className="text-[9px] text-muted-foreground font-mono flex gap-4 pt-0.5">
                              <span>Before: {String(evt.oldValue)}</span>
                              <span>After: {String(evt.newValue)}</span>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Evidence Explorer */}
                <div className="lg:col-span-6 bg-card border border-border p-5 rounded-xl shadow-sm flex flex-col">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-1.5">
                    <Search className="w-4 h-4 text-accent" /> Explainable Adaptive Reasoning
                  </h4>
                  <div className="space-y-2.5 flex-grow overflow-y-auto max-h-[300px] pr-1 scrollbar-custom">
                    {Object.keys(adaptivePolicy.adaptations || {}).map((key) => {
                      const isExpanded = expandedAdaptationKey === key;
                      const pref = (adaptivePolicy.adaptations as any)[key];
                      const reason = adaptivePolicy.reasoning?.[key] || "Adaptation derived from longitudinal behavior snapshots.";
                      return (
                        <div key={key} className="border border-border/60 rounded-lg overflow-hidden">
                          <button
                            onClick={() => setExpandedAdaptationKey(isExpanded ? null : key)}
                            className="w-full bg-secondary/20 hover:bg-secondary/40 px-3.5 py-2.5 flex justify-between items-center text-xs font-semibold transition cursor-pointer text-left"
                          >
                            <span className="flex items-center gap-2">
                              <span className={`w-2 h-2 rounded-full ${
                                pref.confidence >= 0.80 ? "bg-green-500" :
                                pref.confidence >= 0.60 ? "bg-yellow-500" : "bg-red-500"
                              }`} />
                              <span className="capitalize">{key.replace(/([A-Z])/g, " $1")}</span>
                            </span>
                            <span className="text-muted-foreground flex items-center gap-1.5 font-mono text-[10px]">
                              {Math.round(pref.confidence * 100)}%
                              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            </span>
                          </button>
                          {isExpanded && (
                            <div className="p-3 bg-secondary/10 border-t border-border/50 text-[10px] text-muted-foreground space-y-1.5 leading-relaxed font-mono">
                              <div className="text-foreground/95">{reason}</div>
                              <div className="text-[9px] text-muted-foreground/60 pt-1">
                                Drivers: {pref.derivedFrom?.join(", ")}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Footer metadata */}
              <div className="text-[10px] text-muted-foreground flex justify-between px-1 border-t border-border/30 pt-3">
                <span>Engine Version: 1.0.0</span>
                <span>Last Computed: {new Date(adaptivePolicy.updatedAt).toLocaleString()}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
