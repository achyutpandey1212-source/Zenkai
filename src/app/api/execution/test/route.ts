import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongodb";
import { Task } from "@/models/Task";
import { Plan } from "@/models/Plan";
import { Milestone } from "@/models/Milestone";
import { Goal } from "@/models/Goal";
import { WeeklyExecutionSchedule } from "@/models/WeeklyExecutionSchedule";
import { PlanningAgent } from "@/agents/planning-agent";

export const dynamic = "force-dynamic";

export async function GET() {
  const logs: string[] = [];
  const log = (msg: string) => {
    console.log(msg);
    logs.push(msg);
  };

  try {
    log("=== Zenkai Execution Engine Test Suite ===");
    
    await dbConnect();
    log("Connected to MongoDB database.");

    const TEST_UID = "test-execution-engine-uid";

    // Clean previous test data
    log("Cleaning up previous test records...");
    await Plan.deleteMany({ firebaseUid: TEST_UID });
    await Milestone.deleteMany({ firebaseUid: TEST_UID });
    await Goal.deleteMany({ firebaseUid: TEST_UID });
    await Task.deleteMany({ firebaseUid: TEST_UID });
    await WeeklyExecutionSchedule.deleteMany({ firebaseUid: TEST_UID });

    // TEST 1: Upcoming Exam in three days constraint
    log("Scenario 1: Setting up an upcoming exam constraint in 3 days...");
    const today = new Date();
    const dateStr = today.toISOString().split("T")[0];

    const examDate = new Date(today);
    examDate.setDate(examDate.getDate() + 3);

    const plan = await Plan.create({
      firebaseUid: TEST_UID,
      title: "Pass University Semester",
      status: "active",
      priority: 1,
      progress: 0,
      type: "STUDY"
    });

    const milestone = await Milestone.create({
      firebaseUid: TEST_UID,
      planId: plan._id,
      title: "Midterms",
      status: "todo",
      priority: 1,
      progress: 0,
      endDate: examDate.toISOString()
    });

    const goal = await Goal.create({
      firebaseUid: TEST_UID,
      planId: plan._id,
      milestoneId: milestone._id,
      title: "Study Microprocessors",
      status: "active",
      priority: 1,
      progress: 0
    });

    const t1 = await Task.create({
      firebaseUid: TEST_UID,
      goalId: goal._id,
      title: "Read Chapter 4: Memory Mapping",
      status: "todo",
      priority: 1,
      estimatedMinutes: 60,
      suggestedDate: dateStr
    });

    const t2 = await Task.create({
      firebaseUid: TEST_UID,
      goalId: goal._id,
      title: "Solve memory mapping practice set",
      status: "todo",
      priority: 2,
      estimatedMinutes: 90,
      suggestedDate: dateStr
    });

    const t3 = await Task.create({
      firebaseUid: TEST_UID,
      goalId: goal._id,
      title: "Review lecture slides",
      status: "todo",
      priority: 3,
      estimatedMinutes: 30,
      suggestedDate: dateStr
    });

    log("Drafted microprocessors course, milestones, goal, and 3 tasks.");

    // TEST 2: Generate weekly schedule
    log("Scenario 2: Running Planning Agent to generate weekly schedule...");
    const schedule = await PlanningAgent.generateWeeklySchedule(TEST_UID, plan._id.toString());
    const agenda = schedule.days.find((d: any) => d.date === dateStr) || schedule.days[0];

    log("Weekly Schedule Generated Successfully!");
    log("----------------------------------------------------------------");
    log(`Focus Theme: "${agenda.focusTheme}"`);
    log(`Work Blocks: ${agenda.workBlocks.length} blocks generated.`);
    agenda.workBlocks.forEach((wb: any) => {
      log(`  - Block: ${wb.title} (${wb.startTime} - ${wb.endTime}) with ${wb.tasks.length} tasks.`);
    });
    log("----------------------------------------------------------------");

    // TEST 4: Complete task & Recalculate Progress
    log("Scenario 4: Simulating task completion check...");
    t1.status = "completed";
    t1.completedAt = new Date();
    await t1.save();
    await PlanningAgent.recalculateProgress(TEST_UID, t1._id.toString());

    const updatedGoal = await Goal.findById(goal._id);
    const updatedPlan = await Plan.findById(plan._id);
    log(`Goal progress updated to: ${updatedGoal?.progress}%`);
    log(`Plan progress updated to: ${updatedPlan?.progress}%`);

    if (!updatedGoal || updatedGoal.progress === 0) {
      throw new Error("Goal progress failed to update!");
    }

    // TEST 5: Defer task & Rebalance
    log("Scenario 5: Simulating task deferral and rebalancing schedule...");
    
    // Defer t2: increment deferredCount, reschedule for tomorrow
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split("T")[0];

    t2.status = "deferred";
    t2.suggestedDate = tomorrowStr;
    t2.deferredCount = (t2.deferredCount || 0) + 1;
    await t2.save();

    log(`Task "${t2.title}" marked deferred. Suggested date moved to tomorrow. deferredCount: ${t2.deferredCount}`);

    // Trigger rebalancing
    const rebalancedSchedule = await PlanningAgent.generateWeeklySchedule(TEST_UID, plan._id.toString());
    const newAgenda = rebalancedSchedule.days.find((d: any) => d.date === dateStr) || rebalancedSchedule.days[0];
    
    log("Rebalanced Schedule generated successfully!");
    log(`New Focus Theme: "${newAgenda.focusTheme}"`);

    log("=== All Tests Completed Successfully ===");
    return NextResponse.json({ success: true, logs });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.stack : String(error);
    log(`Test failed: ${errorMsg}`);
    return NextResponse.json({ success: false, error: errorMsg, logs }, { status: 500 });
  }
}
