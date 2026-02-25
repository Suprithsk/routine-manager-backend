import { Response } from "express";
import Habit from "../models/Habit";
import HabitLog from "../models/HabitLog";
import UserChallenge from "../models/UserChallenge";
import Challenge from "../models/Challenge";
import { AuthRequest } from "../middleware/auth";
import { CreateHabitInput, UpdateHabitInput } from "../schemas/habit.schema";
import { startOfDayInTZ, todayInTZ, tomorrowInTZ, DEFAULT_TIMEZONE } from "../utils/timezone";

// POST /api/my-challenges/:userChallengeId/habits - Create habit in an enrollment
export const createHabit = async (req: AuthRequest, res: Response) => {
  try {
    const { userChallengeId } = req.params;
    const userId = req.user!._id;
    const { title } = req.body as CreateHabitInput;

    // Look up enrollment by its own ID, scoped to the current user
    const userChallenge = await UserChallenge.findOne({ _id: userChallengeId, userId });
    if (!userChallenge) {
      return res.status(403).json({ error: "You must join the challenge first" });
    }

    if (userChallenge.status !== "active") {
      return res.status(400).json({ error: "Cannot add habits to a completed or failed challenge" });
    }

    // Block adding habits once the challenge has started — days already counted would become invalid
    if (userChallenge.progress.completedDays > 0) {
      return res.status(400).json({
        error: "Cannot add habits after the challenge has already started. You have completed days recorded.",
      });
    }

    // Check for duplicate habit title within this specific enrollment
    const existingHabit = await Habit.findOne({
      user_id: userId,
      userChallenge_id: userChallengeId,
      title: { $regex: new RegExp(`^${title}$`, "i") },
    });

    if (existingHabit) {
      return res.status(409).json({ error: "You already have a habit with this title" });
    }

    const habit = await Habit.create({
      user_id: userId,
      challenge_id: userChallenge.challengeId,
      userChallenge_id: userChallengeId,
      title,
    });

    res.status(201).json({
      message: "Habit created successfully",
      habit: {
        id: habit._id,
        title: habit.title,
        challengeId: habit.challenge_id,
        userChallengeId: habit.userChallenge_id,
        createdAt: habit.createdAt,
      },
    });
  } catch (error) {
    console.error("CreateHabit error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// GET /api/my-challenges/:userChallengeId/habits - Get user's habits in a specific enrollment
export const getHabits = async (req: AuthRequest, res: Response) => {
  try {
    const { userChallengeId } = req.params;
    const userId = req.user!._id;

    // Look up enrollment by its own ID, scoped to the current user
    const userChallenge = await UserChallenge.findOne({ _id: userChallengeId, userId });
    if (!userChallenge) {
      return res.status(403).json({ error: "You must join the challenge first" });
    }

    const habits = await Habit.find({ user_id: userId, userChallenge_id: userChallengeId })
      .sort({ createdAt: 1 });

    // Get today's completion status using the user's timezone
    const tz = req.user!.timezone || DEFAULT_TIMEZONE;
    const today = todayInTZ(tz);
    const tomorrow = tomorrowInTZ(tz);

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
        userChallenge_id: habit.userChallenge_id,
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

    // Get user challenge via the habit's enrollment reference
    const userChallenge = await UserChallenge.findById(habit.userChallenge_id);

    if (!userChallenge) {
      return res.status(403).json({ error: "You must join the challenge first" });
    }

    if (userChallenge.status !== "active") {
      return res.status(400).json({ 
        error: "Cannot log habits for a completed or failed challenge",
        status: userChallenge.status
      });
    }

    const challenge = await Challenge.findById(habit.challenge_id);
    if (!challenge) {
      return res.status(404).json({ error: "Associated challenge not found" });
    }

    // Parse date or use today — anchor to start-of-day in user's timezone
    const tz = req.user!.timezone || DEFAULT_TIMEZONE;
    const logDate = startOfDayInTZ(tz, date ? new Date(date) : new Date());

    // Check if already logged
    const startOfDay = logDate;
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000 - 1);

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
      userChallenge_id: habit.userChallenge_id,
    });

    const habitIds = userHabits.map(h => h._id);
    const todayLogs = await HabitLog.find({
      habit_id: { $in: habitIds },
      dateCompleted: { $gte: startOfDay, $lte: endOfDay },
    });

    const allHabitsCompleted = todayLogs.length >= userHabits.length;

    // Update user challenge progress if all habits completed
    let challengeCompleted = false;
    let challengeFailed = false;
    let livesRemaining = userChallenge.livesRemaining;

    if (allHabitsCompleted) {
      const lastCompleted = userChallenge.progress.lastCompletedDate;

      // Guard: if this exact calendar day was already counted as complete, skip progress update
      if (lastCompleted) {
        const lastDay = startOfDayInTZ(tz, new Date(lastCompleted));
        if (lastDay.getTime() === startOfDay.getTime()) {
          // Day already counted — just return the log without touching progress
          return res.status(201).json({
            message: "Habit logged successfully",
            log: {
              id: habitLog._id,
              habitId: habitLog.habit_id,
              dateCompleted: habitLog.dateCompleted,
            },
            dayCompleted: true,
            challengeCompleted: false,
            challengeFailed: false,
            livesRemaining: userChallenge.livesRemaining,
          });
        }
      }

      // Use absolute computation (consistent with getMyChallengeProgress) to avoid double-counting
      const DAY_MS = 1000 * 60 * 60 * 24;
      const startDay = startOfDayInTZ(tz, userChallenge.startDate);
      const daysElapsed = Math.floor((startOfDay.getTime() - startDay.getTime()) / DAY_MS);

      const newCompletedDays = userChallenge.progress.completedDays + 1;
      const totalMissedDays = Math.max(0, daysElapsed - newCompletedDays + 1);
      const totalLivesRemaining = Math.max(0, 5 - totalMissedDays);

      // Streak always increments on each completed day — missed days cost lives, not streak
      const newStreak = userChallenge.progress.currentStreak + 1;

      challengeFailed = totalLivesRemaining <= 0;
      if (newStreak >= challenge.durationDays && !challengeFailed) {
        challengeCompleted = true;
      }

      livesRemaining = totalLivesRemaining;

      const updateData: any = {
        "progress.completedDays": newCompletedDays,
        "progress.currentStreak": newStreak,
        "progress.lastCompletedDate": logDate,
        livesRemaining: totalLivesRemaining,
        missedDays: totalMissedDays,
      };

      if (challengeCompleted) {
        updateData.status = "completed";
        updateData.completedOn = new Date();
      } else if (challengeFailed) {
        updateData.status = "failed";
        updateData.completedOn = new Date();
      }

      await UserChallenge.findByIdAndUpdate(userChallenge._id, updateData);
    }

    res.status(201).json({
      message: challengeFailed 
        ? "Challenge failed - no lives remaining" 
        : challengeCompleted 
        ? `Challenge completed - ${challenge.durationDays} day streak achieved!` 
        : "Habit logged successfully",
      log: {
        id: habitLog._id,
        habitId: habitLog.habit_id,
        dateCompleted: habitLog.dateCompleted,
      },
      dayCompleted: allHabitsCompleted,
      challengeCompleted,
      challengeFailed,
      livesRemaining,
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