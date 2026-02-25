import { Response } from "express";
import UserHabit from "../models/UserHabit";
import UserHabitLog from "../models/UserHabitLog";
import { AuthRequest } from "../middleware/auth";
import {
  CreateUserHabitInput,
  UpdateUserHabitInput,
} from "../schemas/userHabit.schema";
import {
  toDay,
  todayInTZ,
  tomorrowInTZ,
  startOfDayInTZ,
  DEFAULT_TIMEZONE,
} from "../utils/timezone";

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Compute streak info from a sorted (asc) list of completion dates, relative to `tz` */
function computeStreaks(
  dates: Date[],
  tz: string
): {
  currentStreak: number;
  longestStreak: number;
  lastCompletedDate: Date | null;
} {
  if (dates.length === 0) {
    return { currentStreak: 0, longestStreak: 0, lastCompletedDate: null };
  }

  // Deduplicate to one entry per calendar day
  const days = [
    ...new Map(
      dates.map((d) => [toDay(d).getTime(), toDay(d)])
    ).values(),
  ].sort((a, b) => a.getTime() - b.getTime());

  let longestStreak = 1;
  let tempStreak = 1;

  for (let i = 1; i < days.length; i++) {
    const diff =
      (days[i].getTime() - days[i - 1].getTime()) / (1000 * 60 * 60 * 24);
    if (diff === 1) {
      tempStreak++;
      longestStreak = Math.max(longestStreak, tempStreak);
    } else {
      tempStreak = 1;
    }
  }

  // Current streak: count backwards from today (in user's timezone)
  const today = todayInTZ(tz);
  const lastDay = days[days.length - 1];
  const lastCompletedDate = lastDay;

  // If last completion is not today or yesterday, streak is 0
  const lastDiff =
    (today.getTime() - lastDay.getTime()) / (1000 * 60 * 60 * 24);
  if (lastDiff > 1) {
    return { currentStreak: 0, longestStreak, lastCompletedDate };
  }

  let currentStreak = 1;
  for (let i = days.length - 2; i >= 0; i--) {
    const diff =
      (days[i + 1].getTime() - days[i].getTime()) / (1000 * 60 * 60 * 24);
    if (diff === 1) {
      currentStreak++;
    } else {
      break;
    }
  }

  return { currentStreak, longestStreak, lastCompletedDate };
}

// ─── CRUD ────────────────────────────────────────────────────────────────────

