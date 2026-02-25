import { Schema, model, Document, Types } from "mongoose";

export interface IUserHabit extends Document {
  _id: Types.ObjectId;
  user_id: Types.ObjectId;
  title: string;
  description?: string;
  color?: string;        // optional UI color tag
  isArchived: boolean;
  createdAt: Date;
}

const userHabitSchema = new Schema<IUserHabit>({
  user_id: { type: Schema.Types.ObjectId, ref: "User", required: true },
  title: { type: String, required: true },
  description: { type: String },
  color: { type: String },
  isArchived: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

// A user cannot have two active habits with the same title
userHabitSchema.index(
  { user_id: 1, title: 1 },
  {
    unique: true,
    partialFilterExpression: { isArchived: false },
  }
);

export default model<IUserHabit>("UserHabit", userHabitSchema);
