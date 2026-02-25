import { z } from "zod";

export const createUserHabitSchema = z.object({
  title: z
    .string()
    .min(1, "Title is required")
    .max(100, "Title must be less than 100 characters"),
  description: z
    .string()
    .max(300, "Description must be less than 300 characters")
    .optional(),
  color: z
    .string()
    .max(20, "Color must be less than 20 characters")
    .optional(),
});

export const updateUserHabitSchema = z.object({
  title: z
    .string()
    .min(1, "Title is required")
    .max(100, "Title must be less than 100 characters")
    .optional(),
  description: z
    .string()
    .max(300, "Description must be less than 300 characters")
    .optional(),
  color: z
    .string()
    .max(20, "Color must be less than 20 characters")
    .optional(),
});

export const logUserHabitSchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")
    .optional(),
});

export type CreateUserHabitInput = z.infer<typeof createUserHabitSchema>;
export type UpdateUserHabitInput = z.infer<typeof updateUserHabitSchema>;
export type LogUserHabitInput = z.infer<typeof logUserHabitSchema>;
