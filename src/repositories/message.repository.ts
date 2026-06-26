import { dbConnect } from "@/lib/mongodb";
import { Conversation, IConversation } from "@/models/Conversation";
import { Message, IMessage, MessageRole } from "@/models/Message";
import { Types } from "mongoose";

/**
 * MessageRepository — CRUD for conversations and messages.
 * Manages both collections together as they are tightly coupled.
 */
export const MessageRepository = {
  // ─── Conversations ──────────────────────────────────────────────────────────

  /**
   * Create a new conversation for a user.
   */
  async createConversation(uid: string, title?: string): Promise<IConversation> {
    await dbConnect();
    const conv = await Conversation.create({
      firebaseUid: uid,
      title: title ?? "New Conversation",
      startedAt: new Date(),
    });
    return conv.toObject() as IConversation;
  },

  /**
   * Get all conversations for a user (most recent first).
   */
  async findConversationsByUser(uid: string): Promise<IConversation[]> {
    await dbConnect();
    return Conversation.find({ firebaseUid: uid })
      .sort({ startedAt: -1 })
      .lean() as Promise<IConversation[]>;
  },

  /**
   * Find a single conversation by _id.
   */
  async findConversationById(id: string): Promise<IConversation | null> {
    await dbConnect();
    if (!Types.ObjectId.isValid(id)) return null;
    return Conversation.findById(id).lean() as Promise<IConversation | null>;
  },

  /**
   * Close a conversation (set endedAt).
   */
  async closeConversation(id: string): Promise<void> {
    await dbConnect();
    if (!Types.ObjectId.isValid(id)) return;
    await Conversation.findByIdAndUpdate(id, { $set: { endedAt: new Date() } });
  },

  /**
   * Rename a conversation.
   */
  async renameConversation(id: string, title: string): Promise<IConversation | null> {
    await dbConnect();
    if (!Types.ObjectId.isValid(id)) return null;
    return Conversation.findByIdAndUpdate(
      id,
      { $set: { title } },
      { new: true }
    ).lean() as Promise<IConversation | null>;
  },

  /**
   * Delete a conversation and all its messages.
   */
  async deleteConversation(id: string): Promise<void> {
    await dbConnect();
    if (!Types.ObjectId.isValid(id)) return;
    const objectId = new Types.ObjectId(id);
    await Promise.all([
      Conversation.findByIdAndDelete(id),
      Message.deleteMany({ conversationId: objectId }),
    ]);
  },

  // ─── Messages ───────────────────────────────────────────────────────────────

  /**
   * Add a message to a conversation.
   */
  async addMessage(
    conversationId: string,
    role: MessageRole,
    content: string
  ): Promise<IMessage> {
    await dbConnect();
    if (!Types.ObjectId.isValid(conversationId)) {
      throw new Error(`Invalid conversationId: ${conversationId}`);
    }
    const msg = await Message.create({
      conversationId: new Types.ObjectId(conversationId),
      role,
      content,
    });
    return msg.toObject() as IMessage;
  },

  /**
   * Get all messages in a conversation (chronological order).
   */
  async findMessagesByConversation(conversationId: string): Promise<IMessage[]> {
    await dbConnect();
    if (!Types.ObjectId.isValid(conversationId)) return [];
    return Message.find({
      conversationId: new Types.ObjectId(conversationId),
    })
      .sort({ createdAt: 1 })
      .lean() as Promise<IMessage[]>;
  },

  /**
   * Get the N most recent messages in a conversation (for context window).
   */
  async findRecentMessages(conversationId: string, limit = 20): Promise<IMessage[]> {
    await dbConnect();
    if (!Types.ObjectId.isValid(conversationId)) return [];
    const messages = await Message.find({
      conversationId: new Types.ObjectId(conversationId),
    })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    return (messages as IMessage[]).reverse(); // return chronological order
  },

  /**
   * Delete a single message by _id.
   */
  async deleteMessage(id: string): Promise<void> {
    await dbConnect();
    if (!Types.ObjectId.isValid(id)) return;
    await Message.findByIdAndDelete(id);
  },
};
