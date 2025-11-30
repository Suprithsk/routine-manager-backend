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
    if (existingEnrollment) {
      return res.status(409).json({ 
        error: "Already enrolled in this challenge",
        userChallenge: {
          id: existingEnrollment._id,
          status: existingEnrollment.status,
          progress: existingEnrollment.progress,
        }
      });
    }

    // Create enrollment
    const userChallenge = await UserChallenge.create({
      userId,
      challengeId,
      startDate: startDate ? new Date(startDate) : new Date(),
      status: "active",
      progress: {
        completedDays: 0,
        currentStreak: 0,
      },
    });

    res.status(201).json({
      message: "Successfully joined the challenge",
      userChallenge: {
        id: userChallenge._id,
        challengeId: userChallenge.challengeId,
        startDate: userChallenge.startDate,
        status: userChallenge.status,
        progress: userChallenge.progress,
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

    // Delete user's habits for this challenge
    await Habit.deleteMany({ user_id: userId, challenge_id: challengeId });

    // Delete habit logs for user's habits in this challenge
    const userHabits = await Habit.find({ user_id: userId, challenge_id: challengeId });
    const habitIds = userHabits.map(h => h._id);
    await HabitLog.deleteMany({ habit_id: { $in: habitIds } });

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
          challenge_id: challenge._id,
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

// GET /api/my-challenges/:challengeId - Get user's progress in a specific challenge
export const getMyChallengeProgress = async (req: AuthRequest, res: Response) => {
  try {
    const { challengeId } = req.params;
    const userId = req.user!._id;

    const userChallenge = await UserChallenge.findOne({ userId, challengeId })
      .populate("challengeId");

    if (!userChallenge) {
      return res.status(404).json({ error: "Not enrolled in this challenge" });
    }

    const challenge = userChallenge.challengeId as any;

    // Get user's habits for this challenge
    const habits = await Habit.find({ user_id: userId, challenge_id: challengeId });

    // Get today's logs
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