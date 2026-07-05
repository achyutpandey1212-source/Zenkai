import mongoose, { Schema, Model, Document, Types } from "mongoose";
import type { ScheduleOperation } from "@/agents/planning-agent";

export type PendingActionPayload = {
  scheduleOperation?: ScheduleOperation;
  taskOperation?: {
    taskId: string;
    action: "complete" | "skip" | "delete";
  };
  emailOperation?: {
    to: string;
    subject: string;
    body: string;
  };
  paymentOperation?: {
    amount: number;
    currency: string;
    description: string;
  };
} & Record<string, unknown>;

export type PendingAction = {
  type: string;
  payload: PendingActionPayload;
  createdAt: Date;
  expiresAt: Date;
};

export interface IPendingAction extends Document {
  conversationId: Types.ObjectId;
  type: string;
  payload: PendingActionPayload;
  createdAt: Date;
  expiresAt: Date;
}

const PendingActionSchema = new Schema<IPendingAction>(
  {
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
      index: true,
    },
    type: { type: String, required: true, index: true },
    payload: { type: Schema.Types.Mixed, required: true },
    createdAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: "pending_actions",
  }
);

PendingActionSchema.index({ conversationId: 1, type: 1 });

export const PendingActionModel: Model<IPendingAction> =
  mongoose.models.PendingAction ||
  mongoose.model<IPendingAction>("PendingAction", PendingActionSchema);

export function isPendingActionExpired(action: PendingAction | null): boolean {
  if (!action) return true;
  return new Date() > action.expiresAt;
}