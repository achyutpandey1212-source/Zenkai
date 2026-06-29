import { dbConnect } from "@/lib/mongodb";
import { Plan, IPlan, PlanStatus } from "@/models/Plan";
import { Milestone } from "@/models/Milestone";
import { Goal } from "@/models/Goal";
import { Task } from "@/models/Task";
import { Types } from "mongoose";

export type PlanCreateInput = {
  firebaseUid: string;
  title: string;
  description?: string;
  status?: PlanStatus;
  priority?: number;
  estimatedDuration?: string;
  type?: string;
  diagnostics?: {
    planningPrompt: string;
    rawGeminiOutput: string;
    normalizedPlan: string;
    executionTimeMs: number;
  };
};

export type PlanUpdateInput = Partial<Omit<PlanCreateInput, "firebaseUid">>;

export const PlanRepository = {
  async findAllByUser(uid: string): Promise<IPlan[]> {
    await dbConnect();
    return Plan.find({ firebaseUid: uid })
      .sort({ priority: 1, createdAt: -1 })
      .lean() as Promise<IPlan[]>;
  },

  async findActiveByUser(uid: string): Promise<IPlan[]> {
    await dbConnect();
    return Plan.find({ firebaseUid: uid, status: "active" })
      .sort({ priority: 1 })
      .lean() as Promise<IPlan[]>;
  },

  async findById(id: string): Promise<IPlan | null> {
    await dbConnect();
    if (!Types.ObjectId.isValid(id)) return null;
    return Plan.findById(id).lean() as Promise<IPlan | null>;
  },

  async create(data: PlanCreateInput): Promise<IPlan> {
    await dbConnect();
    const plan = await Plan.create(data);
    return plan.toObject() as IPlan;
  },

  async update(id: string, data: PlanUpdateInput): Promise<IPlan | null> {
    await dbConnect();
    if (!Types.ObjectId.isValid(id)) return null;
    return Plan.findByIdAndUpdate(id, { $set: data }, { returnDocument: "after" }).lean() as Promise<IPlan | null>;
  },

  async delete(id: string): Promise<void> {
    await dbConnect();
    if (!Types.ObjectId.isValid(id)) return;
    
    // Also delete linked milestones, goals, tasks recursively
    const milestones = await Milestone.find({ planId: new Types.ObjectId(id) });
    for (const m of milestones) {
      const goals = await Goal.find({ milestoneId: m._id });
      for (const g of goals) {
        await Task.deleteMany({ goalId: g._id });
      }
      await Goal.deleteMany({ milestoneId: m._id });
    }
    await Milestone.deleteMany({ planId: new Types.ObjectId(id) });
    await Plan.findByIdAndDelete(id);
  },

  async findActivePlanTree(uid: string): Promise<any | null> {
    await dbConnect();
    const activePlan = await Plan.findOne({ firebaseUid: uid, status: "active" }).lean();
    if (!activePlan) return null;

    const planId = activePlan._id;
    const [milestones, goals] = await Promise.all([
      Milestone.find({ planId }).sort({ priority: 1 }).lean(),
      Goal.find({ planId }).sort({ priority: 1 }).lean()
    ]);

    const goalIds = goals.map(g => g._id);
    const tasks = goalIds.length > 0
      ? await Task.find({ goalId: { $in: goalIds } }).sort({ priority: 1 }).lean()
      : [];

    // Assemble the hierarchical structure in-memory
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const goalsMap = new Map<string, any>(
      goals.map(g => [g._id.toString(), { ...g, id: g._id.toString(), tasks: [] }])
    );
    tasks.forEach(t => {
      if (t.goalId) {
        const g = goalsMap.get(t.goalId.toString());
        if (g) g.tasks.push({ ...t, id: t._id.toString() });
      }
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const milestonesMap = new Map<string, any>(
      milestones.map(m => [m._id.toString(), { ...m, id: m._id.toString(), goals: [] }])
    );
    Array.from(goalsMap.values()).forEach(g => {
      if (g.milestoneId) {
        const m = milestonesMap.get(g.milestoneId.toString());
        if (m) m.goals.push(g);
      }
    });

    return {
      ...activePlan,
      id: planId.toString(),
      milestones: Array.from(milestonesMap.values())
    };
  },

  async findFullTree(uid: string): Promise<any[]> {
    await dbConnect();
    const plans = await Plan.find({ firebaseUid: uid }).sort({ createdAt: -1 });
    const fullTree = [];

    for (const plan of plans) {
      const milestones = await Milestone.find({ planId: plan._id }).sort({ priority: 1 });
      const milestoneTrees = [];

      for (const milestone of milestones) {
        const goals = await Goal.find({ milestoneId: milestone._id }).sort({ priority: 1 });
        const goalTrees = [];

        for (const goal of goals) {
          const tasks = await Task.find({ goalId: goal._id }).sort({ priority: 1 });
          goalTrees.push({
            ...goal.toObject(),
            tasks: tasks.map(t => t.toObject())
          });
        }

        milestoneTrees.push({
          ...milestone.toObject(),
          goals: goalTrees
        });
      }

      fullTree.push({
        ...plan.toObject(),
        milestones: milestoneTrees
      });
    }

    return fullTree;
  }
};
