import { dbConnect } from "@/lib/mongodb";
import { Plan, IPlan } from "@/models/Plan";
import { Milestone, IMilestone } from "@/models/Milestone";
import { Goal, IGoal } from "@/models/Goal";
import { WeeklyExecutionSchedule, IWeeklyExecutionSchedule, IDaySchedule } from "@/models/WeeklyExecutionSchedule";
import { User } from "@/models/User";

export interface ICurrentWorkspaceState {
  activePlan: IPlan | null;
  activeMilestone: IMilestone | null;
  activeGoals: IGoal[];
  weeklySchedule: IWeeklyExecutionSchedule | null;
  todaySchedule: IDaySchedule | null;
  highestPriority: string;
  upcomingDeadline: string;
  estimatedWorkload: string;
  calendarSynced: boolean;
}

export class CurrentStateService {
  /**
   * Resolves the user's current active workspace and derived details from WeeklyExecutionSchedule.
   */
  static async getCurrentState(uid: string): Promise<ICurrentWorkspaceState> {
    await dbConnect();

    const user = await User.findOne({ firebaseUid: uid }).lean();
    const timezone = user?.briefSettings?.timezone || "UTC";
    const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: timezone });

    const activePlan = await Plan.findOne({ firebaseUid: uid, status: "active" })
      .sort({ updatedAt: -1 });

    let activeMilestone: IMilestone | null = null;
    let activeGoals: IGoal[] = [];
    let upcomingDeadline = "";
    let weeklySchedule: IWeeklyExecutionSchedule | null = null;
    let todaySchedule: IDaySchedule | null = null;
    let highestPriority = "General focus";
    let estimatedWorkload = "0 hrs/day";

    if (activePlan) {
      const milestoneDoc = await Milestone.findOne({
        planId: activePlan._id,
        status: "in_progress"
      }) || await Milestone.findOne({
        planId: activePlan._id,
        status: "todo"
      }).sort({ priority: 1 });

      activeMilestone = milestoneDoc;
      activeGoals = await Goal.find({ planId: activePlan._id, status: "active" });

      const hardConstraint = await Milestone.findOne({
        planId: activePlan._id,
        category: { $in: ["Exam", "Interview"] },
        status: { $in: ["todo", "in_progress"] }
      }).sort({ startDate: 1, priority: 1 });

      if (hardConstraint) {
        upcomingDeadline = `${hardConstraint.title} (${hardConstraint.startDate || "N/A"})`;
      }

      // Fetch the WeeklyExecutionSchedule instead of DailyAgenda
      weeklySchedule = await WeeklyExecutionSchedule.findOne({
        firebaseUid: uid,
        planId: activePlan._id,
        status: "ACTIVE"
      }).populate("days.workBlocks.tasks").lean() as IWeeklyExecutionSchedule;

      if (weeklySchedule) {
        todaySchedule = weeklySchedule.days.find((d) => d.date === todayStr) || null;
      }
      
      if (todaySchedule) {
        highestPriority = todaySchedule.focusTheme || "General focus";
        estimatedWorkload = todaySchedule.estimatedWorkload || "Light";
      } else if (activeMilestone) {
        highestPriority = activeMilestone.title;
      }
    }

    const calendarSynced = user?.googleCalendarSettings?.connected === true;

    return {
      activePlan,
      activeMilestone,
      activeGoals,
      weeklySchedule,
      todaySchedule,
      highestPriority,
      upcomingDeadline,
      estimatedWorkload,
      calendarSynced
    };
  }
}
