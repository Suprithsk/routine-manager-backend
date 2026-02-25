import { z } from "zod";
import { isValidTimezone, DEFAULT_TIMEZONE } from "../utils/timezone";

const timezoneField = z
  .string()
  .refine(isValidTimezone, { message: "Invalid IANA timezone (e.g. 'Asia/Kolkata', 'America/New_York')" })
  .default(DEFAULT_TIMEZONE);

export const registerSchema = z.object({
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(50, "Name must be less than 50 characters"),
  email: z
    .string()
    .email("Invalid email address"),
  password: z
    .string()
    .min(6, "Password must be at least 6 characters")
    .max(100, "Password must be less than 100 characters"),
  timezone: timezoneField.optional(),
});

// Admin can create users with roles
export const adminCreateUserSchema = z.object({
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(50, "Name must be less than 50 characters"),
  email: z
    .string()
    .email("Invalid email address"),
  password: z
    .string()
    .min(6, "Password must be at least 6 characters")
    .max(100, "Password must be less than 100 characters"),
  role: z
    .enum(["user", "admin"])
    .optional()
    .default("user"),
});

export const loginSchema = z.object({
  email: z
    .string()
    .email("Invalid email address"),
  password: z
    .string()
    .min(1, "Password is required"),
});

export const updateProfileSchema = z.object({
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(50, "Name must be less than 50 characters")
    .optional(),
  avatar: z
    .string()
    .url("Invalid avatar URL")
    .optional(),
  timezone: timezoneField.optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z
    .string()
    .min(1, "Current password is required"),
  newPassword: z
    .string()
    .min(6, "New password must be at least 6 characters")
    .max(100, "New password must be less than 100 characters"),
  confirmPassword: z
    .string()
    .min(1, "Please confirm your password"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

// Type exports
export type RegisterInput = z.infer<typeof registerSchema> & { timezone?: string };
export type AdminCreateUserInput = z.infer<typeof adminCreateUserSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema> & { timezone?: string };
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;