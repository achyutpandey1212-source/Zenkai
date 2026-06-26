import mongoose, { Schema, Model, Document } from "mongoose";

/**
 * Conversation — a chat session container.
 * Collection: conversations
 */
export interface IConversation extends Document {
  firebaseUid: string;    // FK → users.firebaseUid
  title?: string;
  startedAt: Date;
  endedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ConversationSchema = new Schema<IConversation>(
  {
    firebaseUid: { type: String, required: true, index: true },
    title: { type: String, default: "New Conversation" },
    startedAt: { type: Date, default: Date.now },
    endedAt: { type: Date },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: "conversations",
  }
);

export const Conversation: Model<IConversation> =
  mongoose.models.Conversation ||
  mongoose.model<IConversation>("Conversation", ConversationSchema);
