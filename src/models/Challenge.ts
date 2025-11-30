import { Schema, model, Document, Types } from "mongoose";

export interface IChallenge extends Document {
  _id: Types.ObjectId;
  title: string;
  description?: string;
  durationDays: number;
  createdAt: Date;
}

const challengeSchema = new Schema<IChallenge>({
  title: { type: String, required: true },
  description: String,
  durationDays: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now }
});

export default model<IChallenge>("Challenge", challengeSchema);
