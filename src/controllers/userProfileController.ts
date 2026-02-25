import { Request, Response } from "express";
import { Types } from "mongoose";
import User from "../models/User";
import UserChallenge from "../models/UserChallenge";
import Habit from "../models/Habit";
import HabitLog from "../models/HabitLog";
import UserHabit from "../models/UserHabit";
import UserHabitLog from "../models/UserHabitLog";

// GET /api/users/:userId/profile  — Public, no auth required
export const getPublicProfile = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    if (!Types.ObjectId.isValid(userId)) {
      return res.status(404).json({ error: "User not found" });
    }

    const user = await User.findById(userId).select("name avatar createdAt");
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const userObjectId = new Types.ObjectId(userId);

    // ── Challenge stats ─────────────────────────────────────────────────────
    const [
      totalEnrollments,
      completedCount,
      activeCount,
      failedCount,
      completedDaysAgg,
    ] = await Promise.all([
      UserChallenge.countDocuments({ userId: userObjectId }),
      UserChallenge.countDocuments({ userId: userObjectId, status: "completed" }),
      UserChallenge.countDocuments({ userId: userObjectId, status: "active" }),
      UserChallenge.countDocuments({ userId: userObjectId, status: "failed" }),
      UserChallenge.aggregate([
        { $match: { userId: userObjectId } },
        { $group: { _id: null, total: { $sum: "$progress.completedDays" } } },
      ]),
    ]);

    const totalCompletedDays: number = completedDaysAgg[0]?.total ?? 0;

    // Best streak ever (max from all enrollments)
    const bestStreakAgg = await UserChallenge.aggregate([
      { $match: { userId: userObjectId } },
      { $group: { _id: null, best: { $max: "$progress.currentStreak" } } },
    ]);
    const bestStreak: number = bestStreakAgg[0]?.best ?? 0;

    // ── Active challenges (with challenge info) ─────────────────────────────
    const activeChallenges = await UserChallenge.aggregate([
      { $match: { userId: userObjectId, status: "active" } },
      {
        $lookup: {
          from: "challenges",
          localField: "challengeId",
          foreignField: "_id",
          as: "challenge",
        },
      },
      { $unwind: "$challenge" },
      { $sort: { createdAt: -1 } },
      {
        $project: {
          _id: 0,
          challengeTitle: "$challenge.title",
          durationDays: "$challenge.durationDays",
          completedDays: "$progress.completedDays",
          currentStreak: "$progress.currentStreak",
          livesRemaining: 1,
          startDate: 1,
        },
      },
    ]);

    // ── Completed challenges ─────────────────────────────────────────────────
    const completedChallenges = await UserChallenge.aggregate([
      { $match: { userId: userObjectId, status: "completed" } },
      {
        $lookup: {
          from: "challenges",
          localField: "challengeId",
          foreignField: "_id",
          as: "challenge",
        },
      },
      { $unwind: "$challenge" },
      { $sort: { completedOn: -1 } },
      { $limit: 10 },
      {
        $project: {
          _id: 0,
          challengeTitle: "$challenge.title",
          durationDays: "$challenge.durationDays",
          completedDays: "$progress.completedDays",
          completedOn: 1,
        },
      },
    ]);

    // ── Personal habits ─────────────────────────────────────────────────────
    const [activeHabitsCount, totalPersonalLogs] = await Promise.all([
      UserHabit.countDocuments({ user_id: userObjectId, isArchived: false }),
      UserHabitLog.aggregate([
        {
          $lookup: {
            from: "userhabits",
            localField: "userHabit_id",
            foreignField: "_id",
            as: "habit",
          },
        },
        { $unwind: "$habit" },
        { $match: { "habit.user_id": userObjectId } },
        { $count: "total" },
      ]),
    ]);

    // ── Activity heatmap — last 365 days (challenge habits + personal habits) ─
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    oneYearAgo.setHours(0, 0, 0, 0);

    // Get all habit IDs belonging to this user
    const userHabitIds = await Habit.find({ user_id: userObjectId }).distinct("_id");
    const userPersonalHabitIds = await UserHabit.find({ user_id: userObjectId }).distinct("_id");

    const [challengeHabitLogs, personalHabitLogs] = await Promise.all([
      HabitLog.aggregate([
        {
          $match: {
            habit_id: { $in: userHabitIds },
            dateCompleted: { $gte: oneYearAgo },
          },
        },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$dateCompleted" } },
            count: { $sum: 1 },
          },
        },
      ]),
      UserHabitLog.aggregate([
        {
          $match: {
            userHabit_id: { $in: userPersonalHabitIds },
            dateCompleted: { $gte: oneYearAgo },
          },
        },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$dateCompleted" } },
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    // Merge both logs into a single daily activity map
    const activityMap: Record<string, number> = {};
    for (const entry of challengeHabitLogs) {
      activityMap[entry._id] = (activityMap[entry._id] ?? 0) + entry.count;
    }
    for (const entry of personalHabitLogs) {
      activityMap[entry._id] = (activityMap[entry._id] ?? 0) + entry.count;
    }

    const activityHeatmap = Object.entries(activityMap)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    res.json({
      user: {
        id: user._id,
        name: user.name,
        avatar: user.avatar ?? null,
        memberSince: user.createdAt,
      },
      challengeStats: {
        totalEnrollments,
        completed: completedCount,
        active: activeCount,
        failed: failedCount,
        completionRate:
          totalEnrollments > 0
            ? Math.round((completedCount / totalEnrollments) * 100)
            : 0,
        totalCompletedDays,
        bestStreak,
      },
      activeChallenges,
      completedChallenges,
      personalHabits: {
        activeCount: activeHabitsCount,
        totalLogs: totalPersonalLogs[0]?.total ?? 0,
      },
      activityHeatmap,
    });
  } catch (error) {
    console.error("GetPublicProfile error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
