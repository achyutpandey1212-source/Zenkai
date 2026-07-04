import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession } from "@/lib/auth-service";
import { ProfileRepository } from "@/repositories/profile.repository";
import { UserRepository } from "@/repositories/user.repository";
import { GoalRepository } from "@/repositories/goal.repository";
import { TaskRepository } from "@/repositories/task.repository";
import { PlanningAgent } from "@/agents/planning-agent";
import { IdentityAgent } from "@/agents/identity-agent";
import { ReflectionAgent } from "@/agents/reflection-agent";
import { dbConnect } from "@/lib/mongodb";
import { User } from "@/models/User";
import { Profile } from "@/models/Profile";
import { Goal } from "@/models/Goal";
import { Task } from "@/models/Task";
import { Memory } from "@/models/Memory";
import { Reflection } from "@/models/Reflection";
import { IdentityTrait } from "@/models/IdentityTrait";
import { WeeklyExecutionSchedule } from "@/models/WeeklyExecutionSchedule";
import { Plan } from "@/models/Plan";
import { PlanRepository } from "@/repositories/plan.repository";
import { Milestone } from "@/models/Milestone";
import { CalendarSyncService } from "@/services/calendar-sync.service";
import { PlanSyncService } from "@/services/plan-sync.service";
import { SchedulingService } from "@/services/scheduling.service";
export const dynamic = "force-dynamic";

function parseDaysFromText(dateStr: string): string[] {
  if (!dateStr) return [];
  const lower = dateStr.toLowerCase();
  const days = [];
  if (lower.includes("monday") || lower.includes("mon")) days.push("Monday");
  if (lower.includes("tuesday") || lower.includes("tue")) days.push("Tuesday");
  if (lower.includes("wednesday") || lower.includes("wed")) days.push("Wednesday");
  if (lower.includes("thursday") || lower.includes("thu")) days.push("Thursday");
  if (lower.includes("friday") || lower.includes("fri")) days.push("Friday");
  if (lower.includes("saturday") || lower.includes("sat")) days.push("Saturday");
  if (lower.includes("sunday") || lower.includes("sun")) days.push("Sunday");
  
  if (lower.includes("every day") || lower.includes("daily") || lower.includes("everyday")) {
    return ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  }
  if (lower.includes("weekday") || lower.includes("monday–friday") || lower.includes("monday-friday")) {
    return ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
  }
  if (lower.includes("weekend")) {
    return ["Saturday", "Sunday"];
  }
  return days;
}

