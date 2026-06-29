import { WeeklyExecutionSchedule, IDaySchedule } from "@/models/WeeklyExecutionSchedule";
import { PlanRepository } from "@/repositories/plan.repository";
import { PlanningAgent } from "@/agents/planning-agent";

export class ExecutionAgent {
  /**
   * Fetches today's exact schedule block from the WeeklyExecutionSchedule.
   * Does NOT generate anything. Fully deterministic.
   */
  static async getDailySchedule(uid: string, dateStr: string): Promise<IDaySchedule | null> {
    const schedule = await WeeklyExecutionSchedule.findOne({
      firebaseUid: uid,
      status: "ACTIVE"
    }).lean();

    if (!schedule) return null;

    const todayBlock = schedule.days.find(d => d.date === dateStr);
    return todayBlock || null;
  }

  /**
   * Called when tasks are manually added or deferred.
   * We re-trigger a weekly replan under the hood (Phase 15B architecture).
   */
  static async rebalanceAgenda(uid: string, dateStr: string) {
    console.log(`[ExecutionAgent] Rebalancing weekly schedule for user ${uid}`);
    
    // Find the active plan
    const activePlans = await PlanRepository.findFullTree(uid);
    if (!activePlans || activePlans.length === 0) return null;
    
    const activePlan = activePlans[0];
    
    // Trigger Weekly Planning logic to rewrite the week
    await PlanningAgent.generateWeeklySchedule(uid, activePlan._id.toString());
  }
}
