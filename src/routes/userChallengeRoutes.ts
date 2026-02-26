import { Router } from "express";
import {
  joinChallenge,
  leaveChallenge,
  getMyChallenges,
  getMyChallengeProgress,
} from "../controllers/userChallengeController";
import {
  createHabit,
  getHabits,
} from "../controllers/habitController";
import { validate } from "../middleware/validate";
import { authenticate } from "../middleware/auth";
import { joinChallengeSchema } from "../schemas/userChallenge.schema";
import { createHabitSchema } from "../schemas/habit.schema";

const router = Router();

// All routes require authentication
router.use(authenticate);

// User challenge routes
router.get("/", getMyChallenges);
router.get("/:userChallengeId", getMyChallengeProgress);

// Habit routes scoped to a specific enrollment
router.get("/:userChallengeId/habits", getHabits);
router.post("/:userChallengeId/habits", validate(createHabitSchema), createHabit);

export default router;