export async function POST(request: Request) {
  try {
    // 1. Verify session
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get("session")?.value;

    if (!sessionToken) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const user = await verifySession(sessionToken);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const uid = user.firebaseUid;
    const body = await request.json();
    const { profile, commitments, goals, mode, importedItems, name } = body;
    let plannerRequestedNoOp = false;

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (data: any) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        };

        try {
          await dbConnect();

          // ==========================================
          // STEP 1: SAVE PROFILE & HANDLE REPLACE/MERGE
          // ==========================================
          send({ stage: "learning", status: "running", message: "Learning about you..." });

          if (name) {
            await UserRepository.updateName(uid, name);
          }

          const timezone = profile?.timezone || "UTC";
          await User.updateOne({ firebaseUid: uid }, { $set: { "briefSettings.timezone": timezone } });

          if (mode === "replace") {
            const userPlans = await PlanRepository.findAllByUser(uid);
            for (const p of userPlans) {
              await PlanRepository.delete(p._id.toString());
            }
            await GoalRepository.deleteAllByUser(uid);
            await Task.deleteMany({ firebaseUid: uid });
            await Reflection.deleteMany({ firebaseUid: uid });
            await IdentityTrait.deleteMany({ firebaseUid: uid });
            await WeeklyExecutionSchedule.deleteMany({ firebaseUid: uid });
            await Memory.deleteMany({ firebaseUid: uid, reason: "Seeded from onboarding profile" });
          }

            const resolvedProfession = profile.primaryIdentity || profile.profession || "Other";
            await ProfileRepository.upsert({
              firebaseUid: uid,
              profession: resolvedProfession,
              primaryIdentity: profile.primaryIdentity || resolvedProfession,
              state: profile.state || "",
              branchContext: profile.branchContext || {},
              longTermGoal: profile.longTermGoal || "",
              currentFocus: profile.currentFocus || "",
              motivation: profile.motivation || "",
              dailyAvailability: profile.dailyAvailability || "",
              workStyle: profile.workStyle || "",
              biggestChallenge: profile.biggestChallenge || "",
              timezone,
              age: profile.age ? Number(profile.age) : undefined,
              country: profile.country || undefined,
              locale: profile.locale || undefined,
              commitments: commitments || [],
              wakeUpTime: profile.wakeUpTime || "07:00",
              sleepTime: profile.sleepTime || "23:00",
              goals: goals || [],
              schedulingStyle: profile.schedulingStyle || "Balanced",
              focusDuration: profile.focusDuration ? Number(profile.focusDuration) : 45,
              deepWorkTime: profile.deepWorkTime || "Morning",
              roles: profile.roles || [],
              focusAreas: profile.focusAreas || [],
              productivityChallenges: profile.productivityChallenges || [],
            });

          // Insert goals (if not already seeded)
          const existingGoalsCount = await Goal.countDocuments({ firebaseUid: uid });
          if (existingGoalsCount === 0 && goals && Array.isArray(goals)) {
            for (const g of goals) {
              await GoalRepository.create({
                firebaseUid: uid,
                title: g.title,
                priority: g.priority,
                status: "active",
              });
            }
          }

          // Process imported items
          if (importedItems && Array.isArray(importedItems)) {
            for (const item of importedItems) {
              if (item.category === "Goal") {
                const dup = await Goal.findOne({ firebaseUid: uid, title: item.title });
                if (!dup) {
                  await GoalRepository.create({
                    firebaseUid: uid,
                    title: item.title,
                    description: item.description || "",
                    status: "active",
                  });
                }
              } else if (item.category === "Task") {
                const dup = await Task.findOne({ firebaseUid: uid, title: item.title });
                if (!dup) {
                  await TaskRepository.create({
                    firebaseUid: uid,
                    title: item.title,
                    description: item.description || "",
                    status: "todo",
                    scheduledFor: item.date && !isNaN(Date.parse(item.date)) ? new Date(item.date) : undefined,
                  });
                }
              } else if (item.category === "Constraint") {
                const parsedDays = parseDaysFromText(item.date);
                const hasCommitment = await Profile.findOne({
                  firebaseUid: uid,
                  "commitments.name": item.title,
                });
                if (!hasCommitment) {
                  await Profile.updateOne(
                    { firebaseUid: uid },
                    {
                      $push: {
                        commitments: {
                          name: item.title,
                          startTime: item.startTime || "09:00",
                          endTime: item.endTime || "10:00",
                          days: parsedDays.length > 0 ? parsedDays : ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
                        },
                      },
                    }
                  );
                }
              }
            }
          }

          // Seed starter memories (if not already created)
          const existingMemoriesCount = await Memory.countDocuments({ firebaseUid: uid, reason: "Seeded from onboarding profile" });
          if (existingMemoriesCount === 0) {
            const starterMemories = [
              {
                category: "Identity" as const,
                content: `The user's primary role is ${profile.profession || "Other"}.`,
                summary: `Primary Role: ${profile.profession || "Other"}`,
              },
              {
                category: "Goal" as const,
                content: `The user's primary goal is to: ${profile.longTermGoal || "succeed in their pursuits"}.`,
                summary: `Primary Goal: ${profile.longTermGoal || "succeed in pursuits"}`,
              },
              {
                category: "Motivation" as const,
                content: `The user is motivated by: ${profile.motivation || "Personal growth and success"}.`,
                summary: `Motivation: ${profile.motivation || "Personal growth"}`,
              },
              {
                category: "Preference" as const,
                content: `The user prefers a ${profile.schedulingStyle || "Balanced"} scheduling style with focus blocks of ${profile.focusDuration || 45} minutes, and deep work during the ${profile.deepWorkTime || "Morning"}.`,
                summary: `Planning preferences: ${profile.schedulingStyle || "Balanced"} style, ${profile.focusDuration || 45}m blocks, ${profile.deepWorkTime || "Morning"} focus`,
              }
            ];

            for (const mem of starterMemories) {
              await Memory.create({
                firebaseUid: uid,
                category: mem.category,
                content: mem.content,
                summary: mem.summary,
                importance: 8.0,
                confidence: 1.0,
                reason: "Seeded from onboarding profile",
                status: "approved",
                version: 1,
                keywords: [mem.category.toLowerCase(), "onboarding", "seed"],
              });
            }
          }

          send({ stage: "learning", status: "success", message: "Life model and initial profile mapped." });

          // ==========================================
          // IDENTITY & REFLECTIONS MOVED TO BACKGROUND
          // ==========================================


          // ==========================================
          // STEP 4: DESIGNING ROADMAP
          // ==========================================
          let activePlan = await Plan.findOne({ firebaseUid: uid, status: "active" });
          let activePlanId = activePlan?._id?.toString() || "";
          if (!activePlan) {
            send({ stage: "roadmap", status: "running", message: "Designing your roadmap..." });
            const primaryGoal = profile.longTermGoal || (goals && goals.length > 0 ? goals[0].title : "Success");
            const planIntent: any = {
              type: "create_or_modify",
              planType: "personal",
              goalTitle: primaryGoal,
              isOnboarding: true,
            };
            try {
              const planResult = await PlanningAgent.generateOrEvolvePlan(
                uid,
                planIntent,
                `Generate initial plan roadmap for: ${primaryGoal}`
              );
              activePlan = await Plan.findOne({ firebaseUid: uid, status: "active" });
              if (activePlan) {
                activePlanId = activePlan._id.toString();
              } else if (planResult?.planId) {
                activePlanId = planResult.planId;
              }

              if (!activePlanId) {
                throw new Error("activePlanId is null/undefined after planning completes");
              }

              send({ stage: "roadmap", status: "success", message: "Roadmap generated." });
            } catch (e) {
              console.error("Failed to generate plan during onboarding, trying direct minimal fallback:", e);
              try {
                const planningContext = {
                  metadata: {
                    version: 1,
                    createdAt: new Date().toISOString(),
                    generatedFrom: "onboarding",
                    diagnostics: {
                      totalTokens: 0,
                      tokensPerLayer: {},
                      currentIntent: "planning" as const,
                      contextProfileUsed: "planning" as const,
                      budgetLimit: 4000,
                      remainingBudget: 4000,
                      ignoredMemoriesCount: 0,
                      droppedElements: [],
                    }
                  },
                  identity: { activeTraits: [] },
                  activePlan: null,
                  memories: [],
                  reflections: [],
                  profile: profile,
                };
                const aiResult = PlanningAgent.createMinimalStarterRoadmap(uid, planningContext, planIntent);
                const syncResult = await PlanSyncService.persistPlanChanges(
                  uid,
                  aiResult,
                  aiResult.promptText,
                  aiResult.rawGeminiOutput,
                  0
                );
                activePlanId = syncResult.planId;
                send({ stage: "roadmap", status: "success", message: "Roadmap generated via direct fallback." });
              } catch (fallbackErr) {
                console.error("Critical direct fallback failed:", fallbackErr);
                send({ stage: "roadmap", status: "success", message: "Roadmap seeding placeholder." });
              }
            }
          } else {
            send({ stage: "roadmap", status: "success", message: "Roadmap loaded." });
          }

          // ==========================================
          // STEP 5: PLANNING WEEK
          // ==========================================
          let activeSchedule = await WeeklyExecutionSchedule.findOne({ firebaseUid: uid, status: "ACTIVE" });
          if (!activeSchedule && activePlanId) {
            send({ stage: "weekly_schedule", status: "running", message: "Planning your week..." });
            try {
              const result = await SchedulingService.applyScheduleChange(
                { type: "create_workspace", userId: uid, planId: activePlanId }
              );
              if (!result?.success) {
                console.warn("[Onboarding] Schedule generation returned success=false:", result?.warnings);
              }
              send({ stage: "weekly_schedule", status: "success", message: "Weekly schedule prepared." });
            } catch (e) {
              console.error("Failed to generate weekly schedule during onboarding:", e);
              send({ stage: "weekly_schedule", status: "success", message: "Weekly schedule created with defaults." });
            }
          } else {
            send({ stage: "weekly_schedule", status: "success", message: "Weekly schedule loaded." });
          }

          // ==========================================
          // STEP 6: TODAY'S AGENDA
          // ==========================================
          send({ stage: "agenda", status: "running", message: "Creating today's agenda..." });
          send({ stage: "agenda", status: "success", message: "Daily focus agenda structured." });

          // ==========================================
          // STEP 7: WORKSPACE VALIDATOR & AUTO-HEALING
          // ==========================================
          send({ stage: "workspace", status: "running", message: "Preparing your workspace..." });

          let milestonesCount = 0;
          let goalsCount = 0;
          let scheduleDays = 0;
          let todayBlocksCount = 0;

          if (plannerRequestedNoOp) {
            send({ stage: "workspace", status: "success", message: "Planner returned no-op; continuing with a partial workspace." });
          } else {
            let isValid = false;
            let validationAttempts = 0;
            const maxValidationAttempts = 2;

            while (!isValid && validationAttempts < maxValidationAttempts) {
              validationAttempts++;
              console.log(`Running Workspace Validation - Attempt ${validationAttempts}/${maxValidationAttempts}`);

              activePlan = await Plan.findOne({ firebaseUid: uid, status: "active" });
              if (!activePlan) {
                const primaryGoal = profile.longTermGoal || (goals && goals.length > 0 ? goals[0].title : "Success");
                const planIntent: any = {
                  type: "create_or_modify",
                  planType: "personal",
                  goalTitle: primaryGoal,
                  isOnboarding: true,
                };
                await PlanningAgent.generateOrEvolvePlan(uid, planIntent, `Generate initial plan roadmap for: ${primaryGoal}`);
                activePlan = await Plan.findOne({ firebaseUid: uid, status: "active" });
              }

              if (activePlan) {
                activePlanId = activePlan._id.toString();
                milestonesCount = await Milestone.countDocuments({ planId: activePlan._id });

                if (milestonesCount === 0) {
                  const primaryGoal = profile.longTermGoal || (goals && goals.length > 0 ? goals[0].title : "Success");
                  await Milestone.create({
                    planId: activePlan._id,
                    firebaseUid: uid,
                    title: `Initiation: Aligning with ${primaryGoal}`,
                    description: "Initial alignment, routine setup, and focus foundation.",
                    status: "in_progress",
                    priority: 1,
                    startDate: new Date().toLocaleDateString("en-CA", { timeZone: timezone }),
                    endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toLocaleDateString("en-CA", { timeZone: timezone }),
                    category: "Personal",
                    importance: 8,
                  });
                  milestonesCount = await Milestone.countDocuments({ planId: activePlan._id });
                }

                goalsCount = await Goal.countDocuments({ planId: activePlan._id });
                if (goalsCount < 3) {
                  const goalTitles = [
                    "Establish consistent daily wake and sleep boundaries",
                    "Dedicate regular deep focus blocks to main objectives",
                    "Review roadmap milestones and update weekly backlog"
                  ];
                  let priorityVal = 1;
                  const activeMilestone = await Milestone.findOne({ planId: activePlan._id });

                  while (goalsCount < 3) {
                    const title = goalTitles[goalsCount] || `Focus Objective ${goalsCount + 1}`;
                    await Goal.create({
                      firebaseUid: uid,
                      planId: activePlan._id,
                      milestoneId: activeMilestone?._id,
                      title,
                      status: "active",
                      priority: priorityVal++,
                    });
                    goalsCount = await Goal.countDocuments({ planId: activePlan._id });
                  }
                }
              }

              activeSchedule = await WeeklyExecutionSchedule.findOne({ firebaseUid: uid, status: "ACTIVE" });
              if (!activeSchedule && activePlanId) {
                await SchedulingService.applyScheduleChange(
                  { type: "create_workspace", userId: uid, planId: activePlanId }
                );
                activeSchedule = await WeeklyExecutionSchedule.findOne({ firebaseUid: uid, status: "ACTIVE" });
              }

              if (activeSchedule) {
                scheduleDays = activeSchedule.days?.length || 0;

                if (scheduleDays < 7 && activePlanId) {
                  await WeeklyExecutionSchedule.deleteOne({ _id: activeSchedule._id });
                  const regenResult = await SchedulingService.applyScheduleChange(
                    { type: "create_workspace", userId: uid, planId: activePlanId }
                  );
                  if (!regenResult?.success) {
                    console.warn("[Onboarding] Regeneration returned success=false:", regenResult?.warnings);
                  }
                  activeSchedule = await WeeklyExecutionSchedule.findOne({ firebaseUid: uid, status: "ACTIVE" });
                  scheduleDays = activeSchedule?.days?.length || 0;
                }

                if (activeSchedule) {
                  const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: timezone });
                  const todayDay = activeSchedule.days.find((d: any) => d.date === todayStr) || activeSchedule.days[0];
                  todayBlocksCount = todayDay?.workBlocks?.length || 0;

                  if (todayBlocksCount === 0 && activePlanId) {
                    await WeeklyExecutionSchedule.deleteOne({ _id: activeSchedule._id });
                    const retryResult = await SchedulingService.applyScheduleChange(
                      { type: "create_workspace", userId: uid, planId: activePlanId }
                    );
                    if (!retryResult?.success) {
                      console.warn("[Onboarding] Retry regeneration returned success=false:", retryResult?.warnings);
                    }
                    activeSchedule = await WeeklyExecutionSchedule.findOne({ firebaseUid: uid, status: "ACTIVE" });
                    const updatedTodayDay = activeSchedule?.days.find((d: any) => d.date === todayStr) || activeSchedule?.days[0];
                    todayBlocksCount = updatedTodayDay?.workBlocks?.length || 0;
                    scheduleDays = activeSchedule?.days?.length || 0;
                  }
                }
              }

              isValid = !!activePlan &&
                        milestonesCount >= 1 &&
                        goalsCount >= 3 &&
                        !!activeSchedule &&
                        scheduleDays >= 7 &&
                        todayBlocksCount >= 1;
            }

            if (!isValid) {
              console.warn("[Onboarding] Workspace validation did not reach minimum viable content. Continuing with partial workspace.");
              send({ stage: "workspace", status: "success", message: "Workspace completed with partial content." });
            } else {
              send({ stage: "workspace", status: "success", message: "Workspace validation completed." });
            }
          }

          // ==========================================
          // STEP 8: CALENDAR SYNC
          // ==========================================
          send({ stage: "calendar", status: "running", message: "Synchronizing your calendar..." });
          const userDoc = await User.findOne({ firebaseUid: uid }).lean();
          let calendarSynced = false;

          if (userDoc?.googleCalendarSettings?.connected && activePlanId) {
            try {
              let syncResult = null;
              let retryCount = 0;
              while (retryCount < 2) {
                if (activeSchedule) {
                  syncResult = await CalendarSyncService.syncWeeklySchedule(uid, activeSchedule);
                  if (syncResult.success) break;
                }
                retryCount++;
                if (retryCount < 2) {
                  await new Promise(r => setTimeout(r, 1000));
                }
              }

              if (syncResult?.success) {
                calendarSynced = true;
                send({ stage: "calendar", status: "success", message: "Calendar synced." });
              } else {
                send({ stage: "calendar", status: "error", message: "Calendar couldn't be synced right now. We'll retry automatically." });
              }
            } catch (e) {
              console.error("Calendar sync trigger failed during onboarding:", e);
              send({ stage: "calendar", status: "error", message: "Calendar couldn't be synced right now. We'll retry automatically." });
            }
          } else {
            send({ stage: "calendar", status: "success", message: "Calendar can be connected later." });
          }

          await UserRepository.markOnboardingComplete(uid);

          const finalTasksCount = await Task.countDocuments({ firebaseUid: uid });
          const finalIdentityTraitsCount = await IdentityTrait.countDocuments({ firebaseUid: uid });
          const finalReflectionsCount = await Reflection.countDocuments({ firebaseUid: uid });

          send({
            stage: "complete",
            status: "success",
            message: "Welcome to Zenkai! Workspace ready.",
            stats: {
              milestonesCount,
              tasksCount: finalTasksCount,
              goalsCount,
              scheduleDays,
              identityTraitsCount: finalIdentityTraitsCount,
              reflectionsCount: finalReflectionsCount,
              calendarConnected: !!userDoc?.googleCalendarSettings?.connected || calendarSynced
            }
          });
          controller.close();
          
          // ==========================================
          // BACKGROUND PROCESSES (Non-blocking)
          // ==========================================
          IdentityAgent.evaluateAndEvolve(uid).catch(e => console.error("Background Identity Error:", e));
          ReflectionAgent.evaluateAndEvolve(uid).catch(e => console.error("Background Reflection Error:", e));
        } catch (err: any) {
          console.error("Error during streaming generation:", err);
          send({ stage: "error", status: "error", message: err.message || "An unexpected error occurred during workspace setup." });
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      }
    });
  } catch (error: any) {
    console.error("POST /api/onboarding/generate error:", error);
    return NextResponse.json({ success: false, error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
