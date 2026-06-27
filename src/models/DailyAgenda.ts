import mongoose, { Schema, Model, Document, Types } from "mongoose";

export interface IDailyAgenda extends Document {
  firebaseUid: string;
  date: string; // YYYY-MM-DD
  intention: string;
  focus: string;
  workBlocks: Array<{
    title: string;
    startTime: string; // e.g. "09:00"
    endTime: string; // e.g. "10:30"
    tasks: Types.ObjectId[]; // references to Tasks
  }>;
  optionalTasks: Types.ObjectId[]; // references to Tasks
  stretchGoals: Types.ObjectId[]; // references to Tasks
  estimatedFocusTime: number; // minutes
  currentPriority: string;
  upcomingDeadline: string;
  executionReasoning: string;
  deferredExplanation?: string;
  diagnostics?: {
    priorityCalculations?: string;
    constraintEvaluation?: string;
    deferredLogic?: string;
    workBlockGeneration?: string;
    executionTimeMs?: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

const DailyAgendaSchema = new Schema<IDailyAgenda>(
  {
    firebaseUid: { type: String, required: true, index: true },
    date: { type: String, required: true, index: true },
    intention: { type: String, required: true },
    focus: { type: String, required: true },
    workBlocks: [
      {
        title: { type: String, required: true },
        startTime: { type: String, required: true },
        endTime: { type: String, required: true },
        tasks: [{ type: Schema.Types.ObjectId, ref: "Task" }],
      },
    ],
    optionalTasks: [{ type: Schema.Types.ObjectId, ref: "Task" }],
    stretchGoals: [{ type: Schema.Types.ObjectId, ref: "Task" }],
    estimatedFocusTime: { type: Number, default: 0 },
    currentPriority: { type: String, default: "" },
    upcomingDeadline: { type: String, default: "" },
    executionReasoning: { type: String, default: "" },
    deferredExplanation: { type: String, default: "" },
    diagnostics: {
      priorityCalculations: { type: String, default: "" },
      constraintEvaluation: { type: String, default: "" },
      deferredLogic: { type: String, default: "" },
      workBlockGeneration: { type: String, default: "" },
      executionTimeMs: { type: Number, default: 0 },
    },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: "daily_agendas",
  }
);

// Compound index on firebaseUid and date to ensure uniqueness per user per day
DailyAgendaSchema.index({ firebaseUid: 1, date: 1 }, { unique: true });

export const DailyAgenda: Model<IDailyAgenda> =
  mongoose.models.DailyAgenda || mongoose.model<IDailyAgenda>("DailyAgenda", DailyAgendaSchema);
