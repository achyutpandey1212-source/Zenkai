import { dbConnect } from "@/lib/mongodb";
import { Milestone, IMilestone, MilestoneStatus } from "@/models/Milestone";
import { Types } from "mongoose";

export type MilestoneCreateInput = {
  planId: string;
  firebaseUid: string;
  title: string;
  description?: string;
  status?: MilestoneStatus;
  priority?: number;
  estimatedDuration?: string;
};

export type MilestoneUpdateInput = Partial<Omit<MilestoneCreateInput, "firebaseUid" | "planId">>;

export const MilestoneRepository = {
  async findAllByPlan(planId: string): Promise<IMilestone[]> {
    await dbConnect();
    if (!Types.ObjectId.isValid(planId)) return [];
    return Milestone.find({ planId: new Types.ObjectId(planId) })
      .sort({ priority: 1 })
      .lean() as Promise<IMilestone[]>;
  },

  async findById(id: string): Promise<IMilestone | null> {
    await dbConnect();
    if (!Types.ObjectId.isValid(id)) return null;
    return Milestone.findById(id).lean() as Promise<IMilestone | null>;
  },

  async create(data: MilestoneCreateInput): Promise<IMilestone> {
    await dbConnect();
    const milestone = await Milestone.create({
      ...data,
      planId: new Types.ObjectId(data.planId)
    });
    return milestone.toObject() as IMilestone;
  },

  async update(id: string, data: MilestoneUpdateInput): Promise<IMilestone | null> {
    await dbConnect();
    if (!Types.ObjectId.isValid(id)) return null;
    return Milestone.findByIdAndUpdate(id, { $set: data }, { returnDocument: "after" }).lean() as Promise<IMilestone | null>;
  },

  async delete(id: string): Promise<void> {
    await dbConnect();
    if (!Types.ObjectId.isValid(id)) return;
    await Milestone.findByIdAndDelete(id);
  }
};
