import mongoose, { Schema, Model, Document, Types } from "mongoose";

/**
 * Message — individual messages within a conversation.
 * Messages are raw conversation data, NOT memory.
 * Collection: messages
 */

export type MessageRole = "user" | "assistant" | "system";

export interface IMessage extends Document {
  conversationId: Types.ObjectId;  // FK → conversations._id
  role: MessageRole;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

const MessageSchema = new Schema<IMessage>(
  {
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
      index: true,
    },
    role: {
      type: String,
      enum: ["user", "assistant", "system"],
      required: true,
    },
    content: { type: String, required: true },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: "messages",
  }
);

export const Message: Model<IMessage> =
  mongoose.models.Message ||
  mongoose.model<IMessage>("Message", MessageSchema);
