import { z } from "zod";

export const createChallengeSchema = z.object({
  title: z
    .string()
    .min(3, "Title must be at least 3 characters")
    .max(100, "Title must be less than 100 characters"),
  description: z
    .string()
    .max(500, "Description must be less than 500 characters")
    .optional(),
  durationDays: z
    .number()
    .int("Duration must be a whole number")
    .min(1, "Duration must be at least 1 day")
    .max(365, "Duration cannot exceed 365 days"),
});

export const updateChallengeSchema = z.object({
  title: z
    .string()
    .min(3, "Title must be at least 3 characters")
    .max(100, "Title must be less than 100 characters")
    .optional(),
  description: z
    .string()
    .max(500, "Description must be less than 500 characters")
    .optional(),
  durationDays: z
    .number()
    .int("Duration must be a whole number")
    .min(1, "Duration must be at least 1 day")
    .max(365, "Duration cannot exceed 365 days")
    .optional(),
});




// Type exports
export type CreateChallengeInput = z.infer<typeof createChallengeSchema>;
export type UpdateChallengeInput = z.infer<typeof updateChallengeSchema>;