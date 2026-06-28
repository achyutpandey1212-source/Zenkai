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
import { CalendarSyncLog } from "@/models/CalendarSyncLog";
import { CalendarSyncService } from "@/services/calendar-sync.service";
import { DailyAgendaRepository } from "@/repositories/daily-agenda.repository";

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

export async function getCalendarSyncLogs() {
  await dbConnect();
  try {
    const logs = await CalendarSyncLog.find({})
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    return JSON.parse(JSON.stringify(logs));
  } catch (err) {
    console.error("Error in getCalendarSyncLogs action:", err);
    return [];
  }
}

export async function getCalendarStats() {
  await dbConnect();
  try {
    const connectedUsers = await User.countDocuments({ "googleCalendarSettings.connected": true });
    
    // Aggregate log metrics
    const statsResult = await CalendarSyncLog.aggregate([
      {
        $group: {
          _id: null,
          totalCreated: { $sum: "$eventsCreated" },
          totalUpdated: { $sum: "$eventsUpdated" },
          totalDeleted: { $sum: "$eventsDeleted" },
          totalSkipped: { $sum: "$eventsSkipped" },
          totalRequests: { $sum: "$googleRequests" },
          avgDuration: { $avg: "$duration" },
          failures: { $sum: { $cond: [{ $eq: ["$status", "failure"] }, 1, 0] } }
        }
      }
    ]);

    const lastLog = await CalendarSyncLog.findOne({}).sort({ createdAt: -1 }).lean();

    const stats = statsResult[0] || {
      totalCreated: 0,
      totalUpdated: 0,
      totalDeleted: 0,
      totalSkipped: 0,
      totalRequests: 0,
      avgDuration: 0,
      failures: 0
    };

    return {
      connectedUsers,
      eventsCreated: stats.totalCreated,
      eventsUpdated: stats.totalUpdated,
      eventsDeleted: stats.totalDeleted,
      eventsSkipped: stats.totalSkipped,
      googleRequests: stats.totalRequests,
      avgDuration: Math.round(stats.avgDuration || 0),
      failures: stats.failures,
      lastSync: lastLog ? lastLog.createdAt : null
    };
  } catch (err) {
    console.error("Error in getCalendarStats action:", err);
    return {
      connectedUsers: 0,
      eventsCreated: 0,
      eventsUpdated: 0,
      eventsDeleted: 0,
      eventsSkipped: 0,
      googleRequests: 0,
      avgDuration: 0,
      failures: 0,
      lastSync: null
    };
  }
}

export async function triggerManualCalendarSync(uid: string) {
  await dbConnect();
  try {
    const user = await User.findOne({ firebaseUid: uid }).lean();
    if (!user) {
      return { success: false, error: "User not found" };
    }

    if (!user.googleCalendarSettings?.connected) {
      return { success: false, error: "User Google Calendar is not connected" };
    }

    const timezone = user.briefSettings?.timezone || "UTC";
    const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: timezone });

    const agenda = await DailyAgendaRepository.findByUserAndDate(uid, todayStr);
    if (!agenda) {
      return { success: false, error: `No daily agenda exists for today (${todayStr}) to sync.` };
    }

    const result = await CalendarSyncService.syncAgenda(uid, agenda);
    
    if (!result.success) {
      return { success: false, error: result.error || "Sync execution failed" };
    }

    return { success: true, stats: result };
  } catch (err: any) {
    console.error("Error in triggerManualCalendarSync action:", err);
    return { success: false, error: err.message || "Unknown error" };
  }
}

// Behavior Intelligence Actions
import { BehaviorEngine } from "@/services/behavior-engine.service";
import { BehaviorProfile } from "@/models/BehaviorProfile";

export async function getBehaviorProfile(uid: string) {
  await dbConnect();
  try {
    const profile = await BehaviorEngine.getOrCreateProfile(uid);
    return JSON.parse(JSON.stringify(profile));
  } catch (err) {
    console.error("Error in getBehaviorProfile server action:", err);
    return null;
  }
}

export async function recalculateBehaviorProfile(uid: string) {
  await dbConnect();
  try {
    const profile = await BehaviorEngine.computeBehaviorProfile(uid);
    return { success: true, profile: JSON.parse(JSON.stringify(profile)) };
  } catch (err: any) {
    console.error("Error in recalculateBehaviorProfile server action:", err);
    return { success: false, error: err.message || "Unknown error" };
  }
}

