import { Router } from "express";
import {
  joinChallenge,
  leaveChallenge,
  getMyChallenges,
  getMyChallengeProgress,
} from "../controllers/userChallengeController";
import { validate } from "../middleware/validate";
import { authenticate } from "../middleware/auth";
import { joinChallengeSchema } from "../schemas/userChallenge.schema";

const router = Router();

// All routes require authentication
router.use(authenticate);

// User challenge routes
router.get("/", getMyChallenges);
router.get("/:challengeId", getMyChallengeProgress);

export default router;