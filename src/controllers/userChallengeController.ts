import { Response } from "express";
import Challenge from "../models/Challenge";
import UserChallenge from "../models/UserChallenge";
import Habit from "../models/Habit";
import HabitLog from "../models/HabitLog";
import { AuthRequest } from "../middleware/auth";
import { JoinChallengeInput } from "../schemas/userChallenge.schema";

// POST /api/challenges/:id/join - Join a challenge
export const joinChallenge = async (req: AuthRequest, res: Response) => {
  try {
    const { id: challengeId } = req.params;
    const userId = req.user!._id;
    const { startDate } = req.body as JoinChallengeInput;

    // Check if challenge exists
    const challenge = await Challenge.findById(challengeId);
    if (!challenge) {
      return res.status(404).json({ error: "Challenge not found" });
    }

    // Check if already enrolled
    const existingEnrollment = await UserChallenge.findOne({ userId, challengeId });
    if (existingEnrollment && existingEnrollment.status !== "failed" && existingEnrollment.status !== "completed") {
      return res.status(409).json({ 
        error: "Already enrolled in this challenge",
        userChallenge: {
          id: existingEnrollment._id,
          status: existingEnrollment.status,
          progress: existingEnrollment.progress,
          livesRemaining: existingEnrollment.livesRemaining,
          missedDays: existingEnrollment.missedDays,
        }
      });
    }

    // Create enrollment with 5 lives
    const userChallenge = await UserChallenge.create({
      userId,
      challengeId,
      startDate: startDate ? new Date(startDate) : new Date(),
      status: "active",
      progress: {
        completedDays: 0,
        currentStreak: 0,
      },
      livesRemaining: 5,
      missedDays: 0,
    });

    res.status(201).json({
      message: "Successfully joined the challenge",
      userChallenge: {
        id: userChallenge._id,
        challengeId: userChallenge.challengeId,
        startDate: userChallenge.startDate,
        status: userChallenge.status,
        progress: userChallenge.progress,
        livesRemaining: userChallenge.livesRemaining,
        missedDays: userChallenge.missedDays,
        createdAt: userChallenge.createdAt,
      },
      challenge: {
        id: challenge._id,
        title: challenge.title,
        description: challenge.description,
        durationDays: challenge.durationDays,
      },
    });
  } catch (error) {
    console.error("JoinChallenge error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// DELETE /api/challenges/:id/leave - Leave a challenge
export const leaveChallenge = async (req: AuthRequest, res: Response) => {
  try {
    const { id: challengeId } = req.params;
    const userId = req.user!._id;

    const userChallenge = await UserChallenge.findOne({ userId, challengeId });
    if (!userChallenge) {
      return res.status(404).json({ error: "Not enrolled in this challenge" });
    }

    // Delete habit logs for user's habits in this enrollment
    const userHabits = await Habit.find({ user_id: userId, userChallenge_id: userChallenge._id });
    const habitIds = userHabits.map(h => h._id);
    await HabitLog.deleteMany({ habit_id: { $in: habitIds } });

    // Delete user's habits for this enrollment
    await Habit.deleteMany({ userChallenge_id: userChallenge._id });

    // Delete enrollment
    await UserChallenge.findByIdAndDelete(userChallenge._id);

    res.json({ message: "Successfully left the challenge" });
  } catch (error) {
    console.error("LeaveChallenge error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// GET /api/my-challenges - Get user's enrolled challenges
export const getMyChallenges = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!._id;

    const userChallenges = await UserChallenge.find({ userId })
      .populate("challengeId")
      .sort({ createdAt: -1 });

    const challengesWithStats = await Promise.all(
      userChallenges.map(async (uc) => {
        const challenge = uc.challengeId as any;
        const habitCount = await Habit.countDocuments({
          user_id: userId,
          userChallenge_id: uc._id,
        });

        return {
          id: uc._id,
          challenge: {
            id: challenge._id,
            title: challenge.title,
            description: challenge.description,
            durationDays: challenge.durationDays,
          },
          startDate: uc.startDate,
          status: uc.status,
          progress: uc.progress,
          livesRemaining: uc.livesRemaining,
          missedDays: uc.missedDays,
          habitCount,
          completedOn: uc.completedOn,
          createdAt: uc.createdAt,
        };
      })
    );

    res.json({ challenges: challengesWithStats });
  } catch (error) {
    console.error("GetMyChallenges error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// GET /api/my-challenges/:userChallengeId - Get user's progress in a specific enrollment
export const getMyChallengeProgress = async (req: AuthRequest, res: Response) => {
  try {
    const { userChallengeId } = req.params;
    const userId = req.user!._id;

    let userChallenge = await UserChallenge.findOne({ _id: userChallengeId, userId })
      .populate("challengeId");

    if (!userChallenge) {
      return res.status(404).json({ error: "Not enrolled in this challenge" });
    }

    const challenge = userChallenge.challengeId as any;

    // ── Detect and persist pending missed days (idempotent) ────────────────
    if (userChallenge.status === "active") {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const DAY_MS = 1000 * 60 * 60 * 24;
      const startDay = new Date(userChallenge.startDate);
      startDay.setHours(0, 0, 0, 0);

      // Total full days elapsed since start (today excluded — not yet over)
      const daysElapsed = Math.floor((today.getTime() - startDay.getTime()) / DAY_MS);

      // missedDays = elapsed past days - completions that happened on past days
      // If today was already completed, exclude it from completedDays since today hasn't elapsed yet
      const lastCompleted = userChallenge.progress.lastCompletedDate;
      let completedDaysForPast = userChallenge.progress.completedDays;
      if (lastCompleted) {
        const lastDay = new Date(lastCompleted);
        lastDay.setHours(0, 0, 0, 0);
        if (lastDay.getTime() === today.getTime()) {
          completedDaysForPast -= 1;
        }
      }

      const totalMissedDays = Math.max(0, daysElapsed - completedDaysForPast);
      const totalLivesRemaining = Math.max(0, 5 - totalMissedDays);
      const failed = totalLivesRemaining <= 0;

      // Only write if something actually changed
      if (
        totalMissedDays !== userChallenge.missedDays ||
        totalLivesRemaining !== userChallenge.livesRemaining ||
        failed
      ) {
        const updateData: any = {
          missedDays: totalMissedDays,
          livesRemaining: totalLivesRemaining,
        };
        if (failed) {
          updateData.status = "failed";
          updateData.completedOn = new Date();
        }
        userChallenge = (await UserChallenge.findByIdAndUpdate(
          userChallenge._id,
          updateData,
          { new: true }
        ).populate("challengeId"))!;
      }
    }
    // ────────────────────────────────────────────────────────────────────────

    // Get user's habits for this specific enrollment
    const habits = await Habit.find({ user_id: userId, userChallenge_id: userChallenge._id });

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

    res.json({
      userChallenge: {
        id: userChallenge._id,
        startDate: userChallenge.startDate,
        status: userChallenge.status,
        progress: userChallenge.progress,
        livesRemaining: userChallenge.livesRemaining,
        missedDays: userChallenge.missedDays,
        completedOn: userChallenge.completedOn,
      },
      challenge: {
        id: challenge._id,
        title: challenge.title,
        description: challenge.description,
        durationDays: challenge.durationDays,
      },
      habits: habitsWithStatus,
      todayCompleted: habitsWithStatus.length > 0 && habitsWithStatus.every(h => h.completedToday),
    });
  } catch (error) {
    console.error("GetMyChallengeProgress error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};