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
import { validate } from "../middleware/validate";
import { authenticate, adminOnly } from "../middleware/auth";
import { writeLimiter } from "../middleware/rateLimiter";
import {
  createChallengeSchema,
  updateChallengeSchema,
} from "../schemas/challenge.schema";
import { joinChallengeSchema } from "../schemas/userChallenge.schema";

const router = Router();

// Public routes
router.get("/", getAllChallenges);
router.get("/:id", getChallengeById);

// User routes (authenticated)
router.post("/:id/join", authenticate, writeLimiter, validate(joinChallengeSchema), joinChallenge);
router.delete("/:id/leave", authenticate, leaveChallenge);

// Admin-only routes
router.post("/", authenticate, adminOnly, validate(createChallengeSchema), createChallenge);
router.put("/:id", authenticate, adminOnly, validate(updateChallengeSchema), updateChallenge);
router.delete("/:id", authenticate, adminOnly, deleteChallenge);
router.get("/:id/stats", authenticate, adminOnly, getChallengeStats);

export default router;