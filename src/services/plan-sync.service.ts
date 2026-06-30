import { dbConnect } from "@/lib/mongodb";
import { Plan } from "@/models/Plan";
import { Milestone } from "@/models/Milestone";
import { Goal } from "@/models/Goal";
import { Task } from "@/models/Task";
import { User } from "@/models/User";
import { WeeklyExecutionSchedule } from "@/models/WeeklyExecutionSchedule";
import { BehaviorEngine } from "@/services/behavior-engine.service";
import { Types } from "mongoose";

export class PlanSyncService {
  /**
   * Recalculates progress recursively starting from a task ID.
   */
  public static async recalculateProgress(uid: string, taskId: string): Promise<void> {
    await dbConnect();
    const task = await Task.findById(taskId);
    if (!task) return;

    const goalId = task.goalId;
    if (!goalId) return;

    // 1. Recalculate Goal Progress
    const siblingTasks = await Task.find({ goalId });
    const completedTasks = siblingTasks.filter((t) => t.status === "completed");
    const goalProgress =
      siblingTasks.length > 0
        ? Math.round((completedTasks.length / siblingTasks.length) * 100)
        : 0;

    const goal = await Goal.findByIdAndUpdate(
      goalId,
      { $set: { progress: goalProgress } },
      { returnDocument: "after" }
    );
    if (!goal) return;

    const milestoneId = goal.milestoneId;
    if (!milestoneId) return;

    // 2. Recalculate Milestone Progress
    const siblingGoals = await Goal.find({ milestoneId });
    const totalGoalProgress = siblingGoals.reduce((sum, g) => sum + (g.progress || 0), 0);
    const milestoneProgress =
      siblingGoals.length > 0 ? Math.round(totalGoalProgress / siblingGoals.length) : 0;

    const milestone = await Milestone.findByIdAndUpdate(
      milestoneId,
      { $set: { progress: milestoneProgress } },
      { returnDocument: "after" }
    );
    if (!milestone) return;

    const planId = milestone.planId;
    if (!planId) return;

    // 3. Recalculate Plan Progress
    const siblingMilestones = await Milestone.find({ planId });
    const totalMilestoneProgress = siblingMilestones.reduce(
      (sum, m) => sum + (m.progress || 0),
      0
    );
    const planProgress =
      siblingMilestones.length > 0
        ? Math.round(totalMilestoneProgress / siblingMilestones.length)
        : 0;

    await Plan.findByIdAndUpdate(planId, { $set: { progress: planProgress } });
  }

  /**
   * Recalculates progress for the entire plan structure.
   */
  public static async recalculatePlanProgress(planId: string): Promise<void> {
    await dbConnect();
    const planObjectId = new Types.ObjectId(planId);

    // 1. Get all Milestones
    const milestones = await Milestone.find({ planId: planObjectId });

    for (const m of milestones) {
      // 2. Get Goals for this Milestone
      const goals = await Goal.find({ milestoneId: m._id });

      for (const g of goals) {
        // 3. Get Tasks for this Goal
        const tasks = await Task.find({ goalId: g._id });
        const completed = tasks.filter((t) => t.status === "completed");
        const goalProgress =
          tasks.length > 0 ? Math.round((completed.length / tasks.length) * 100) : 0;

        await Goal.findByIdAndUpdate(g._id, { $set: { progress: goalProgress } });
      }

      // 4. Update Milestone Progress based on Goal Progress
      const updatedGoals = await Goal.find({ milestoneId: m._id });
      const totalGoalProgress = updatedGoals.reduce((sum, g) => sum + (g.progress || 0), 0);
      const milestoneProgress =
        updatedGoals.length > 0 ? Math.round(totalGoalProgress / updatedGoals.length) : 0;

      await Milestone.findByIdAndUpdate(m._id, { $set: { progress: milestoneProgress } });
    }

    // 5. Update Plan Progress based on Milestone Progress
    const updatedMilestones = await Milestone.find({ planId: planObjectId });
    const totalMilestoneProgress = updatedMilestones.reduce(
      (sum, m) => sum + (m.progress || 0),
      0
    );
    const planProgress =
      updatedMilestones.length > 0
        ? Math.round(totalMilestoneProgress / updatedMilestones.length)
        : 0;

    await Plan.findByIdAndUpdate(planObjectId, { $set: { progress: planProgress } });
  }