export async function simulateBriefingOpen(logId: string) {
  await dbConnect();
  try {
    const log = await BriefingLog.findById(logId);
    if (!log) {
      return { success: false, error: "Briefing log not found" };
    }
    if (!log.opened) {
      log.opened = true;
      log.openedAt = new Date();
      await log.save();
      await BehaviorEngine.updateFromBriefing(log.uid, log.type, "opened");
    }
    return { success: true, message: `Successfully simulated open for briefing ${logId}` };
  } catch (err: any) {
    console.error("Error in simulateBriefingOpen server action:", err);
    return { success: false, error: err.message || "Unknown error" };
  }
}

// Consistency Intelligence Actions
import { ConsistencyEngine } from "@/services/consistency-engine.service";
import { ConsistencyProfile } from "@/models/ConsistencyProfile";
import { ConsistencyEvent } from "@/models/ConsistencyEvent";

export async function getConsistencyProfile(uid: string) {
  await dbConnect();
  try {
    const profile = await ConsistencyEngine.getOrCreateProfile(uid);
    return JSON.parse(JSON.stringify(profile));
  } catch (err) {
    console.error("Error in getConsistencyProfile server action:", err);
    return null;
  }
}

export async function recalculateConsistencyProfile(uid: string) {
  await dbConnect();
  try {
    const profile = await ConsistencyEngine.computeConsistencyProfile(uid);
    return { success: true, profile: JSON.parse(JSON.stringify(profile)) };
  } catch (err: any) {
    console.error("Error in recalculateConsistencyProfile server action:", err);
    return { success: false, error: err.message || "Unknown error" };
  }
}

export async function getConsistencyEvents(uid: string) {
  await dbConnect();
  try {
    const events = await ConsistencyEvent.find({ uid }).sort({ timestamp: -1 }).limit(30).lean();
    return JSON.parse(JSON.stringify(events));
  } catch (err) {
    console.error("Error in getConsistencyEvents server action:", err);
    return [];
  }
}

// Prediction Intelligence Actions
import { PredictionEngine } from "@/services/prediction-engine.service";
import { PredictionProfile } from "@/models/PredictionProfile";
import { PredictionEvent } from "@/models/PredictionEvent";

export async function getPredictionProfile(uid: string) {
  await dbConnect();
  try {
    const profile = await PredictionEngine.getOrCreateProfile(uid);
    return JSON.parse(JSON.stringify(profile));
  } catch (err) {
    console.error("Error in getPredictionProfile server action:", err);
    return null;
  }
}

export async function recalculatePredictionProfile(uid: string) {
  await dbConnect();
  try {
    const profile = await PredictionEngine.computePredictionProfile(uid);
    return { success: true, profile: JSON.parse(JSON.stringify(profile)) };
  } catch (err: any) {
    console.error("Error in recalculatePredictionProfile server action:", err);
    return { success: false, error: err.message || "Unknown error" };
  }
}

export async function getPredictionEvents(uid: string) {
  await dbConnect();
  try {
    const events = await PredictionEvent.find({ uid }).sort({ timestamp: -1 }).limit(30).lean();
    return JSON.parse(JSON.stringify(events));
  } catch (err) {
    console.error("Error in getPredictionEvents server action:", err);
    return [];
  }
}

// Risk Intelligence Actions
import { RiskEngine } from "@/services/risk-engine.service";
import { RiskProfile } from "@/models/RiskProfile";
import { RiskEvent } from "@/models/RiskEvent";

export async function getRiskProfile(uid: string) {
  await dbConnect();
  try {
    const profile = await RiskEngine.getOrCreateProfile(uid);
    return JSON.parse(JSON.stringify(profile));
  } catch (err) {
    console.error("Error in getRiskProfile server action:", err);
    return null;
  }
}

export async function recalculateRiskProfile(uid: string) {
  await dbConnect();
  try {
    const profile = await RiskEngine.computeRiskProfile(uid);
    return { success: true, profile: JSON.parse(JSON.stringify(profile)) };
  } catch (err: any) {
    console.error("Error in recalculateRiskProfile server action:", err);
    return { success: false, error: err.message || "Unknown error" };
  }
}

export async function getRiskEvents(uid: string) {
  await dbConnect();
  try {
    const events = await RiskEvent.find({ uid }).sort({ timestamp: -1 }).limit(30).lean();
    return JSON.parse(JSON.stringify(events));
  } catch (err) {
    console.error("Error in getRiskEvents server action:", err);
    return [];
  }
}






