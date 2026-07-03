import { dbConnect } from "@/lib/mongodb";
import { PendingActionModel, type PendingAction, type PendingActionPayload } from "@/models/PendingAction";
import { Types } from "mongoose";

const PENDING_ACTION_TTL_MS = 10 * 60 * 1000;

function isExpired(action: PendingAction | null): boolean {
  if (!action) return true;
  return new Date() > action.expiresAt;
}

export const PendingActionService = {
  async create(
    conversationId: string,
    type: string,
    payload: PendingActionPayload
  ): Promise<PendingAction> {
    await dbConnect();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + PENDING_ACTION_TTL_MS);

    const doc = await PendingActionModel.create({
      conversationId: new Types.ObjectId(conversationId),
      type,
      payload,
      createdAt: now,
      expiresAt,
    });

    return {
      type: doc.type,
      payload: doc.payload as PendingActionPayload,
      createdAt: doc.createdAt,
      expiresAt: doc.expiresAt,
    };
  },

  async getActive(conversationId: string): Promise<PendingAction | null> {
    await dbConnect();
    if (!Types.ObjectId.isValid(conversationId)) return null;

    const doc = await PendingActionModel.findOne({
      conversationId: new Types.ObjectId(conversationId),
    }).lean();

    if (!doc) return null;

    const action: PendingAction = {
      type: doc.type,
      payload: doc.payload as PendingActionPayload,
      createdAt: doc.createdAt,
      expiresAt: doc.expiresAt,
    };

    if (isExpired(action)) {
      await PendingActionModel.deleteOne({ _id: doc._id });
      return null;
    }

    return action;
  },

  async clear(conversationId: string): Promise<void> {
    await dbConnect();
    if (!Types.ObjectId.isValid(conversationId)) return;
    await PendingActionModel.deleteMany({
      conversationId: new Types.ObjectId(conversationId),
    });
  },

  isExpired,
};