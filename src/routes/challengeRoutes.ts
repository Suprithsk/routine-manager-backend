import { Router } from "express";
import {
  getAllChallenges,
  getChallengeById,
  createChallenge,
  updateChallenge,
  deleteChallenge,
  getChallengeStats,
} from "../controllers/challengeController";
import {
  joinChallenge,
  leaveChallenge,
} from "../controllers/userChallengeController";
import {
  createHabit,
  getHabits,
} from "../controllers/habitController";
import { validate } from "../middleware/validate";
import { authenticate, adminOnly } from "../middleware/auth";
import {
  createChallengeSchema,
  updateChallengeSchema,
} from "../schemas/challenge.schema";
import { joinChallengeSchema } from "../schemas/userChallenge.schema";
import { createHabitSchema } from "../schemas/habit.schema";

const router = Router();

// Public routes
router.get("/", getAllChallenges);
router.get("/:id", getChallengeById);

// User routes (authenticated)
router.post("/:id/join", authenticate, validate(joinChallengeSchema), joinChallenge);
router.delete("/:id/leave", authenticate, leaveChallenge);
router.get("/:challengeId/habits", authenticate, getHabits);
router.post("/:challengeId/habits", authenticate, validate(createHabitSchema), createHabit);

// Admin-only routes
router.post("/", authenticate, adminOnly, validate(createChallengeSchema), createChallenge);
router.put("/:id", authenticate, adminOnly, validate(updateChallengeSchema), updateChallenge);
router.delete("/:id", authenticate, adminOnly, deleteChallenge);
router.get("/:id/stats", authenticate, adminOnly, getChallengeStats);

export default router;