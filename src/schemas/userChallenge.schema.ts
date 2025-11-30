import { z } from "zod";

export const joinChallengeSchema = z.object({
  startDate: z
    .string()
    .datetime()
    .optional(), // Optional: defaults to now
});

// Type exports
export type JoinChallengeInput = z.infer<typeof joinChallengeSchema>;