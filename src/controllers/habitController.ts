import { Response } from "express";
import Habit from "../models/Habit";
import HabitLog from "../models/HabitLog";
import UserChallenge from "../models/UserChallenge";
import Challenge from "../models/Challenge";
import { AuthRequest } from "../middleware/auth";
import { CreateHabitInput, UpdateHabitInput } from "../schemas/habit.schema";

// POST /api/challenges/:challengeId/habits - Create habit in a challenge
export const createHabit = async (req: AuthRequest, res: Response) => {
  try {
    const { challengeId } = req.params;
    const userId = req.user!._id;
    const { title } = req.body as CreateHabitInput;

    // Check if user is enrolled in this challenge
    const userChallenge = await UserChallenge.findOne({ userId, challengeId });
    if (!userChallenge) {
      return res.status(403).json({ error: "You must join the challenge first" });
    }

    if (userChallenge.status !== "active") {
      return res.status(400).json({ error: "Cannot add habits to a completed or failed challenge" });
    }

    // Check for duplicate habit title
    const existingHabit = await Habit.findOne({
      user_id: userId,
      challenge_id: challengeId,
      title: { $regex: new RegExp(`^${title}$`, "i") },
    });

    if (existingHabit) {
      return res.status(409).json({ error: "You already have a habit with this title" });
    }

    const habit = await Habit.create({
      user_id: userId,
      challenge_id: challengeId,
      title,
    });

    res.status(201).json({
      message: "Habit created successfully",
      habit: {
        id: habit._id,
        title: habit.title,
        challengeId: habit.challenge_id,
        createdAt: habit.createdAt,
      },
    });
  } catch (error) {
    console.error("CreateHabit error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// GET /api/challenges/:challengeId/habits - Get user's habits in a challenge
export const getHabits = async (req: AuthRequest, res: Response) => {
  try {
    const { challengeId } = req.params;
    const userId = req.user!._id;

    // Check if user is enrolled
    const userChallenge = await UserChallenge.findOne({ userId, challengeId });
    if (!userChallenge) {
      return res.status(403).json({ error: "You must join the challenge first" });
    }

    const habits = await Habit.find({ user_id: userId, challenge_id: challengeId })
      .sort({ createdAt: 1 });

    // Get today's completion status
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayLogs = await HabitLog.find({
      habit_id: { $in: habits.map(h => h._id) },
      dateCompleted: { $gte: today, $lt: tomorrow },
    });

    const habitsWithStatus = habits.map(habit => ({
      id: habit._id,
      title: habit.title,
      completedToday: todayLogs.some(log => log.habit_id.toString() === habit._id.toString()),
      createdAt: habit.createdAt,
    }));

    res.json({ habits: habitsWithStatus });
  } catch (error) {
    console.error("GetHabits error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// PUT /api/habits/:id - Update habit
export const updateHabit = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!._id;
    const { title } = req.body as UpdateHabitInput;

    const habit = await Habit.findById(id);
    if (!habit) {
      return res.status(404).json({ error: "Habit not found" });
    }

    if (habit.user_id.toString() !== userId.toString()) {
      return res.status(403).json({ error: "Not authorized to update this habit" });
    }

    // Check for duplicate title if title is being changed
    if (title && title !== habit.title) {
      const existingHabit = await Habit.findOne({
        user_id: userId,
        challenge_id: habit.challenge_id,
        title: { $regex: new RegExp(`^${title}$`, "i") },
        _id: { $ne: id },
      });

      if (existingHabit) {
        return res.status(409).json({ error: "You already have a habit with this title" });
      }
    }

    const updatedHabit = await Habit.findByIdAndUpdate(
      id,
      { $set: { title } },
      { new: true }
    );

    res.json({
      message: "Habit updated successfully",
      habit: {
        id: updatedHabit!._id,
        title: updatedHabit!.title,
        challengeId: updatedHabit!.challenge_id,
        createdAt: updatedHabit!.createdAt,
      },
    });
  } catch (error) {
    console.error("UpdateHabit error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// DELETE /api/habits/:id - Delete habit
export const deleteHabit = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!._id;

    const habit = await Habit.findById(id);
    if (!habit) {
      return res.status(404).json({ error: "Habit not found" });
    }

    if (habit.user_id.toString() !== userId.toString()) {
      return res.status(403).json({ error: "Not authorized to delete this habit" });
    }

    // Delete associated logs
    await HabitLog.deleteMany({ habit_id: id });

    // Delete habit
    await Habit.findByIdAndDelete(id);

    res.json({ message: "Habit deleted successfully" });
  } catch (error) {
    console.error("DeleteHabit error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// POST /api/habits/:id/log - Mark habit complete for today
export const logHabit = async (req: AuthRequest, res: Response) => {
  try {
    const { id: habitId } = req.params;
    const userId = req.user!._id;
    const { date } = req.body; // Optional: "YYYY-MM-DD", defaults to today

    const habit = await Habit.findById(habitId);
    if (!habit) {
      return res.status(404).json({ error: "Habit not found" });
    }

    if (habit.user_id.toString() !== userId.toString()) {
      return res.status(403).json({ error: "Not authorized to log this habit" });
    }

    // Parse date or use today
    const logDate = date ? new Date(date) : new Date();
    logDate.setHours(12, 0, 0, 0); // Normalize to noon to avoid timezone issues

    // Check if already logged
    const startOfDay = new Date(logDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(logDate);
    endOfDay.setHours(23, 59, 59, 999);

    const existingLog = await HabitLog.findOne({
      habit_id: habitId,
      dateCompleted: { $gte: startOfDay, $lte: endOfDay },
    });

    if (existingLog) {
      return res.status(409).json({ error: "Habit already logged for this date" });
    }

    // Create log
    const habitLog = await HabitLog.create({
      habit_id: habitId,
      dateCompleted: logDate,
    });

    // Check if all habits completed for the day
    const userHabits = await Habit.find({
      user_id: userId,
      challenge_id: habit.challenge_id,
    });

    const habitIds = userHabits.map(h => h._id);
    const todayLogs = await HabitLog.find({
      habit_id: { $in: habitIds },
      dateCompleted: { $gte: startOfDay, $lte: endOfDay },
    });

    const allHabitsCompleted = todayLogs.length >= userHabits.length;

    // Update user challenge progress if all habits completed
    let challengeCompleted = false;
    if (allHabitsCompleted) {
      const userChallenge = await UserChallenge.findOne({
        userId,
        challengeId: habit.challenge_id,
      });

      if (userChallenge) {
        const challenge = await Challenge.findById(habit.challenge_id);
        const lastCompleted = userChallenge.progress.lastCompletedDate;
        const dateStr = logDate.toISOString().slice(0, 10);
        const lastStr = lastCompleted?.toISOString().slice(0, 10);

        // Only increment if this is a new day
        if (lastStr !== dateStr) {
          let newStreak = 1;
          if (lastCompleted) {
            const diffDays = Math.floor(
              (logDate.getTime() - lastCompleted.getTime()) / (1000 * 60 * 60 * 24)
            );
            if (diffDays === 1) {
              newStreak = userChallenge.progress.currentStreak + 1;
            }
          }

          const newCompletedDays = userChallenge.progress.completedDays + 1;
          challengeCompleted = challenge ? newCompletedDays >= challenge.durationDays : false;

          await UserChallenge.findByIdAndUpdate(userChallenge._id, {
            "progress.completedDays": newCompletedDays,
            "progress.currentStreak": newStreak,
            "progress.lastCompletedDate": logDate,
            ...(challengeCompleted && {
              status: "completed",
              completedOn: new Date(),
            }),
          });
        }
      }
    }

    res.status(201).json({
      message: "Habit logged successfully",
      log: {
        id: habitLog._id,
        habitId: habitLog.habit_id,
        dateCompleted: habitLog.dateCompleted,
      },
      dayCompleted: allHabitsCompleted,
      challengeCompleted,
    });
  } catch (error) {
    console.error("LogHabit error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// DELETE /api/habits/:id/log/:date - Unmark habit for a date
export const unlogHabit = async (req: AuthRequest, res: Response) => {
  try {
    const { id: habitId, date } = req.params;
    const userId = req.user!._id;

    const habit = await Habit.findById(habitId);
    if (!habit) {
      return res.status(404).json({ error: "Habit not found" });
    }

    if (habit.user_id.toString() !== userId.toString()) {
      return res.status(403).json({ error: "Not authorized to unlog this habit" });
    }

    const logDate = new Date(date);
    const startOfDay = new Date(logDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(logDate);
    endOfDay.setHours(23, 59, 59, 999);

    const deletedLog = await HabitLog.findOneAndDelete({
      habit_id: habitId,
      dateCompleted: { $gte: startOfDay, $lte: endOfDay },
    });

    if (!deletedLog) {
      return res.status(404).json({ error: "No log found for this date" });
    }

    res.json({ message: "Habit log removed successfully" });
  } catch (error) {
    console.error("UnlogHabit error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};