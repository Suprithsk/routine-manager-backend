import { Schema, model, Document, Types } from "mongoose";

export interface IHabitLog extends Document {
  _id: Types.ObjectId;
  habit_id: Types.ObjectId;
  dateCompleted: Date;
}

const habitLogSchema = new Schema<IHabitLog>({
  habit_id: { type: Schema.Types.ObjectId, ref: "Habit", required: true },
  dateCompleted: { type: Date, required: true }
});

// Prevent duplicate entries for same day
habitLogSchema.index({ habit_id: 1, dateCompleted: 1 }, { unique: true });

export default model<IHabitLog>("HabitLog", habitLogSchema);
