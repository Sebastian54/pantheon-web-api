import { z } from "zod";
import { mobileAuthUserSchema } from "./mobile-auth.schema";

export const updateMeBodySchema = z.object({
  name: z.string().trim().min(1),
});

export type UpdateMeBody = z.infer<typeof updateMeBodySchema>;

export const meResponseSchema = mobileAuthUserSchema;

export const usersErrorSchema = z.object({
  error: z.string(),
  message: z.string().optional(),
});
