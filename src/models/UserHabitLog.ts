import { Schema, model, Document, Types } from "mongoose";

export interface IUserHabitLog extends Document {
  _id: Types.ObjectId;
  userHabit_id: Types.ObjectId;
  dateCompleted: Date;
}

const userHabitLogSchema = new Schema<IUserHabitLog>({
  userHabit_id: { type: Schema.Types.ObjectId, ref: "UserHabit", required: true },
  dateCompleted: { type: Date, required: true },
});

// Prevent duplicate completion for the same day
userHabitLogSchema.index({ userHabit_id: 1, dateCompleted: 1 }, { unique: true });

export default model<IUserHabitLog>("UserHabitLog", userHabitLogSchema);
