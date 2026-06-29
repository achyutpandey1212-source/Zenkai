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
          send({ stage: "life_model", status: "running", message: "Building your life model..." });

          if (name) {
            await UserRepository.updateName(uid, name);
          }

          const timezone = profile?.timezone || "UTC";
          await User.updateOne({ firebaseUid: uid }, { $set: { "briefSettings.timezone": timezone } });

          if (mode === "replace") {
            // Nuke existing data
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

          // Save Profile Document
          await ProfileRepository.upsert({
            firebaseUid: uid,
            profession: profile.profession || "Other",
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
          });

          // Insert goals
          if (goals && Array.isArray(goals)) {
            for (const g of goals) {
              await GoalRepository.create({
                firebaseUid: uid,
                title: g.title,
                priority: g.priority,
                status: "active",
              });
            }
          }

          // ==========================================
          // STEP 2: IMPORT PARSING & DATA INSERTION
          // ==========================================
          send({ stage: "import_data", status: "running", message: "Processing imported information..." });

          if (importedItems && Array.isArray(importedItems)) {
            for (const item of importedItems) {
              if (item.category === "Goal") {
                await GoalRepository.create({
                  firebaseUid: uid,
                  title: item.title,
                  description: item.description || "",
                  status: "active",
                });
              } else if (item.category === "Task") {
                await TaskRepository.create({
                  firebaseUid: uid,
                  title: item.title,
                  description: item.description || "",
                  status: "todo",
                  scheduledFor: item.date && !isNaN(Date.parse(item.date)) ? new Date(item.date) : undefined,
                });
              } else if (item.category === "Constraint") {
                const parsedDays = parseDaysFromText(item.date);
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

          // Seed starter memories from the onboarding profile so the agents have real context
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

          // ==========================================
          // STEP 3: IDENTITY SEED
          // ==========================================
          send({ stage: "identity_seed", status: "running", message: "Building your personal blueprint..." });
          try {
            await IdentityAgent.evaluateAndEvolve(uid);
          } catch (e) {
            console.error("Failed to evolve identity during onboarding:", e);
          }

          // ==========================================
          // STEP 4: REFLECTION SEED
          // ==========================================
          send({ stage: "reflection_seed", status: "running", message: "Setting up reflection space..." });
          try {
            await ReflectionAgent.evaluateAndEvolve(uid);
          } catch (e) {
            console.error("Failed to evolve reflection during onboarding:", e);
          }

          // ==========================================
          // STEP 5: ROADMAP (PLAN GENERATION)
          // ==========================================
          send({ stage: "roadmap", status: "running", message: "Creating your roadmap..." });
          const primaryGoal = profile.longTermGoal || (goals && goals.length > 0 ? goals[0].title : "Success");
          const planIntent: any = {
            type: "create_or_modify",
            planType: "personal",
            goalTitle: primaryGoal,
          };
          
          let activePlanId = "";
          try {
            const planResult = await PlanningAgent.generateOrEvolvePlan(
              uid,
              planIntent,
              `Generate initial plan roadmap for: ${primaryGoal}`
            );
            
            // Fetch active plan
            const activePlan = await PlanRepository.findActivePlanTree(uid);
            if (activePlan) {
              activePlanId = activePlan.id || activePlan._id?.toString();
            }
          } catch (e) {
            console.error("Failed to generate plan during onboarding:", e);
          }

          // ==========================================
          // STEP 6: WEEKLY SCHEDULE
          // ==========================================
          send({ stage: "weekly_schedule", status: "running", message: "Designing your weekly schedule..." });
          if (activePlanId) {
            try {
              await PlanningAgent.generateWeeklySchedule(uid, activePlanId);
            } catch (e) {
              console.error("Failed to generate weekly schedule during onboarding:", e);
            }
          } else {
            console.warn("Skipping weekly schedule generation: No active plan found");
          }

          // ==========================================
          // STEP 7: CALENDAR SYNC
          // ==========================================
          send({ stage: "calendar_sync", status: "running", message: "Preparing calendar synchronization..." });
          const userDoc = await User.findOne({ firebaseUid: uid }).lean();
          if (userDoc?.googleCalendarSettings?.connected && activePlanId) {
            try {
              // Trigger sync
              const origin = new URL(request.url).origin;
              await fetch(`${origin}/api/auth/google/sync`, {
                method: "POST",
                headers: {
                  Cookie: `session=${sessionToken}`
                }
              });
            } catch (e) {
              console.error("Calendar sync trigger failed during onboarding:", e);
            }
          }

          // Mark onboarding completed in database
          await UserRepository.markOnboardingComplete(uid);

          send({ stage: "complete", status: "success", message: "Welcome to Zenkai. Workspace generated successfully!" });
          controller.close();
        } catch (err: any) {
          console.error("Error during streaming generation:", err);
          send({ stage: "error", status: "error", message: err.message || "An unexpected error occurred." });
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
