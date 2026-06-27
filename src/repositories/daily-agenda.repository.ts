import { dbConnect } from "@/lib/mongodb";
import { DailyAgenda, IDailyAgenda } from "@/models/DailyAgenda";
import { Types } from "mongoose";

export const DailyAgendaRepository = {
  /**
   * Find a user's daily agenda for a specific date (YYYY-MM-DD).
   * Populates the referenced Tasks.
   */
  async findByUserAndDate(uid: string, dateStr: string): Promise<IDailyAgenda | null> {
    await dbConnect();
    return DailyAgenda.findOne({ firebaseUid: uid, date: dateStr })
      .populate("workBlocks.tasks")
      .populate("optionalTasks")
      .populate("stretchGoals")
      .exec();
  },

  /**
   * Find a daily agenda by its ID.
   */
  async findById(id: string): Promise<IDailyAgenda | null> {
    await dbConnect();
    if (!Types.ObjectId.isValid(id)) return null;
    return DailyAgenda.findById(id)
      .populate("workBlocks.tasks")
      .populate("optionalTasks")
      .populate("stretchGoals")
      .exec();
  },

  /**
   * Create a new Daily Agenda.
   */
  async create(data: Partial<IDailyAgenda>): Promise<IDailyAgenda> {
    await dbConnect();
    const agenda = await DailyAgenda.create(data);
    return agenda.toObject() as IDailyAgenda;
  },

  /**
   * Update an existing Daily Agenda.
   */
  async update(id: string, data: Partial<IDailyAgenda>): Promise<IDailyAgenda | null> {
    await dbConnect();
    if (!Types.ObjectId.isValid(id)) return null;
    return DailyAgenda.findByIdAndUpdate(
      id,
      { $set: data },
      { returnDocument: "after" }
    )
      .populate("workBlocks.tasks")
      .populate("optionalTasks")
      .populate("stretchGoals")
      .exec();
  },

  /**
   * Save (upsert) an agenda based on user ID and date.
   */
  async saveAgenda(uid: string, dateStr: string, data: Partial<IDailyAgenda>): Promise<IDailyAgenda> {
    await dbConnect();
    const agenda = await DailyAgenda.findOneAndUpdate(
      { firebaseUid: uid, date: dateStr },
      { $set: data },
      { upsert: true, new: true }
    )
      .populate("workBlocks.tasks")
      .populate("optionalTasks")
      .populate("stretchGoals")
      .exec();
    return agenda;
  },

  /**
   * Delete an agenda.
   */
  async delete(id: string): Promise<void> {
    await dbConnect();
    if (!Types.ObjectId.isValid(id)) return;
    await DailyAgenda.findByIdAndDelete(id);
  },

  /**
   * Delete all agendas for a user.
   */
  async deleteAllByUser(uid: string): Promise<void> {
    await dbConnect();
    await DailyAgenda.deleteMany({ firebaseUid: uid });
  }
};
