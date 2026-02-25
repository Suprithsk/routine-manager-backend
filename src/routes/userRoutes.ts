import { Router } from "express";
import { getPublicProfile } from "../controllers/userProfileController";

const router = Router();

// Public — no auth required
router.get("/:userId/profile", getPublicProfile);

export default router;
