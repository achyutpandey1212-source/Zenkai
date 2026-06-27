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

import { BriefingLog } from "@/models/BriefingLog";
import { User } from "@/models/User";
import { BriefComposerService } from "@/services/brief-composer.service";
import { EmailService } from "@/services/email.service";

export async function getBriefingLogs() {
  await dbConnect();
  try {
    const logs = await BriefingLog.find({})
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    return JSON.parse(JSON.stringify(logs));
  } catch (err) {
    console.error("Error in getBriefingLogs action:", err);
    return [];
  }
}

export async function getDashboardUsers() {
  await dbConnect();
  try {
    const users = await User.find({}).select("firebaseUid name email").lean();
    return JSON.parse(JSON.stringify(users));
  } catch (err) {
    console.error("Error in getDashboardUsers action:", err);
    return [];
  }
}

export async function triggerBriefing(uid: string, type: "morning" | "evening") {
  await dbConnect();
  try {
    const user = await User.findOne({ firebaseUid: uid }).lean();
    if (!user) {
      return { success: false, error: "User not found" };
    }

    if (type === "morning") {
      const brief = await BriefComposerService.composeMorningBrief(uid);
      await EmailService.sendMorningBrief(
        uid,
        brief.email,
        brief.data,
        brief.telemetry,
        brief.skipped
      );
      return { success: true, message: `Successfully sent morning brief to ${brief.email}` };
    } else {
      const brief = await BriefComposerService.composeEveningBrief(uid);
      await EmailService.sendEveningBrief(
        uid,
        brief.email,
        brief.data,
        brief.telemetry,
        brief.skipped
      );
      return { success: true, message: `Successfully sent evening brief to ${brief.email}` };
    }
  } catch (err: any) {
    console.error("Error in triggerBriefing action:", err);
    return { success: false, error: err.message || "Unknown error" };
  }
}

