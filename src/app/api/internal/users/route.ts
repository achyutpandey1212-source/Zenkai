import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { dbConnect } from "@/lib/db";
import { adminAuth } from "@/lib/firebaseAdmin";
import mongoose from "mongoose";

// Import all 23 models
import { User } from "@/models/User";
import { Profile } from "@/models/Profile";
import { Memory } from "@/models/Memory";
import { IdentityProposal } from "@/models/IdentityProposal";
import { IdentityTrait } from "@/models/IdentityTrait";
import { Reflection } from "@/models/Reflection";
import { Plan } from "@/models/Plan";
import { Milestone } from "@/models/Milestone";
import { Goal } from "@/models/Goal";
import { Task } from "@/models/Task";
import { WeeklyExecutionSchedule } from "@/models/WeeklyExecutionSchedule";
import { BehaviorProfile } from "@/models/BehaviorProfile";
import { BriefingLog } from "@/models/BriefingLog";
import { CalendarSyncLog } from "@/models/CalendarSyncLog";
import { AdaptivePolicy } from "@/models/AdaptivePolicy";
import { ConsistencyEvent } from "@/models/ConsistencyEvent";
import { ConsistencyProfile } from "@/models/ConsistencyProfile";
import { PredictionEvent } from "@/models/PredictionEvent";
import { PredictionProfile } from "@/models/PredictionProfile";
import { RiskEvent } from "@/models/RiskEvent";
import { RiskProfile } from "@/models/RiskProfile";
import { Conversation } from "@/models/Conversation";
import { Message } from "@/models/Message";

export const dynamic = "force-dynamic";

// Authentication middleware helper
async function isAuthenticated() {
  const cookieStore = await cookies();
  const internalSession = cookieStore.get("internal_session")?.value;
  const adminKey = process.env.INTERNAL_ADMIN_KEY;

  if (!adminKey || !internalSession || internalSession !== adminKey) {
    return false;
  }
  return true;
}

