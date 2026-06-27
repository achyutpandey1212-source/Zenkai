"use server";

// Trigger Next.js compilation reload
import { CheckpointManager } from "@/orchestration/utils/checkpoint";
import { GlobalTelemetryTracker } from "@/lib/telemetry-context";
import { dbConnect } from "@/lib/mongodb";

export async function getWorkflows() {
  await dbConnect();
  try {
    const rawList = await CheckpointManager.listRecentWorkflows();
    // Return serialisable plain objects
    return rawList.map((item) => ({
      workflowId: item.workflowId,
      workflowVersion: item.workflowVersion,
      graphVersion: item.graphVersion,
      afterNode: item.afterNode,
      checkpointedAt: item.checkpointedAt,
      snapshot: JSON.parse(JSON.stringify(item.snapshot)),
    }));
  } catch (err) {
    console.error("Error in getWorkflows action:", err);
    return [];
  }
}

export async function getWorkflowDetails(workflowId: string) {
  await dbConnect();
  try {
    const records = await CheckpointManager.findByWorkflowId(workflowId);
    return records.map((item) => ({
      workflowId: item.workflowId,
      afterNode: item.afterNode,
      checkpointedAt: item.checkpointedAt,
      snapshot: JSON.parse(JSON.stringify(item.snapshot)),
    }));
  } catch (err) {
    console.error(`Error in getWorkflowDetails action for ${workflowId}:`, err);
    return [];
  }
}

export async function getRpmTelemetry() {
  return {
    currentRpm: GlobalTelemetryTracker.getCurrentRpm(),
    peakRpm: GlobalTelemetryTracker.getPeakRpm(),
  };
}