  /**
   * Writes the evolved/merged plan tree to MongoDB, executes orphan deletion,
   * recalculates progress, and returns synchronization stats.
   */
  public static async persistPlanChanges(
    uid: string,
    result: {
      plan: any;
      planningConfidence: number;
      planningAction: "create" | "modify" | "merge" | "ignore";
      plannerReasoning: string;
      changeSummary: string;
      detectedConstraints: string;
      mergeStrategy: string;
      timelineRecalculation: string;
    },
    promptText: string,
    rawGeminiOutput: string,
    executionTimeMs: number
  ): Promise<{
    success: boolean;
    milestonesCreated: number;
    tasksCreated: number;
    planId: string;
    planVersion: number;
  }> {
    await dbConnect();

    const planningAction = result.planningAction;
    const confidence = result.planningConfidence;
    const normalizedPlan = result.plan;
    const isMergeMode = planningAction === "merge" || (confidence >= 0.50 && confidence < 0.80);

    const diagnostics = {
      planningPrompt: promptText,
      rawGeminiOutput,
      normalizedPlan: JSON.stringify(normalizedPlan, null, 2),
      executionTimeMs,
      plannerReasoning: result.plannerReasoning,
      detectedConstraints: result.detectedConstraints,
      mergeStrategy: result.mergeStrategy,
      timelineRecalculation: result.timelineRecalculation,
    };

    let planDoc: any;
    if (normalizedPlan.id && Types.ObjectId.isValid(normalizedPlan.id)) {
      // Update existing plan
      planDoc = await Plan.findByIdAndUpdate(
        normalizedPlan.id,
        {
          $set: {
            title: normalizedPlan.title,
            description: normalizedPlan.description || "",
            status: normalizedPlan.status,
            priority: normalizedPlan.priority,
            estimatedDuration: normalizedPlan.estimatedDuration,
            type: normalizedPlan.type,
            diagnostics,
          },
        },
        { returnDocument: "after" }
      );
    } else {
      // Create new plan
      planDoc = await Plan.create({
        firebaseUid: uid,
        title: normalizedPlan.title,
        description: normalizedPlan.description || "",
        status: normalizedPlan.status || "active",
        priority: normalizedPlan.priority || 1,
        estimatedDuration: normalizedPlan.estimatedDuration,
        type: normalizedPlan.type || "personal",
        progress: 0,
        diagnostics,
      });
    }

    if (!planDoc) {
      throw new Error("Failed to create or update Plan document.");
    }

    const planId = planDoc._id;
    let totalTasksCreated = 0;
    let totalMilestonesCreated = 0;

    const milestoneIdsInPayload = new Set<string>();
    const goalIdsInPayload = new Set<string>();
    const taskIdsInPayload = new Set<string>();

    // Process Milestones
    for (const milestone of normalizedPlan.milestones) {
      let milestoneDoc: any;
      if (milestone.id && Types.ObjectId.isValid(milestone.id)) {
        milestoneDoc = await Milestone.findByIdAndUpdate(
          milestone.id,
          {
            $set: {
              title: milestone.title,
              description: milestone.description || "",
              status: milestone.status,
              priority: milestone.priority,
              estimatedDuration: milestone.estimatedDuration,
              startDate: milestone.startDate || "",
              endDate: milestone.endDate || "",
              category: milestone.category || "Personal",
              importance: milestone.importance || 5,
              flexibility: milestone.flexibility || 5,
            },
          },
          { returnDocument: "after" }
        );
        milestoneIdsInPayload.add(milestone.id);
      } else {
        milestoneDoc = await Milestone.create({
          planId,
          firebaseUid: uid,
          title: milestone.title,
          description: milestone.description || "",
          status: milestone.status || "todo",
          priority: milestone.priority || 1,
          estimatedDuration: milestone.estimatedDuration,
          progress: 0,
          startDate: milestone.startDate || "",
          endDate: milestone.endDate || "",
          category: milestone.category || "Personal",
          importance: milestone.importance || 5,
          flexibility: milestone.flexibility || 5,
        });
        milestoneIdsInPayload.add(milestoneDoc._id.toString());
        totalMilestonesCreated++;
      }

      const milestoneId = milestoneDoc._id;

      // Process Goals under this Milestone
      for (const goal of milestone.goals) {
        let goalDoc: any;
        if (goal.id && Types.ObjectId.isValid(goal.id)) {
          goalDoc = await Goal.findByIdAndUpdate(
            goal.id,
            {
              $set: {
                planId,
                milestoneId,
                title: goal.title,
                description: goal.description || "",
                status: goal.status,
                priority: goal.priority,
                estimatedDuration: goal.estimatedDuration,
              },
            },
            { returnDocument: "after" }
          );
          goalIdsInPayload.add(goal.id);
        } else {
          goalDoc = await Goal.create({
            firebaseUid: uid,
            planId,
            milestoneId,
            title: goal.title,
            description: goal.description || "",
            status: goal.status || "active",
            priority: goal.priority || 1,
            estimatedDuration: goal.estimatedDuration,
            progress: 0,
          });
          goalIdsInPayload.add(goalDoc._id.toString());
        }

        const goalId = goalDoc._id;

        // Process Tasks under this Goal
        for (const task of goal.tasks) {
          let taskDoc: any;
          if (task.id && Types.ObjectId.isValid(task.id)) {
            taskDoc = await Task.findByIdAndUpdate(
              task.id,
              {
                $set: {
                  goalId,
                  title: task.title,
                  description: task.description || "",
                  status: task.status,
                  priority: task.priority,
                  estimatedDuration: task.estimatedDuration,
                  dependencies: task.dependencies || [],
                  suggestedDate: task.suggestedDate || "",
                  timeBlock: task.timeBlock || "",
                },
              },
              { returnDocument: "after" }
            );
            taskIdsInPayload.add(task.id);
          } else {
            taskDoc = await Task.create({
              firebaseUid: uid,
              goalId,
              title: task.title,
              description: task.description || "",
              status: task.status || "todo",
              priority: task.priority || 1,
              estimatedDuration: task.estimatedDuration,
              dependencies: task.dependencies || [],
              suggestedDate: task.suggestedDate || "",
              timeBlock: task.timeBlock || "",
            });
            taskIdsInPayload.add(taskDoc._id.toString());
            totalTasksCreated++;
          }
        }
      }
    }

    // Sync deletes: Remove orphaned elements NOT in the new payload.
    if (!isMergeMode) {
      const goalsOfThisPlan = await Goal.find({ planId });
      const goalIdsOfThisPlan = goalsOfThisPlan.map((g) => g._id);

      if (taskIdsInPayload.size > 0) {
        await Task.deleteMany({
          goalId: { $in: goalIdsOfThisPlan },
          _id: { $nin: Array.from(taskIdsInPayload).map((id) => new Types.ObjectId(id)) },
        });
      }

      if (goalIdsInPayload.size > 0) {
        await Goal.deleteMany({
          planId,
          _id: { $nin: Array.from(goalIdsInPayload).map((id) => new Types.ObjectId(id)) },
        });
      }

      if (milestoneIdsInPayload.size > 0) {
        await Milestone.deleteMany({
          planId,
          _id: { $nin: Array.from(milestoneIdsInPayload).map((id) => new Types.ObjectId(id)) },
        });
      }
    }

    // Recalculate structure progress
    await this.recalculatePlanProgress(planId.toString());

    // Push snapshot to history
    const updatedPlanTree = await Plan.findById(planId).lean();
    const updatedMilestones = await Milestone.find({ planId }).sort({ startDate: 1 }).lean();
    const milestoneTrees = [];
    for (const m of updatedMilestones) {
      const goals = await Goal.find({ milestoneId: m._id }).sort({ priority: 1 }).lean();
      const goalTrees = [];
      for (const g of goals) {
        const tasks = await Task.find({ goalId: g._id }).sort({ priority: 1 }).lean();
        goalTrees.push({ ...g, tasks });
      }
      milestoneTrees.push({ ...m, goals: goalTrees });
    }
    const fullSnapshot = {
      ...updatedPlanTree,
      milestones: milestoneTrees,
    };

    const changeSummary = result.changeSummary || (normalizedPlan.id ? "Updated plan" : "New plan");
    const updatedPlanDoc = await Plan.findByIdAndUpdate(
      planId,
      {
        $push: {
          history: {
            timestamp: new Date(),
            changeSummary,
            snapshot: JSON.stringify(fullSnapshot),
          },
        },
        $inc: { version: 1 },
      },
      { returnDocument: "after" }
    );

    const newPlanVersion = updatedPlanDoc?.version ?? 1;

    // A. Sync and Archive other active plans
    if (planDoc.status === "active") {
      const plansToArchive = await Plan.find({
        firebaseUid: uid,
        _id: { $ne: planDoc._id },
        status: "active",
      });
      const planIdsToArchive = plansToArchive.map((p) => p._id.toString());

      if (planIdsToArchive.length > 0) {
        await Plan.updateMany(
          { firebaseUid: uid, _id: { $in: planIdsToArchive } },
          { $set: { status: "archived" } }
        );

        // Calendar cleanup
        const { CalendarSyncService } = await import("@/services/calendar-sync.service");
        for (const pid of planIdsToArchive) {
          await CalendarSyncService.cleanObsoleteEvents(uid, pid).catch((err) =>
            console.error(
              "[PlanSyncService] Failed to clean obsolete events for auto-archived plan:",
              pid,
              err
            )
          );
        }
      }
    } else if (planDoc.status === "archived") {
      const { CalendarSyncService } = await import("@/services/calendar-sync.service");
      await CalendarSyncService.cleanObsoleteEvents(uid, planDoc._id.toString()).catch((err) =>
        console.error(
          "[PlanSyncService] Failed to clean obsolete events for evolved plan:",
          planDoc._id,
          err
        )
      );
    }

    // B. Behavior Engine hook
    await BehaviorEngine.updateFromPlan(uid, planId, "update").catch((err) =>
      console.error("[PlanSyncService] Failed to update behavior profile:", err)
    );

    return {
      success: true,
      milestonesCreated: totalMilestonesCreated,
      tasksCreated: totalTasksCreated,
      planId: planId.toString(),
      planVersion: newPlanVersion,
    };
  }