export async function GET() {
  try {
    if (!(await isAuthenticated())) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();

    // Fetch all users sorted by creation date
    const users = await User.find({}).sort({ createdAt: -1 }).lean();

    const userList = await Promise.all(
      users.map(async (user) => {
        // Query active plan for this user
        const activePlan = await Plan.findOne({
          firebaseUid: user.firebaseUid,
          status: "active",
        })
          .select("title")
          .lean();

        // Query memory count
        const memoryCount = await Memory.countDocuments({
          firebaseUid: user.firebaseUid,
        });

        return {
          uid: user.firebaseUid,
          name: user.name,
          email: user.email,
          createdAt: user.createdAt,
          googleConnected: user.googleCalendarSettings?.connected || false,
          activePlan: activePlan?.title || "None",
          memoryCount,
        };
      })
    );

    return NextResponse.json({ success: true, users: userList });
  } catch (error: any) {
    console.error("GET /api/internal/users error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    if (!(await isAuthenticated())) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { uid } = await request.json();

    if (!uid) {
      return NextResponse.json({ success: false, error: "Missing user UID" }, { status: 400 });
    }

    await dbConnect();

    // Attempt Firebase Auth deletion first (if Admin SDK is initialized)
    let firebaseDeleted = false;
    let firebaseErrorMsg = "";
    if (adminAuth) {
      try {
        await adminAuth.deleteUser(uid);
        firebaseDeleted = true;
      } catch (err: any) {
        console.error(`Firebase Auth deletion failed for UID ${uid}:`, err);
        firebaseErrorMsg = err.message || "Firebase delete error";
      }
    } else {
      console.warn("Firebase Admin Auth not initialized; skipping Firebase Auth deletion.");
      firebaseErrorMsg = "Firebase Admin Auth not initialized";
    }

    // Perform database wipe across all 23 collections
    let transactionExecuted = false;
    let deletedCounts: Record<string, number> = {};

    try {
      const session = await mongoose.startSession();
      try {
        session.startTransaction();

        // Collect conversation IDs to delete their messages
        const conversations = await Conversation.find({ firebaseUid: uid }, null, { session });
        const conversationIds = conversations.map((c) => c._id);

        deletedCounts = {
          users: (await User.deleteOne({ firebaseUid: uid }, { session })).deletedCount,
          profiles: (await Profile.deleteOne({ firebaseUid: uid }, { session })).deletedCount,
          memories: (await Memory.deleteMany({ firebaseUid: uid }, { session })).deletedCount,
          identityProposals: (await IdentityProposal.deleteMany({ firebaseUid: uid }, { session })).deletedCount,
          identityTraits: (await IdentityTrait.deleteMany({ firebaseUid: uid }, { session })).deletedCount,
          reflections: (await Reflection.deleteMany({ firebaseUid: uid }, { session })).deletedCount,
          plans: (await Plan.deleteMany({ firebaseUid: uid }, { session })).deletedCount,
          milestones: (await Milestone.deleteMany({ firebaseUid: uid }, { session })).deletedCount,
          goals: (await Goal.deleteMany({ firebaseUid: uid }, { session })).deletedCount,
          tasks: (await Task.deleteMany({ firebaseUid: uid }, { session })).deletedCount,
          weeklyExecutionSchedules: (await WeeklyExecutionSchedule.deleteMany({ firebaseUid: uid }, { session })).deletedCount,
          behaviorProfiles: (await BehaviorProfile.deleteOne({ uid }, { session })).deletedCount,
          briefingLogs: (await BriefingLog.deleteMany({ uid }, { session })).deletedCount,
          calendarSyncLogs: (await CalendarSyncLog.deleteMany({ uid }, { session })).deletedCount,
          adaptivePolicies: (await AdaptivePolicy.deleteOne({ uid }, { session })).deletedCount,
          consistencyEvents: (await ConsistencyEvent.deleteMany({ uid }, { session })).deletedCount,
          consistencyProfiles: (await ConsistencyProfile.deleteOne({ uid }, { session })).deletedCount,
          predictionEvents: (await PredictionEvent.deleteMany({ uid }, { session })).deletedCount,
          predictionProfiles: (await PredictionProfile.deleteOne({ uid }, { session })).deletedCount,
          riskEvents: (await RiskEvent.deleteMany({ uid }, { session })).deletedCount,
          riskProfiles: (await RiskProfile.deleteOne({ uid }, { session })).deletedCount,
          messages: conversationIds.length > 0 
            ? (await Message.deleteMany({ conversationId: { $in: conversationIds } }, { session })).deletedCount 
            : 0,
          conversations: (await Conversation.deleteMany({ firebaseUid: uid }, { session })).deletedCount,
        };

        await session.commitTransaction();
        transactionExecuted = true;
      } catch (err) {
        await session.abortTransaction();
        throw err;
      } finally {
        session.endSession();
      }
    } catch (txError: any) {
      console.warn(
        `MongoDB transaction failed or unsupported: ${txError.message}. Falling back to sequential execution.`
      );

      if (transactionExecuted) {
        throw txError; // If transaction failed after commit, rethrow
      }

      // Sequential fallback
      const conversations = await Conversation.find({ firebaseUid: uid });
      const conversationIds = conversations.map((c) => c._id);

      deletedCounts = {
        users: (await User.deleteOne({ firebaseUid: uid })).deletedCount,
        profiles: (await Profile.deleteOne({ firebaseUid: uid })).deletedCount,
        memories: (await Memory.deleteMany({ firebaseUid: uid })).deletedCount,
        identityProposals: (await IdentityProposal.deleteMany({ firebaseUid: uid })).deletedCount,
        identityTraits: (await IdentityTrait.deleteMany({ firebaseUid: uid })).deletedCount,
        reflections: (await Reflection.deleteMany({ firebaseUid: uid })).deletedCount,
        plans: (await Plan.deleteMany({ firebaseUid: uid })).deletedCount,
        milestones: (await Milestone.deleteMany({ firebaseUid: uid })).deletedCount,
        goals: (await Goal.deleteMany({ firebaseUid: uid })).deletedCount,
        tasks: (await Task.deleteMany({ firebaseUid: uid })).deletedCount,
        weeklyExecutionSchedules: (await WeeklyExecutionSchedule.deleteMany({ firebaseUid: uid })).deletedCount,
        behaviorProfiles: (await BehaviorProfile.deleteOne({ uid })).deletedCount,
        briefingLogs: (await BriefingLog.deleteMany({ uid })).deletedCount,
        calendarSyncLogs: (await CalendarSyncLog.deleteMany({ uid })).deletedCount,
        adaptivePolicies: (await AdaptivePolicy.deleteOne({ uid })).deletedCount,
        consistencyEvents: (await ConsistencyEvent.deleteMany({ uid })).deletedCount,
        consistencyProfiles: (await ConsistencyProfile.deleteOne({ uid })).deletedCount,
        predictionEvents: (await PredictionEvent.deleteMany({ uid })).deletedCount,
        predictionProfiles: (await PredictionProfile.deleteOne({ uid })).deletedCount,
        riskEvents: (await RiskEvent.deleteMany({ uid })).deletedCount,
        riskProfiles: (await RiskProfile.deleteOne({ uid })).deletedCount,
        messages: conversationIds.length > 0 
          ? (await Message.deleteMany({ conversationId: { $in: conversationIds } })).deletedCount 
          : 0,
        conversations: (await Conversation.deleteMany({ firebaseUid: uid })).deletedCount,
      };
    }

    // Log the deletion to stdout
    const logDetails = Object.entries(deletedCounts)
      .filter(([_, count]) => count > 0)
      .map(([col, count]) => `${col}: ${count}`)
      .join(", ");

    console.log(
      `[ADMIN AUDIT] User permanent deletion successful. UID: ${uid}. Firebase Auth deleted: ${firebaseDeleted} (${
        firebaseDeleted ? "success" : firebaseErrorMsg
      }). Database clean counts: { ${logDetails || "None"} }`
    );

    return NextResponse.json({
      success: true,
      firebaseDeleted,
      firebaseError: firebaseDeleted ? null : firebaseErrorMsg,
      transactionExecuted,
      deletedCounts,
    });
  } catch (error: any) {
    console.error("DELETE /api/internal/users error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
