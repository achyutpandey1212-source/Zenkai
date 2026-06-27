/**
 * Zenkai Graph Logger — Observability Utility
 *
 * Produces structured, workflowId-tagged log output for every node.
 * Fed automatically from node metadata — no node manually calls console.log.
 *
 * Format:
 *   [Graph][wf:abc123] Workflow started  uid=xyz
 *   [Graph][wf:abc123] → router (started)
 *   [Graph][wf:abc123] ✓ router (142ms) skipped=false
 *   [Graph][wf:abc123] ✗ planning (3200ms) Error: timeout
 *   [Graph][wf:abc123] ⊘ identity skipped: no memories
 *   [Graph][wf:abc123] Workflow complete | nodes=8 | errors=0 | total=6400ms
 */

import type { NodeMetadata } from "../graph/types";

// ─────────────────────────────────────────────────────────────────────────────
// Log level colours (production-safe prefix tags)
// ─────────────────────────────────────────────────────────────────────────────

const TAG = "[Graph]";

function wfTag(state: any): string {
  const wfId = state?.workflowId ?? "unknown";
  return `${TAG}[wf:${wfId.slice(0, 8)}]`;
}

// ─────────────────────────────────────────────────────────────────────────────
// GraphLogger
// ─────────────────────────────────────────────────────────────────────────────

export class GraphLogger {
  static workflowStarted(state: any): void {
    console.log(
      `${wfTag(state)} Workflow started | uid=${state.uid} | version=${state.workflowVersion} | graph=${state.graphVersion}`
    );
  }

  static workflowComplete(state: any): void {
    const nodeLog = (state.nodeLog as NodeMetadata[]) ?? [];
    const errors = (state.errors as unknown[]) ?? [];
    const total = Date.now() - ((state.startedAt as number) ?? Date.now());
    const succeeded = nodeLog.filter((n) => n.success && !n.skipped).length;
    const skipped = nodeLog.filter((n) => n.skipped).length;
    const failed = nodeLog.filter((n) => !n.success && !n.skipped).length;

    console.log(
      `${wfTag(state)} Workflow complete | nodes=${nodeLog.length} | ✓${succeeded} ⊘${skipped} ✗${failed} | errors=${errors.length} | total=${total}ms`
    );

    // Print full timeline for development
    if (process.env.NODE_ENV !== "production") {
      GraphLogger.printTimeline(state);
    }
  }

  static nodeStart(state: any, nodeName: string): void {
    console.log(`${wfTag(state)} → ${nodeName} (running)`);
  }

  static nodeComplete(state: any, nodeName: string, meta: NodeMetadata): void {
    if (meta.skipped) {
      console.log(`${wfTag(state)} ⊘ ${nodeName} skipped | reason: ${meta.reason ?? "routing decision"}`);
    } else if (meta.success) {
      console.log(`${wfTag(state)} ✓ ${nodeName} (${meta.duration}ms)`);
    }
  }

  static nodeError(
    state: any,
    nodeName: string,
    error: string,
    duration: number
  ): void {
    console.error(`${wfTag(state)} ✗ ${nodeName} (${duration}ms) | Error: ${error}`);
  }

  static warn(state: any, message: string): void {
    console.warn(`${wfTag(state)} ⚠ ${message}`);
  }

  static info(state: any, message: string): void {
    console.log(`${wfTag(state)} ℹ ${message}`);
  }

  /** Print a human-readable execution timeline after workflow completes */
  static printTimeline(state: any): void {
    const nodeLog = (state.nodeLog as NodeMetadata[]) ?? [];
    if (nodeLog.length === 0) return;

    console.log(`${wfTag(state)} ── Execution Timeline ─────────────────────`);
    for (const entry of nodeLog) {
      const icon = entry.skipped ? "⊘" : entry.success ? "✓" : "✗";
      const durationStr = entry.skipped ? "" : ` (${entry.duration}ms)`;
      const reasonStr = entry.reason ? ` | ${entry.reason}` : "";
      console.log(`${wfTag(state)}   ${icon} ${entry.nodeName}${durationStr}${reasonStr}`);
    }
    console.log(`${wfTag(state)} ──────────────────────────────────────────`);
  }
}
