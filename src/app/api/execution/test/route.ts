import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongodb";
import { Task } from "@/models/Task";
import { Plan } from "@/models/Plan";
import { Milestone } from "@/models/Milestone";
import { Goal } from "@/models/Goal";
import { DailyAgenda } from "@/models/DailyAgenda";
import { ExecutionAgent } from "@/agents/execution-agent";
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
    await DailyAgenda.deleteMany({ firebaseUid: TEST_UID });

    // TEST 1: Upcoming Exam in three days constraint
    log("Scenario 1: Setting up an upcoming exam constraint in 3 days...");
    const today = new Date();
    const dateStr = today.toISOString().split("T")[0];

    const examDate = new Date();
    examDate.setDate(examDate.getDate() + 3);
    const examDateStr = examDate.toISOString().split("T")[0];

    // Create plan
    const plan = await Plan.create({
      firebaseUid: TEST_UID,
      title: "Microprocessors Semester Course",
      status: "active",
      priority: 1,
      estimatedDuration: "4 weeks",
      type: "exams"
    });

    // Create exam milestone (Hard constraint)
    const examMilestone = await Milestone.create({
      planId: plan._id,
      firebaseUid: TEST_UID,
      title: "Microprocessors Final Exam",
      status: "todo",
      priority: 1,
      category: "Exam",
      startDate: examDateStr,
      endDate: examDateStr,
      importance: 10,
      flexibility: 0
    });

    // Create study milestone
    const studyMilestone = await Milestone.create({
      planId: plan._id,
      firebaseUid: TEST_UID,
      title: "Exam Preparation & Revision",
      status: "in_progress",
      priority: 2,
      category: "Study",
      startDate: dateStr,
      endDate: examDateStr,
      importance: 8,
      flexibility: 3
    });

    // Create goal
    const goal = await Goal.create({
      firebaseUid: TEST_UID,
      planId: plan._id,
      milestoneId: studyMilestone._id,
      title: "Review Syllabus & Practice PYQs",
      status: "active",
      priority: 1
    });

    // Create tasks
    const t1 = await Task.create({
      firebaseUid: TEST_UID,
      goalId: goal._id,
      title: "Revise Microprocessor Interrupt Handling",
      status: "todo",
      priority: 1,
      estimatedMinutes: 60,
      suggestedDate: dateStr
    });

    const t2 = await Task.create({
      firebaseUid: TEST_UID,
      goalId: goal._id,
      title: "Practice 2025 PYQs on Memory Interfacing",
      status: "todo",
      priority: 2,
      estimatedMinutes: 45,
      suggestedDate: dateStr
    });

    const t3 = await Task.create({
      firebaseUid: TEST_UID,
      goalId: goal._id,
      title: "Formula Sheet Review: Timing Diagrams",
      status: "todo",
      priority: 3,
      estimatedMinutes: 30,
      suggestedDate: dateStr
    });

    log("Drafted microprocessors course, milestones, goal, and 3 tasks.");

    // TEST 2: Generate agenda via ExecutionAgent
    log("Scenario 2: Running Execution Agent to generate today's daily agenda...");
    const agenda = await ExecutionAgent.getOrCreateDailyAgenda(TEST_UID, dateStr, true);

    log("Daily Agenda Generated Successfully!");
    log("----------------------------------------------------------------");
    log(`Intention: "${agenda.intention}"`);
    log(`Focus: "${agenda.focus}"`);
    log(`Work Blocks: ${agenda.workBlocks.length} blocks generated.`);
    agenda.workBlocks.forEach((wb: any) => {
      log(`  - Block: ${wb.title} (${wb.startTime} - ${wb.endTime}) with ${wb.tasks.length} tasks.`);
    });
    log(`Optional Tasks: ${agenda.optionalTasks.length}`);
    log(`Stretch Goals: ${agenda.stretchGoals.length}`);
    log(`Current Priority: "${agenda.currentPriority}"`);
    log(`Upcoming Deadline: "${agenda.upcomingDeadline}"`);
    log(`Execution Reasoning: "${agenda.executionReasoning}"`);
    log("----------------------------------------------------------------");

    // TEST 3: Verify Developer Mode diagnostics exist
    log("Scenario 3: Verifying Developer Diagnostics calculations...");
    if (agenda.diagnostics) {
      log("Diagnostics data present:");
      log(`  - priorityCalculations: ${agenda.diagnostics.priorityCalculations?.substring(0, 100)}...`);
      log(`  - constraintEvaluation: ${agenda.diagnostics.constraintEvaluation?.substring(0, 100)}...`);
      log(`  - deferredLogic: ${agenda.diagnostics.deferredLogic?.substring(0, 100)}...`);
      log(`  - executionTimeMs: ${agenda.diagnostics.executionTimeMs}ms`);
    } else {
      throw new Error("Diagnostics data missing from DailyAgenda!");
    }

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
    log("Scenario 5: Simulating task deferral and rebalancing agenda...");
    
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
    const rebalancedAgenda = await ExecutionAgent.rebalanceAgenda(TEST_UID, dateStr);
    log("Rebalanced Agenda generated successfully!");
    log(`New Intention: "${rebalancedAgenda.intention}"`);
    log(`Deferred Explanation: "${rebalancedAgenda.deferredExplanation}"`);

    log("=== All Tests Completed Successfully ===");
    return NextResponse.json({ success: true, logs });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.stack : String(error);
    log(`Test failed: ${errorMsg}`);
    return NextResponse.json({ success: false, error: errorMsg, logs }, { status: 500 });
  }
}
