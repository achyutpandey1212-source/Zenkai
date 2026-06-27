const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

// 1. Simple parser for .env to load credentials
const envFile = fs.readFileSync('.env', 'utf8');
envFile.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.substring(1, value.length - 1);
    }
    process.env[match[1]] = value;
  }
});

// Setup ts-config path resolution equivalent for simple node execution
require('ts-node').register({
  compilerOptions: {
    module: "commonjs",
    target: "es2020",
    moduleResolution: "node",
    esModuleInterop: true,
    experimentalDecorators: true,
    emitDecoratorMetadata: true,
    baseUrl: ".",
    paths: {
      "@/*": ["src/*"]
    }
  }
});

// Import repositories and models via ts-node compiled imports
const { dbConnect } = require('./src/lib/mongodb');
const { Task } = require('./src/models/Task');
const { Plan } = require('./src/models/Plan');
const { Milestone } = require('./src/models/Milestone');
const { Goal } = require('./src/models/Goal');
const { DailyAgenda } = require('./src/models/DailyAgenda');
const { ExecutionAgent } = require('./src/agents/execution-agent');
const { PlanningAgent } = require('./src/agents/planning-agent');

const TEST_UID = "test-execution-engine-uid";

async function runTests() {
  console.log("=== Zenkai Execution Engine Test Suite ===");
  
  await dbConnect();
  console.log("Connected to MongoDB database.");

  // Clean previous test data
  console.log("Cleaning up previous test records...");
  await Plan.deleteMany({ firebaseUid: TEST_UID });
  await Milestone.deleteMany({ firebaseUid: TEST_UID });
  await Goal.deleteMany({ firebaseUid: TEST_UID });
  await Task.deleteMany({ firebaseUid: TEST_UID });
  await DailyAgenda.deleteMany({ firebaseUid: TEST_UID });

  // TEST 1: Upcoming Exam in three days constraint
  console.log("\nScenario 1: Setting up an upcoming exam constraint in 3 days...");
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

  console.log("Drafted microprocessors course, milestones, goal, and 3 tasks.");

  // TEST 2: Generate agenda via ExecutionAgent
  console.log("\nScenario 2: Running Execution Agent to generate today's daily agenda...");
  const agenda = await ExecutionAgent.getOrCreateDailyAgenda(TEST_UID, dateStr, true);

  console.log("Daily Agenda Generated Successfully!");
  console.log("----------------------------------------------------------------");
  console.log(`Intention: "${agenda.intention}"`);
  console.log(`Focus: "${agenda.focus}"`);
  console.log(`Work Blocks: ${agenda.workBlocks.length} blocks generated.`);
  agenda.workBlocks.forEach(wb => {
    console.log(`  - Block: ${wb.title} (${wb.startTime} - ${wb.endTime}) with ${wb.tasks.length} tasks.`);
  });
  console.log(`Optional Tasks: ${agenda.optionalTasks.length}`);
  console.log(`Stretch Goals: ${agenda.stretchGoals.length}`);
  console.log(`Current Priority: "${agenda.currentPriority}"`);
  console.log(`Upcoming Deadline: "${agenda.upcomingDeadline}"`);
  console.log(`Execution Reasoning: "${agenda.executionReasoning}"`);
  console.log("----------------------------------------------------------------");

  // TEST 3: Verify Developer Mode diagnostics exist
  console.log("\nScenario 3: Verifying Developer Diagnostics calculations...");
  if (agenda.diagnostics) {
    console.log("Diagnostics fields present:");
    console.log(`  - priorityCalculations: ${agenda.diagnostics.priorityCalculations.substring(0, 80)}...`);
    console.log(`  - constraintEvaluation: ${agenda.diagnostics.constraintEvaluation.substring(0, 80)}...`);
    console.log(`  - deferredLogic: ${agenda.diagnostics.deferredLogic.substring(0, 80)}...`);
    console.log(`  - executionTimeMs: ${agenda.diagnostics.executionTimeMs}ms`);
  } else {
    throw new Error("Diagnostics data missing from DailyAgenda!");
  }

  // TEST 4: Complete task & Recalculate Progress
  console.log("\nScenario 4: Simulating task completion check...");
  t1.status = "completed";
  t1.completedAt = new Date();
  await t1.save();
  await PlanningAgent.recalculateProgress(TEST_UID, t1._id.toString());

  const updatedGoal = await Goal.findById(goal._id);
  const updatedPlan = await Plan.findById(plan._id);
  console.log(`Goal progress updated to: ${updatedGoal.progress}%`);
  console.log(`Plan progress updated to: ${updatedPlan.progress}%`);

  if (updatedGoal.progress === 0) {
    throw new Error("Goal progress failed to update!");
  }

  // TEST 5: Defer task & Rebalance
  console.log("\nScenario 5: Simulating task deferral and rebalancing agenda...");
  
  // Defer t2: increment deferredCount, reschedule for tomorrow
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split("T")[0];

  t2.status = "deferred";
  t2.suggestedDate = tomorrowStr;
  t2.deferredCount = (t2.deferredCount || 0) + 1;
  await t2.save();

  console.log(`Task "${t2.title}" marked deferred. Suggested date moved to tomorrow. deferredCount: ${t2.deferredCount}`);

  // Trigger rebalancing
  const rebalancedAgenda = await ExecutionAgent.rebalanceAgenda(TEST_UID, dateStr);
  console.log("Rebalanced Agenda generated successfully!");
  console.log(`New Intention: "${rebalancedAgenda.intention}"`);
  console.log(`Deferred Explanation: "${rebalancedAgenda.deferredExplanation}"`);

  console.log("\n=== All Tests Completed Successfully ===");
  process.exit(0);
}

runTests().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});
