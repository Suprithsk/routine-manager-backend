import { Router } from "express";
import {
  createHabit,
  getHabits,
  updateHabit,
  deleteHabit,
  logHabit,
  unlogHabit,
} from "../controllers/habitController";
import { validate } from "../middleware/validate";
import { authenticate } from "../middleware/auth";
import { createHabitSchema, updateHabitSchema } from "../schemas/habit.schema";

const router = Router();

// All routes require authentication
router.use(authenticate);

// Habit CRUD
router.put("/:id", validate(updateHabitSchema), updateHabit);
router.delete("/:id", deleteHabit);

// Habit logging
router.post("/:id/log", logHabit);
router.delete("/:id/log/:date", unlogHabit);

export default router;