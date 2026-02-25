import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import User from "../models/User";
import { AuthRequest, generateToken } from "../middleware/auth";
import {
  RegisterInput,
  LoginInput,
  UpdateProfileInput,
  ChangePasswordInput,
} from "../schemas/auth.schema";

// POST /api/auth/register
export const register = async (req: Request, res: Response) => {
  try {
    const { name, email, password, timezone } = req.body as RegisterInput;

    if (email === process.env.ADMIN_EMAIL) {
      return res.status(403).json({ error: "This email is reserved!" });
    }
    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ error: "Email already registered" });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user (always "user" role for public registration)
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role: "user",
      timezone: timezone ?? "Asia/Kolkata",
    });

    // Generate token
    const token = generateToken(user._id.toString());

    res.status(201).json({
      message: "Registration successful",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
        timezone: user.timezone,
        createdAt: user.createdAt,
      },
      token,
    });
  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// POST /api/auth/login
export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body as LoginInput;

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // Generate token
    const token = generateToken(user._id.toString());

    res.json({
      message: "Login successful",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
        timezone: user.timezone,
        createdAt: user.createdAt,
      },
      token,
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// GET /api/auth/me
export const getMe = async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;

    res.json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
        timezone: user.timezone,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error("GetMe error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// PUT /api/auth/me
export const updateProfile = async (req: AuthRequest, res: Response) => {
  try {
    const { name, avatar, timezone } = req.body as UpdateProfileInput;
    const userId = req.user!._id;

    const updateData: Partial<{ name: string; avatar: string; timezone: string }> = {};
    if (name) updateData.name = name;
    if (avatar) updateData.avatar = avatar;
    if (timezone) updateData.timezone = timezone;

    const user = await User.findByIdAndUpdate(
      userId,
      { $set: updateData },
      { new: true }
    ).select("-password");

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({
      message: "Profile updated successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
        timezone: user.timezone,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error("UpdateProfile error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// PUT /api/auth/change-password
export const changePassword = async (req: AuthRequest, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body as ChangePasswordInput;
    const userId = req.user!._id;

    // Get user with password
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: "Current password is incorrect" });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Update password
    await User.findByIdAndUpdate(userId, { password: hashedPassword });

    res.json({ message: "Password changed successfully" });
  } catch (error) {
    console.error("ChangePassword error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};



// GET /api/auth/admin/users (Admin only)
export const adminGetUsers = async (req: AuthRequest, res: Response) => {
  try {
    const users = await User.find().select("-password").sort({ createdAt: -1 });

    res.json({
      users: users.map((user) => ({
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
        createdAt: user.createdAt,
      })),
    });
  } catch (error) {
    console.error("AdminGetUsers error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};