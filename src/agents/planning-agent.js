"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlanningAgent = void 0;
const genai_1 = require("@google/genai");
const Plan_1 = require("@/models/Plan");
const Milestone_1 = require("@/models/Milestone");
const Goal_1 = require("@/models/Goal");
const Task_1 = require("@/models/Task");
const profile_repository_1 = require("@/repositories/profile.repository");
const memory_repository_1 = require("@/repositories/memory.repository");
const identity_repository_1 = require("@/repositories/identity.repository");
const reflection_repository_1 = require("@/repositories/reflection.repository");
const plan_repository_1 = require("@/repositories/plan.repository");
const mongoose_1 = require("mongoose");
const INTENT_DETECTION_SYSTEM_PROMPT = `
You are the Intent Detection Agent for Zenkai's Planning Engine.
Your job is to analyze the user's latest message and the recent conversation history to classify if they want to:
1. Create a new plan or modify/evolve an existing roadmap/study plan/project plan/career goal (e.g. "I want to become an SDE", "Plan my semester", "Help me prepare for placements", "I no longer want to build a startup"). Classification: "create_or_modify".
2. Update the status of a specific task (e.g., "I've completed Arrays", "I finished my revise formula sheet task", "I am working on Linked Lists"). Classification: "task_update".
3. Continue standard, ordinary conversation without any planning or task changes. Classification: "none".

For "create_or_modify", try to identify the planType ("career", "learning", "exams", "projects", "fitness", "habits", "business", "personal"), and a descriptive goalTitle.
For "task_update", extract the taskTitle and taskStatus ("completed", "in_progress", "todo").

Return a JSON object matching the requested schema.
`;
const PLANNER_SYSTEM_PROMPT = `
You are the Strategy and Execution Planning Agent for Zenkai.
Your mission is to build, merge, or evolve a structured roadmap for the user.

A plan is represented as a 4-tier hierarchy:
Plan -> Milestones -> Goals -> Tasks

Every level contains:
- title: concise, active wording.
- description: clear details of what this level entails.
- status:
  - Plan: "active" | "completed" | "archived"
  - Milestone: "todo" | "in_progress" | "completed" | "cancelled"
  - Goal: "active" | "completed" | "paused" | "cancelled"
  - Task: "todo" | "in_progress" | "completed" | "missed"
- priority: integer where 1 is highest priority.
- estimatedDuration: string indicating duration (e.g., "4 weeks", "10 hours", "2 days").

CORE DIRECTIVES FOR EVOLUTION & MERGING:
- Zenkai plans are living systems. Do NOT recreate them from scratch if a plan already exists.
- You will be provided with any existing plans in JSON.
- If the user's message represents an update or expansion of an existing plan, you MUST preserve the exact "id" fields for all unchanged or updated Plans, Milestones, Goals, and Tasks.
- Omit the "id" field ONLY for brand new items.
- If the user wants to abandon or change goals (e.g. "I no longer want to build a startup, I want to prepare for exams"), set the status of the abandoned plan to "archived". Do not delete it from history.
- Ground your plans in the user's context (onboarding profile, memories, active identity traits, and reflections). For example, check their peak focus times, availability, or career goals.

Return a JSON object containing the plan tree.
`;
class PlanningAgent {
    static client = null;
    static getClient() {
        if (!this.client) {
            const apiKey = process.env.GEMINI_API_KEY;
            if (!apiKey) {
                throw new Error("Missing GEMINI_API_KEY environment variable.");
            }
            this.client = new genai_1.GoogleGenAI({ apiKey });
        }
        return this.client;
    }
    /**
     * Detect planning or task update intent.
     */
    static async detectIntent(message, history) {
        try {
            const ai = this.getClient();
            const chatHistoryText = history
                .slice(-6)
                .map((h) => `${h.role === "user" ? "User" : "Zenkai"}: ${h.content}`)
                .join("\n");
            const prompt = `
Conversation History:
${chatHistoryText}

Latest Message:
User: ${message}

Determine the intent:
`;
            const response = await ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: [{ role: "user", parts: [{ text: prompt }] }],
                config: {
                    systemInstruction: INTENT_DETECTION_SYSTEM_PROMPT.trim(),
                    temperature: 0.1,
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: "OBJECT",
                        properties: {
                            intentType: { type: "STRING", enum: ["create_or_modify", "task_update", "none"] },
                            taskTitle: { type: "STRING" },
                            taskStatus: { type: "STRING", enum: ["completed", "in_progress", "todo"] },
                            planType: { type: "STRING", enum: ["career", "learning", "exams", "projects", "fitness", "habits", "business", "personal"] },
                            goalTitle: { type: "STRING" },
                            details: { type: "STRING" },
                        },
                        required: ["intentType"],
                    },
                },
            });
            const text = response.text;
            if (!text)
                return { type: "none" };
            const parsed = JSON.parse(text);
            return {
                type: parsed.intentType,
                taskTitle: parsed.taskTitle,
                taskStatus: parsed.taskStatus,
                planType: parsed.planType,
                goalTitle: parsed.goalTitle,
                details: parsed.details,
            };
        }
        catch (error) {
            console.error("[PlanningAgent] Intent detection error:", error);
            return { type: "none" };
        }
    }
    /**
     * Generate or evolve a plan.
     */
    static async generateOrEvolvePlan(uid, intent, userMessage) {
        const startTime = Date.now();
        try {
            console.log(`[PlanningAgent] Executing plan generation/evolution for user ${uid}`);
            // 1. Fetch user context
            const profile = await profile_repository_1.ProfileRepository.findByFirebaseUid(uid);
            const memories = await memory_repository_1.MemoryRepository.findApprovedByUser(uid);
            const traits = await identity_repository_1.IdentityRepository.findActiveByUser(uid);
            const reflections = await reflection_repository_1.ReflectionRepository.findActiveByUser(uid);
            const existingPlans = await plan_repository_1.PlanRepository.findFullTree(uid);
            // 2. Format context for prompt
            const contextPrompt = `
User Profile:
- Long-term goal: ${profile?.longTermGoal || "None"}
- Profession: ${profile?.profession || "None"}
- Current Focus: ${profile?.currentFocus || "None"}
- Peak focus availability: ${profile?.dailyAvailability || "None"}
- Working Style: ${profile?.workStyle || "None"}

Memories:
${JSON.stringify(memories.map(m => m.summary), null, 2)}

Active Traits:
${JSON.stringify(traits.map(t => ({ trait: t.trait, description: t.description })), null, 2)}

Active Reflections:
${JSON.stringify(reflections.map(r => ({ title: r.title, summary: r.summary })), null, 2)}

Existing Plans Tree:
${JSON.stringify(existingPlans, null, 2)}
`;
            const prompt = `
User Context:
${contextPrompt}

Latest User request: "${userMessage}"
Detected Intent Details: ${JSON.stringify(intent)}

Create a new plan or modify/evolve an existing plan based on the request.
Remember:
- If a plan is for a goal/career/project the user no longer wants, mark its status as "archived" and create a new plan.
- If evolving an existing plan, PRESERVE the exact database "id" (re-mapped to "id" field in JSON) for existing Plans, Milestones, Goals, and Tasks.
- Break the plan down into Milestones. Each Milestone must have Goals. Each Goal must have actionable Tasks.
- Keep the number of tasks high quality and structured.
`;
            const ai = this.getClient();
            const response = await ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: [{ role: "user", parts: [{ text: prompt }] }],
                config: {
                    systemInstruction: PLANNER_SYSTEM_PROMPT.trim(),
                    temperature: 0.2,
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: "OBJECT",
                        properties: {
                            plan: {
                                type: "OBJECT",
                                properties: {
                                    id: { type: "STRING" },
                                    title: { type: "STRING" },
                                    description: { type: "STRING" },
                                    status: { type: "STRING", enum: ["active", "completed", "archived"] },
                                    priority: { type: "NUMBER" },
                                    estimatedDuration: { type: "STRING" },
                                    type: { type: "STRING", enum: ["career", "learning", "exams", "projects", "fitness", "habits", "business", "personal"] },
                                    milestones: {
                                        type: "ARRAY",
                                        items: {
                                            type: "OBJECT",
                                            properties: {
                                                id: { type: "STRING" },
                                                title: { type: "STRING" },
                                                description: { type: "STRING" },
                                                status: { type: "STRING", enum: ["todo", "in_progress", "completed", "cancelled"] },
                                                priority: { type: "NUMBER" },
                                                estimatedDuration: { type: "STRING" },
                                                goals: {
                                                    type: "ARRAY",
                                                    items: {
                                                        type: "OBJECT",
                                                        properties: {
                                                            id: { type: "STRING" },
                                                            title: { type: "STRING" },
                                                            description: { type: "STRING" },
                                                            status: { type: "STRING", enum: ["active", "completed", "paused", "cancelled"] },
                                                            priority: { type: "NUMBER" },
                                                            estimatedDuration: { type: "STRING" },
                                                            tasks: {
                                                                type: "ARRAY",
                                                                items: {
                                                                    type: "OBJECT",
                                                                    properties: {
                                                                        id: { type: "STRING" },
                                                                        title: { type: "STRING" },
                                                                        description: { type: "STRING" },
                                                                        status: { type: "STRING", enum: ["todo", "in_progress", "completed", "missed"] },
                                                                        priority: { type: "NUMBER" },
                                                                        estimatedDuration: { type: "STRING" },
                                                                        dependencies: {
                                                                            type: "ARRAY",
                                                                            items: { type: "STRING" },
                                                                        },
                                                                    },
                                                                    required: ["title", "status", "priority", "estimatedDuration"],
                                                                },
                                                            },
                                                        },
                                                        required: ["title", "status", "priority", "estimatedDuration", "tasks"],
                                                    },
                                                },
                                            },
                                            required: ["title", "status", "priority", "estimatedDuration", "goals"],
                                        },
                                    },
                                },
                                required: ["title", "status", "priority", "estimatedDuration", "type", "milestones"],
                            },
                        },
                        required: ["plan"],
                    },
                },
            });
            const responseText = response.text;
            if (!responseText)
                return false;
            const result = JSON.parse(responseText);
            const normalizedPlan = result.plan;
            const executionTimeMs = Date.now() - startTime;
            // 3. Persist to Database
            let planDoc;
            const diagnostics = {
                planningPrompt: prompt,
                rawGeminiOutput: responseText,
                normalizedPlan: JSON.stringify(normalizedPlan, null, 2),
                executionTimeMs,
            };
            if (normalizedPlan.id && mongoose_1.Types.ObjectId.isValid(normalizedPlan.id)) {
                // Update existing plan
                planDoc = await Plan_1.Plan.findByIdAndUpdate(normalizedPlan.id, {
                    $set: {
                        title: normalizedPlan.title,
                        description: normalizedPlan.description || "",
                        status: normalizedPlan.status,
                        priority: normalizedPlan.priority,
                        estimatedDuration: normalizedPlan.estimatedDuration,
                        type: normalizedPlan.type,
                        diagnostics,
                    },
                }, { new: true });
            }
            else {
                // Create new plan
                planDoc = await Plan_1.Plan.create({
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
            // Fetch all existing milestones, goals, and tasks for clean ORM sync/deletion
            const existingMilestones = await Milestone_1.Milestone.find({ planId });
            const existingMilestoneIds = existingMilestones.map((m) => m._id.toString());
            const milestoneIdsInPayload = new Set();
            const goalIdsInPayload = new Set();
            const taskIdsInPayload = new Set();
            // Process Milestones
            for (const milestone of normalizedPlan.milestones) {
                let milestoneDoc;
                if (milestone.id && mongoose_1.Types.ObjectId.isValid(milestone.id)) {
                    milestoneDoc = await Milestone_1.Milestone.findByIdAndUpdate(milestone.id, {
                        $set: {
                            title: milestone.title,
                            description: milestone.description || "",
                            status: milestone.status,
                            priority: milestone.priority,
                            estimatedDuration: milestone.estimatedDuration,
                        },
                    }, { new: true });
                    milestoneIdsInPayload.add(milestone.id);
                }
                else {
                    milestoneDoc = await Milestone_1.Milestone.create({
                        planId,
                        firebaseUid: uid,
                        title: milestone.title,
                        description: milestone.description || "",
                        status: milestone.status || "todo",
                        priority: milestone.priority || 1,
                        estimatedDuration: milestone.estimatedDuration,
                        progress: 0,
                    });
                    milestoneIdsInPayload.add(milestoneDoc._id.toString());
                }
                const milestoneId = milestoneDoc._id;
                // Process Goals under this Milestone
                for (const goal of milestone.goals) {
                    let goalDoc;
                    if (goal.id && mongoose_1.Types.ObjectId.isValid(goal.id)) {
                        goalDoc = await Goal_1.Goal.findByIdAndUpdate(goal.id, {
                            $set: {
                                planId,
                                milestoneId,
                                title: goal.title,
                                description: goal.description || "",
                                status: goal.status,
                                priority: goal.priority,
                                estimatedDuration: goal.estimatedDuration,
                            },
                        }, { new: true });
                        goalIdsInPayload.add(goal.id);
                    }
                    else {
                        goalDoc = await Goal_1.Goal.create({
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
                        let taskDoc;
                        if (task.id && mongoose_1.Types.ObjectId.isValid(task.id)) {
                            taskDoc = await Task_1.Task.findByIdAndUpdate(task.id, {
                                $set: {
                                    goalId,
                                    title: task.title,
                                    description: task.description || "",
                                    status: task.status,
                                    priority: task.priority,
                                    estimatedDuration: task.estimatedDuration,
                                    dependencies: task.dependencies || [],
                                },
                            }, { new: true });
                            taskIdsInPayload.add(task.id);
                        }
                        else {
                            taskDoc = await Task_1.Task.create({
                                firebaseUid: uid,
                                goalId,
                                title: task.title,
                                description: task.description || "",
                                status: task.status || "todo",
                                priority: task.priority || 1,
                                estimatedDuration: task.estimatedDuration,
                                dependencies: task.dependencies || [],
                            });
                            taskIdsInPayload.add(taskDoc._id.toString());
                        }
                    }
                }
            }
            // Sync deletes: Find orphaned elements and remove them
            // 1. Tasks: Find all tasks linked to this plan's goals that are NOT in payload, and delete them
            const goalsOfThisPlan = await Goal_1.Goal.find({ planId });
            const goalIdsOfThisPlan = goalsOfThisPlan.map((g) => g._id);
            await Task_1.Task.deleteMany({
                goalId: { $in: goalIdsOfThisPlan },
                _id: { $nin: Array.from(taskIdsInPayload).map((id) => new mongoose_1.Types.ObjectId(id)) },
            });
            // 2. Goals: Delete goals of this plan that are NOT in payload
            await Goal_1.Goal.deleteMany({
                planId,
                _id: { $nin: Array.from(goalIdsInPayload).map((id) => new mongoose_1.Types.ObjectId(id)) },
            });
            // 3. Milestones: Delete milestones of this plan that are NOT in payload
            await Milestone_1.Milestone.deleteMany({
                planId,
                _id: { $nin: Array.from(milestoneIdsInPayload).map((id) => new mongoose_1.Types.ObjectId(id)) },
            });
            // 4. Trigger progress recalculation for the entire plan structure to sync numbers
            // We can take any task of the plan and trigger progress update, or run a general plan recalculator.
            await this.recalculatePlanProgress(planId.toString());
            return true;
        }
        catch (error) {
            console.error("[PlanningAgent] Plan generation/evolution error:", error);
            return false;
        }
    }
    /**
     * Recalculates progress recursively starting from a task ID.
     */
    static async recalculateProgress(uid, taskId) {
        try {
            const task = await Task_1.Task.findById(taskId);
            if (!task || !task.goalId)
                return;
            const goalId = task.goalId.toString();
            const goal = await Goal_1.Goal.findById(goalId);
            if (!goal)
                return;
            // 1. Recalculate Goal Progress
            const tasks = await Task_1.Task.find({ goalId: task.goalId });
            const totalTasks = tasks.length;
            const completedTasks = tasks.filter((t) => t.status === "completed").length;
            const goalProgress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
            const goalStatus = goalProgress === 100 ? "completed" : "active";
            await Goal_1.Goal.findByIdAndUpdate(goalId, {
                $set: { progress: goalProgress, status: goalStatus },
            });
            if (!goal.milestoneId)
                return;
            const milestoneId = goal.milestoneId.toString();
            const milestone = await Milestone_1.Milestone.findById(milestoneId);
            if (!milestone)
                return;
            // 2. Recalculate Milestone Progress
            const goals = await Goal_1.Goal.find({ milestoneId: goal.milestoneId });
            const totalGoals = goals.length;
            const completedGoalsProgress = goals.reduce((sum, g) => sum + (g.progress || 0), 0);
            const milestoneProgress = totalGoals > 0 ? Math.round(completedGoalsProgress / totalGoals) : 0;
            const milestoneStatus = milestoneProgress === 100 ? "completed" : "in_progress";
            await Milestone_1.Milestone.findByIdAndUpdate(milestoneId, {
                $set: { progress: milestoneProgress, status: milestoneStatus },
            });
            if (!milestone.planId)
                return;
            // 3. Recalculate Plan Progress
            const planId = milestone.planId.toString();
            const milestones = await Milestone_1.Milestone.find({ planId: milestone.planId });
            const totalMilestones = milestones.length;
            const completedMilestonesProgress = milestones.reduce((sum, m) => sum + (m.progress || 0), 0);
            const planProgress = totalMilestones > 0 ? Math.round(completedMilestonesProgress / totalMilestones) : 0;
            const planStatus = planProgress === 100 ? "completed" : "active";
            await Plan_1.Plan.findByIdAndUpdate(planId, {
                $set: { progress: planProgress, status: planStatus },
            });
            console.log(`[PlanningAgent] Recalculated progress recursively. Plan ${planId}: ${planProgress}%`);
        }
        catch (error) {
            console.error("[PlanningAgent] Error during recursive progress calculation:", error);
        }
    }
    /**
     * Helper to recalculate progress for an entire plan by its ID.
     */
    static async recalculatePlanProgress(planId) {
        try {
            const milestones = await Milestone_1.Milestone.find({ planId: new mongoose_1.Types.ObjectId(planId) });
            for (const m of milestones) {
                const goals = await Goal_1.Goal.find({ milestoneId: m._id });
                for (const g of goals) {
                    const tasks = await Task_1.Task.find({ goalId: g._id });
                    const totalTasks = tasks.length;
                    const completedTasks = tasks.filter((t) => t.status === "completed").length;
                    const goalProgress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
                    const goalStatus = goalProgress === 100 ? "completed" : g.status;
                    await Goal_1.Goal.findByIdAndUpdate(g._id, { $set: { progress: goalProgress, status: goalStatus } });
                }
                const totalGoals = goals.length;
                const milestoneProgress = totalGoals > 0
                    ? Math.round(goals.reduce((sum, g) => sum + (g.progress || 0), 0) / totalGoals)
                    : 0;
                const milestoneStatus = milestoneProgress === 100 ? "completed" : m.status;
                await Milestone_1.Milestone.findByIdAndUpdate(m._id, { $set: { progress: milestoneProgress, status: milestoneStatus } });
            }
            const totalMilestones = milestones.length;
            const planProgress = totalMilestones > 0
                ? Math.round(milestones.reduce((sum, m) => sum + (m.progress || 0), 0) / totalMilestones)
                : 0;
            const plan = await Plan_1.Plan.findById(planId);
            const planStatus = planProgress === 100 ? "completed" : (plan?.status || "active");
            await Plan_1.Plan.findByIdAndUpdate(planId, { $set: { progress: planProgress, status: planStatus } });
        }
        catch (error) {
            console.error(`[PlanningAgent] Failed to recalculate plan progress for plan ${planId}:`, error);
        }
    }
}
exports.PlanningAgent = PlanningAgent;
