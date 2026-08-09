import { z } from "zod";

export const mobileDiscordAuthBodySchema = z.object({
  code: z.string().min(1),
  code_verifier: z.string().min(43).max(128),
  redirect_uri: z.string().min(1),
});

export type MobileDiscordAuthBody = z.infer<typeof mobileDiscordAuthBodySchema>;

export const mobileDiscordAuthResponseSchema = z.object({
  token: z.string(),
  user: z.object({
    id: z.string().uuid(),
    name: z.string().nullable(),
    email: z.string(),
  }),
});

export const mobileDiscordAuthErrorSchema = z.object({
  error: z.string(),
  message: z.string().optional(),
});