// POST /api/user-habits - Create a personal habit
export const createUserHabit = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!._id;
    const { title, description, color } = req.body as CreateUserHabitInput;

    // Duplicate check (case-insensitive, non-archived only — enforced by partial index too)
    const existing = await UserHabit.findOne({
      user_id: userId,
      title: { $regex: new RegExp(`^${title}$`, "i") },
      isArchived: false,
    });
    if (existing) {
      return res.status(409).json({ error: "You already have a habit with this title" });
    }

    const habit = await UserHabit.create({ user_id: userId, title, description, color });

    res.status(201).json({
      message: "Habit created successfully",
      habit: formatHabit(habit),
    });
  } catch (error) {
    console.error("CreateUserHabit error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// GET /api/user-habits - List all personal habits
export const getUserHabits = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!._id;
    const { includeArchived } = req.query;

    const filter: any = { user_id: userId };
    if (includeArchived !== "true") filter.isArchived = false;

    const habits = await UserHabit.find(filter).sort({ createdAt: -1 });

    res.json({ habits: habits.map(formatHabit) });
  } catch (error) {
    console.error("GetUserHabits error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// GET /api/user-habits/:id - Get a single habit with today's status
export const getUserHabitById = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!._id;

    const habit = await UserHabit.findOne({ _id: id, user_id: userId });
    if (!habit) return res.status(404).json({ error: "Habit not found" });

    const tz = req.user!.timezone || DEFAULT_TIMEZONE;
    const today = todayInTZ(tz);
    const tomorrow = tomorrowInTZ(tz);

    const completedToday = !!(await UserHabitLog.findOne({
      userHabit_id: id,
      dateCompleted: { $gte: today, $lt: tomorrow },
    }));

    res.json({ habit: { ...formatHabit(habit), completedToday } });
  } catch (error) {
    console.error("GetUserHabitById error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// PUT /api/user-habits/:id - Update a habit
export const updateUserHabit = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!._id;
    const { title, description, color } = req.body as UpdateUserHabitInput;

    const habit = await UserHabit.findOne({ _id: id, user_id: userId });
    if (!habit) return res.status(404).json({ error: "Habit not found" });

    if (title && title !== habit.title) {
      const existing = await UserHabit.findOne({
        user_id: userId,
        title: { $regex: new RegExp(`^${title}$`, "i") },
        isArchived: false,
        _id: { $ne: id },
      });
      if (existing) {
        return res.status(409).json({ error: "You already have a habit with this title" });
      }
    }

    const updated = await UserHabit.findByIdAndUpdate(
      id,
      { $set: { ...(title && { title }), ...(description !== undefined && { description }), ...(color !== undefined && { color }) } },
      { new: true }
    );

    res.json({ message: "Habit updated successfully", habit: formatHabit(updated!) });
  } catch (error) {
    console.error("UpdateUserHabit error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// DELETE /api/user-habits/:id - Delete a habit and all its logs
export const deleteUserHabit = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!._id;

    const habit = await UserHabit.findOne({ _id: id, user_id: userId });
    if (!habit) return res.status(404).json({ error: "Habit not found" });

    await UserHabitLog.deleteMany({ userHabit_id: id });
    await UserHabit.findByIdAndDelete(id);

    res.json({ message: "Habit deleted successfully" });
  } catch (error) {
    console.error("DeleteUserHabit error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// PATCH /api/user-habits/:id/archive - Archive / unarchive a habit
export const archiveUserHabit = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!._id;

    const habit = await UserHabit.findOne({ _id: id, user_id: userId });
    if (!habit) return res.status(404).json({ error: "Habit not found" });

    habit.isArchived = !habit.isArchived;
    await habit.save();

    res.json({
      message: habit.isArchived ? "Habit archived" : "Habit unarchived",
      habit: formatHabit(habit),
    });
  } catch (error) {
    console.error("ArchiveUserHabit error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// ─── Logging ─────────────────────────────────────────────────────────────────

// POST /api/user-habits/:id/log - Mark habit complete for a day
export const logUserHabit = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!._id;
    const { date } = req.body;

    const habit = await UserHabit.findOne({ _id: id, user_id: userId });
    if (!habit) return res.status(404).json({ error: "Habit not found" });

    if (habit.isArchived) {
      return res.status(400).json({ error: "Cannot log an archived habit" });
    }

    const logDate = startOfDayInTZ(req.user!.timezone || DEFAULT_TIMEZONE, date ? new Date(date) : new Date());

    const startOfDay = logDate;
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000 - 1);

    const existing = await UserHabitLog.findOne({
      userHabit_id: id,
      dateCompleted: { $gte: startOfDay, $lte: endOfDay },
    });
    if (existing) {
      return res.status(409).json({ error: "Habit already logged for this date" });
    }

    const log = await UserHabitLog.create({ userHabit_id: id, dateCompleted: logDate });

    res.status(201).json({
      message: "Habit logged successfully",
      log: { id: log._id, dateCompleted: log.dateCompleted },
    });
  } catch (error) {
    console.error("LogUserHabit error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// DELETE /api/user-habits/:id/log/:date - Unlog a habit for a date
export const unlogUserHabit = async (req: AuthRequest, res: Response) => {
  try {
    const { id, date } = req.params;
    const userId = req.user!._id;
    const tz = req.user!.timezone || DEFAULT_TIMEZONE;

    const habit = await UserHabit.findOne({ _id: id, user_id: userId });
    if (!habit) return res.status(404).json({ error: "Habit not found" });

    const logDate = new Date(date);
    const startOfDay = startOfDayInTZ(tz, logDate);
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000 - 1);

    const deleted = await UserHabitLog.findOneAndDelete({
      userHabit_id: id,
      dateCompleted: { $gte: startOfDay, $lte: endOfDay },
    });
    if (!deleted) return res.status(404).json({ error: "No log found for this date" });

    res.json({ message: "Habit log removed successfully" });
  } catch (error) {
    console.error("UnlogUserHabit error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// ─── Analytics ───────────────────────────────────────────────────────────────

// GET /api/user-habits/:id/analytics - Full analytics for a habit
export const getUserHabitAnalytics = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!._id;

    const habit = await UserHabit.findOne({ _id: id, user_id: userId });
    if (!habit) return res.status(404).json({ error: "Habit not found" });

    const allLogs = await UserHabitLog.find({ userHabit_id: id }).sort({ dateCompleted: 1 });
    const dates = allLogs.map((l) => l.dateCompleted);

    const { currentStreak, longestStreak, lastCompletedDate } = computeStreaks(dates, req.user!.timezone || DEFAULT_TIMEZONE);

    const totalCompletions = dates.length;

    // Completion rate — last 30 calendar days
    const tz = req.user!.timezone || DEFAULT_TIMEZONE;
    const today = todayInTZ(tz);
    const thirtyDaysAgo = new Date(today.getTime() - 29 * 24 * 60 * 60 * 1000);

    const last30Logs = dates.filter((d) => toDay(d) >= thirtyDaysAgo).length;
    const completionRateLast30 = Math.round((last30Logs / 30) * 100);

    // Completion rate — last 7 days
    const sevenDaysAgo = new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000);
    const last7Logs = dates.filter((d) => toDay(d) >= sevenDaysAgo).length;
    const completionRateLast7 = Math.round((last7Logs / 7) * 100);

    // Check completed today
    const tomorrow = tomorrowInTZ(tz);
    const completedToday = dates.some(
      (d) => toDay(d) >= today && toDay(d) < tomorrow
    );

    // Weekly breakdown — past 4 weeks (Mon–Sun)
    const weeklyBreakdown = buildWeeklyBreakdown(dates, 4, tz);

    // Monthly breakdown — past 6 months
    const monthlyBreakdown = buildMonthlyBreakdown(dates, 6);

    res.json({
      habit: formatHabit(habit),
      analytics: {
        currentStreak,
        longestStreak,
        totalCompletions,
        lastCompletedDate,
        completedToday,
        completionRateLast7,
        completionRateLast30,
        weeklyBreakdown,
        monthlyBreakdown,
      },
    });
  } catch (error) {
    console.error("GetUserHabitAnalytics error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// GET /api/user-habits/analytics/summary - Overview of all habits
export const getUserHabitsSummary = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!._id;
    const tz = req.user!.timezone || DEFAULT_TIMEZONE;

    const habits = await UserHabit.find({ user_id: userId, isArchived: false });

    const today = todayInTZ(tz);
    const tomorrow = tomorrowInTZ(tz);

    const summaries = await Promise.all(
      habits.map(async (habit) => {
        const allLogs = await UserHabitLog.find({
          userHabit_id: habit._id,
        }).sort({ dateCompleted: 1 });

        const dates = allLogs.map((l) => l.dateCompleted);
        const { currentStreak, longestStreak, lastCompletedDate } = computeStreaks(dates, tz);

        const completedToday = dates.some(
          (d) => toDay(d) >= today && toDay(d) < tomorrow
        );

        return {
          habit: formatHabit(habit),
          currentStreak,
          longestStreak,
          totalCompletions: dates.length,
          completedToday,
          lastCompletedDate,
        };
      })
    );

    const completedTodayCount = summaries.filter((s) => s.completedToday).length;

    res.json({
      totalHabits: habits.length,
      completedTodayCount,
      habits: summaries,
    });
  } catch (error) {
    console.error("GetUserHabitsSummary error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// ─── Private helpers ─────────────────────────────────────────────────────────

function formatHabit(habit: any) {
  return {
    id: habit._id,
    title: habit.title,
    description: habit.description,
    color: habit.color,
    isArchived: habit.isArchived,
    createdAt: habit.createdAt,
  };
}

function buildWeeklyBreakdown(dates: Date[], weeks: number, tz: string) {
  const result = [];
  const today = todayInTZ(tz);

  for (let w = weeks - 1; w >= 0; w--) {
    const weekStart = new Date(today);
    weekStart.setUTCDate(today.getUTCDate() - today.getUTCDay() - w * 7); // Sunday start
    const weekEnd = new Date(weekStart);
    weekEnd.setUTCDate(weekStart.getUTCDate() + 6);
    weekEnd.setTime(weekEnd.getTime() + 24 * 60 * 60 * 1000 - 1);

    const completed = dates.filter(
      (d) => toDay(d) >= weekStart && d <= weekEnd
    ).length;

    result.push({
      weekStart: weekStart.toISOString().split("T")[0],
      weekEnd: weekEnd.toISOString().split("T")[0],
      completed,
      total: 7,
    });
  }

  return result;
}

function buildMonthlyBreakdown(dates: Date[], months: number) {
  const result = [];
  const now = new Date();

  for (let m = months - 1; m >= 0; m--) {
    const d = new Date(now.getFullYear(), now.getMonth() - m, 1);
    const year = d.getFullYear();
    const month = d.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const completed = dates.filter((date) => {
      const day = toDay(date);
      return day.getFullYear() === year && day.getMonth() === month;
    }).length;

    result.push({
      month: `${year}-${String(month + 1).padStart(2, "0")}`,
      completed,
      total: daysInMonth,
      completionRate: Math.round((completed / daysInMonth) * 100),
    });
  }

  return result;
}
