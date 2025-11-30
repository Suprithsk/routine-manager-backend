import { Schema, model, Document, Types } from "mongoose";

export interface IHabit extends Document {
  _id: Types.ObjectId;
  user_id: Types.ObjectId;         // owner
  challenge_id: Types.ObjectId;    // challenge this habit belongs to
  title: string;                   // habit name
  createdAt: Date;
}

const habitSchema = new Schema<IHabit>({
  user_id: { type: Schema.Types.ObjectId, ref: "User", required: true },
  challenge_id: { type: Schema.Types.ObjectId, ref: "Challenge", required: true },
  title: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

export default model<IHabit>("Habit", habitSchema);
