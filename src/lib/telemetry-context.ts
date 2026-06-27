import { AsyncLocalStorage } from "node:async_hooks";

export interface AICall {
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

export interface WorkflowRunTelemetry {
  workflowId: string;
  aiCalls: AICall[];
  stateRef?: unknown;
}

export const telemetryStorage = new AsyncLocalStorage<WorkflowRunTelemetry>();

export class GlobalTelemetryTracker {
  private static callHistory: number[] = [];
  private static peakRpm = 0;

  static recordCall(): void {
    const now = Date.now();
    this.callHistory.push(now);
    this.cleanOldCalls();
    
    const currentRpm = this.getCurrentRpm();
    if (currentRpm > this.peakRpm) {
      this.peakRpm = currentRpm;
    }
  }

  static getCurrentRpm(): number {
    this.cleanOldCalls();
    const oneMinuteAgo = Date.now() - 60000;
    return this.callHistory.filter(t => t >= oneMinuteAgo).length;
  }

  static getPeakRpm(): number {
    const current = this.getCurrentRpm();
    if (current > this.peakRpm) {
      this.peakRpm = current;
    }
    return this.peakRpm;
  }

  private static cleanOldCalls(): void {
    const cutoff = Date.now() - 5 * 60 * 1000; // Keep last 5 minutes of calls
    this.callHistory = this.callHistory.filter(t => t >= cutoff);
  }
}
