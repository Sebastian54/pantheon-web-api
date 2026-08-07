import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),

  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  // Shared with apps/web so this service can decode NextAuth session tokens
  // forwarded as a Bearer token, without a network round-trip to the web app.
  NEXTAUTH_SECRET: z.string().min(1, "NEXTAUTH_SECRET is required"),

  SENTRY_DSN: z.string().url().optional(),
  CORS_ORIGIN: z.string().min(1).default("https://archer.software"),
});

export const env = envSchema.parse(process.env);
export type Env = typeof env;
