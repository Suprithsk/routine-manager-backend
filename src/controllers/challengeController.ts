import { Request, Response } from "express";
import Challenge from "../models/Challenge";
import UserChallenge from "../models/UserChallenge";
import { AuthRequest } from "../middleware/auth";
import {
  CreateChallengeInput,
  UpdateChallengeInput,
} from "../schemas/challenge.schema";

// GET /api/challenges - List all challenges (Public)
export const getAllChallenges = async (req: Request, res: Response) => {
  try {
    const { search, sortBy } = req.query;

    // Build query for search
    let query: any = {};
    if (search && typeof search === 'string') {
      query = {
        $or: [
          { title: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } }
        ]
      };
    }

    // Build sort options
    let sortOptions: any = { createdAt: -1 }; // Default: newest first
    if (sortBy === 'durationAsc') {
      sortOptions = { durationDays: 1 };
    } else if (sortBy === 'durationDesc') {
      sortOptions = { durationDays: -1 };
    } else if (sortBy === 'titleAsc') {
      sortOptions = { title: 1 };
    } else if (sortBy === 'titleDesc') {
      sortOptions = { title: -1 };
    }

    const challenges = await Challenge.find(query).sort(sortOptions);

    res.json({
      challenges: challenges.map((challenge) => ({
        id: challenge._id,
        title: challenge.title,
        description: challenge.description,
        durationDays: challenge.durationDays,
        createdAt: challenge.createdAt,
      })),
    });
  } catch (error) {
    console.error("GetAllChallenges error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// GET /api/challenges/:id - Get challenge by ID (Public)
export const getChallengeById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const challenge = await Challenge.findById(id);
    if (!challenge) {
      return res.status(404).json({ error: "Challenge not found" });
    }

    res.json({
      challenge: {
        id: challenge._id,
        title: challenge.title,
        description: challenge.description,
        durationDays: challenge.durationDays,
        createdAt: challenge.createdAt,
      },
    });
  } catch (error) {
    console.error("GetChallengeById error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// POST /api/challenges - Create challenge (Admin only)
export const createChallenge = async (req: AuthRequest, res: Response) => {
  try {
    const { title, description, durationDays } = req.body as CreateChallengeInput;

    // Check if challenge with same title exists
    const existingChallenge = await Challenge.findOne({ title });
    if (existingChallenge) {
      return res.status(409).json({ error: "Challenge with this title already exists" });
    }

    const challenge = await Challenge.create({
      title,
      description,
      durationDays,
    });

    res.status(201).json({
      message: "Challenge created successfully",
      challenge: {
        id: challenge._id,
        title: challenge.title,
        description: challenge.description,
        durationDays: challenge.durationDays,
        createdAt: challenge.createdAt,
      },
    });
  } catch (error) {
    console.error("CreateChallenge error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// PUT /api/challenges/:id - Update challenge (Admin only)
export const updateChallenge = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { title, description, durationDays } = req.body as UpdateChallengeInput;

    const challenge = await Challenge.findById(id);
    if (!challenge) {
      return res.status(404).json({ error: "Challenge not found" });
    }

    // Check if new title conflicts with existing challenge
    if (title && title !== challenge.title) {
      const existingChallenge = await Challenge.findOne({ title });
      if (existingChallenge) {
        return res.status(409).json({ error: "Challenge with this title already exists" });
      }
    }

    const updateData: Partial<{ title: string; description: string; durationDays: number }> = {};
    if (title) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (durationDays) updateData.durationDays = durationDays;

    const updatedChallenge = await Challenge.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true }
    );

    res.json({
      message: "Challenge updated successfully",
      challenge: {
        id: updatedChallenge!._id,
        title: updatedChallenge!.title,
        description: updatedChallenge!.description,
        durationDays: updatedChallenge!.durationDays,
        createdAt: updatedChallenge!.createdAt,
      },
    });
  } catch (error) {
    console.error("UpdateChallenge error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// DELETE /api/challenges/:id - Delete challenge (Admin only)
export const deleteChallenge = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const challenge = await Challenge.findById(id);
    if (!challenge) {
      return res.status(404).json({ error: "Challenge not found" });
    }

    // Check if any users are participating in this challenge
    const activeParticipants = await UserChallenge.countDocuments({
      challengeId: id,
      status: "active",
    });

    if (activeParticipants > 0) {
      return res.status(400).json({
        error: "Cannot delete challenge with active participants",
        activeParticipants,
      });
    }

    await Challenge.findByIdAndDelete(id);

    res.json({ message: "Challenge deleted successfully" });
  } catch (error) {
    console.error("DeleteChallenge error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// GET /api/challenges/:id/stats - Get challenge statistics (Admin only)
export const getChallengeStats = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const challenge = await Challenge.findById(id);
    if (!challenge) {
      return res.status(404).json({ error: "Challenge not found" });
    }

    const [totalParticipants, activeParticipants, completedParticipants, failedParticipants] =
      await Promise.all([
        UserChallenge.countDocuments({ challengeId: id }),
        UserChallenge.countDocuments({ challengeId: id, status: "active" }),
        UserChallenge.countDocuments({ challengeId: id, status: "completed" }),
        UserChallenge.countDocuments({ challengeId: id, status: "failed" }),
      ]);

    res.json({
      challenge: {
        id: challenge._id,
        title: challenge.title,
      },
      stats: {
        totalParticipants,
        activeParticipants,
        completedParticipants,
        failedParticipants,
        completionRate:
          totalParticipants > 0
            ? Math.round((completedParticipants / totalParticipants) * 100)
            : 0,
      },
    });
  } catch (error) {
    console.error("GetChallengeStats error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};