  /**
   * Persists a newly generated 7-day WeeklyExecutionSchedule.
   */
  public static async persistWeeklySchedule(
    uid: string,
    planId: string,
    scheduleData: any,
    startDateStr: string,
    endDateStr: string,
    timezone: string
  ): Promise<any> {
    await dbConnect();
    const planObjectId = new Types.ObjectId(planId);

    // Archive ALL active schedules for this user (including from prior plans)
    await WeeklyExecutionSchedule.updateMany(
      { firebaseUid: uid, status: "ACTIVE" },
      { $set: { status: "ARCHIVED" } }
    );

    const lastSchedule = await WeeklyExecutionSchedule.findOne({
      firebaseUid: uid,
      planId: planObjectId,
    })
      .sort({ version: -1 })
      .lean();

    const nextVersion = (lastSchedule?.version || 0) + 1;

    console.log("[DEBUG-STORE] scheduleData received. Day 0 workBlocks count:", scheduleData.days?.[0]?.workBlocks?.length);
    console.log("[DEBUG-STORE] First workBlock taskIds:", scheduleData.days?.[0]?.workBlocks?.[0]?.taskIds);
    
    const days = scheduleData.days.map((d: any) => ({
      date: d.date,
      dayNumber: d.dayNumber,
      focusTheme: d.focusTheme,
      estimatedWorkload: d.estimatedWorkload,
      plannedFocusHours: d.plannedFocusHours,
workBlocks: d.workBlocks.map((wb: any) => {
         console.log("[DEBUG-PERSIST] workBlock:", wb.title, "incoming taskIds:", wb.taskIds);
         const rawIds = wb.taskIds || [];
         const validIds = rawIds.filter((id: string) => typeof id === "string" && /^[a-f\d]{24}$/i.test(id));
         console.log("[DEBUG-PERSIST] workBlock:", wb.title, "valid IDs after filter:", validIds, "count:", validIds.length);
         const finalTasks = validIds.map((id: string) => new Types.ObjectId(id));
         console.log("[DEBUG-PERSIST] workBlock:", wb.title, "final tasks written to Mongo:", finalTasks);
         return {
           title: wb.title,
           startTime: wb.startTime,
           endTime: wb.endTime,
           duration: wb.duration,
           priority: wb.priority,
           tasks: finalTasks,
         };
       }),
    }));

    const newSchedule = new WeeklyExecutionSchedule({
      firebaseUid: uid,
      planId: planObjectId,
      version: nextVersion,
      generatedAt: new Date(),
      validFrom: startDateStr,
      validTo: endDateStr,
      status: "ACTIVE",
      days: days,
    });

    await newSchedule.save();
    console.log(`[PlanSyncService] WeeklyExecutionSchedule v${nextVersion} written to MongoDB.`);
    return newSchedule.toObject();
  }
}
