import { dbConnect } from "@/lib/mongodb";
import { Plan, IPlan } from "@/models/Plan";
import { Milestone, IMilestone } from "@/models/Milestone";
import { Goal, IGoal } from "@/models/Goal";
import { Task, ITask } from "@/models/Task";
import { DailyAgenda, IDailyAgenda } from "@/models/DailyAgenda";
import { User } from "@/models/User";
import { Types } from "mongoose";

export interface ICurrentWorkspaceState {
  activePlan: IPlan | null;
  activeMilestone: IMilestone | null;
  activeGoals: IGoal[];
  todayAgenda: IDailyAgenda | null;
  highestPriority: string;
  upcomingDeadline: string;
  estimatedWorkload: string;
  calendarSynced: boolean;
}

export class CurrentStateService {
  /**
   * Resolves the user's current active workspace and derived details.
   */
  static async getCurrentState(uid: string): Promise<ICurrentWorkspaceState> {
    await dbConnect();

    // 1. Fetch user & resolve timezone
    const user = await User.findOne({ firebaseUid: uid }).lean();
    const timezone = user?.briefSettings?.timezone || "UTC";
    const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: timezone });

    // 2. Fetch active plan
    const activePlan = await Plan.findOne({ firebaseUid: uid, status: "active" })
      .sort({ updatedAt: -1 });

    let activeMilestone: IMilestone | null = null;
    let activeGoals: IGoal[] = [];
    let upcomingDeadline = "";

    if (activePlan) {
      // 3. Fetch active milestone
      const milestoneDoc = await Milestone.findOne({
        planId: activePlan._id,
        status: "in_progress"
      }) || await Milestone.findOne({
        planId: activePlan._id,
        status: "todo"
      }).sort({ priority: 1 });

      activeMilestone = milestoneDoc;

      // 4. Fetch active goals
      activeGoals = await Goal.find({ planId: activePlan._id, status: "active" });

      // 5. Fetch upcoming deadline constraint (Exams or Interviews)
      const hardConstraint = await Milestone.findOne({
        planId: activePlan._id,
        category: { $in: ["Exam", "Interview"] },
        status: { $in: ["todo", "in_progress"] }
      }).sort({ startDate: 1, priority: 1 });

      if (hardConstraint) {
        upcomingDeadline = `${hardConstraint.title} (${hardConstraint.startDate || "N/A"})`;
      }
    }

    // 6. Fetch today's agenda (fully populated)
    const todayAgenda = await DailyAgenda.findOne({ firebaseUid: uid, date: todayStr })
      .populate("workBlocks.tasks")
      .populate("optionalTasks")
      .populate("stretchGoals");

    // 7. Derive estimated workload (strictly from today's agenda)
    let estimatedFocusTime = 0;
    if (todayAgenda) {
      estimatedFocusTime = todayAgenda.estimatedFocusTime || 0;
    }
    const estimatedWorkload = `${(estimatedFocusTime / 60).toFixed(1)} hrs/day`;

    // 8. Derive highest priority
    let highestPriority = "General focus";
    if (todayAgenda) {
      highestPriority = todayAgenda.focus || todayAgenda.currentPriority || "General focus";
    } else if (activeMilestone) {
      highestPriority = activeMilestone.title;
    }

    // 9. Calendar connection status
    const calendarSynced = user?.googleCalendarSettings?.connected === true;

    return {
      activePlan,
      activeMilestone,
      activeGoals,
      todayAgenda,
      highestPriority,
      upcomingDeadline,
      estimatedWorkload,
      calendarSynced
    };
  }
}
