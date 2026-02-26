import { Router } from "express";
import {
  createUserHabit,
  getUserHabits,
  getUserHabitById,
  updateUserHabit,
  deleteUserHabit,
  archiveUserHabit,
  logUserHabit,
  unlogUserHabit,
  getUserHabitAnalytics,
  getUserHabitsSummary,
} from "../controllers/userHabitController";
import { validate } from "../middleware/validate";
import { authenticate } from "../middleware/auth";
import {
  createUserHabitSchema,
  updateUserHabitSchema,
  logUserHabitSchema,
} from "../schemas/userHabit.schema";

const router = Router();

router.use(authenticate);

// Summary of all habits (must be before /:id routes)
router.get("/analytics/summary", getUserHabitsSummary);

// CRUD
router.get("/", getUserHabits);
router.post("/", validate(createUserHabitSchema), createUserHabit);
router.get("/:id", getUserHabitById);
router.put("/:id", validate(updateUserHabitSchema), updateUserHabit);
router.delete("/:id", deleteUserHabit);
router.patch("/:id/archive", archiveUserHabit);

// Logging
router.post("/:id/log", validate(logUserHabitSchema), logUserHabit);
router.delete("/:id/log/:date", unlogUserHabit);

// Analytics per habit
router.get("/:id/analytics", getUserHabitAnalytics);

export default router;
