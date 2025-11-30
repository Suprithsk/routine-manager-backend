import { Schema, model, Document, Types } from "mongoose";

export type ChallengeStatus = "active" | "completed" | "failed";

export interface IUserChallenge extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  challengeId: Types.ObjectId;
  startDate: Date;
  status: ChallengeStatus;
  progress: {
    completedDays: number;
    currentStreak: number;
    lastCompletedDate?: Date;
  };
  completedOn?: Date;
  createdAt: Date;
}

const userChallengeSchema = new Schema<IUserChallenge>({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  challengeId: { type: Schema.Types.ObjectId, ref: "Challenge", required: true },
  startDate: { type: Date, default: Date.now },
  status: { type: String, enum: ["active", "completed", "failed"], default: "active" },
  progress: {
    completedDays: { type: Number, default: 0 },
    currentStreak: { type: Number, default: 0 },
    lastCompletedDate: Date,
  },
  completedOn: Date,
  createdAt: { type: Date, default: Date.now },
});

userChallengeSchema.index({ userId: 1, challengeId: 1 }, { unique: true });

export default model<IUserChallenge>("UserChallenge", userChallengeSchema);
