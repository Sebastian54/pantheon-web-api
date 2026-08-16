import { z } from "zod";

// A blank `KEY=` line in a .env file is still a *present* key with an empty
// string value, not an absent one — `.optional()`/`.default()` only kick in
// for `undefined`. Without this, e.g. `SENTRY_DSN=` (left blank on purpose)
// fails `.url()` and crashes the process on boot instead of being skipped.
const emptyToUndefined = (val: unknown) => (val === "" ? undefined : val);

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

  SENTRY_DSN: z.preprocess(emptyToUndefined, z.string().url().optional()),
  CORS_ORIGIN: z.preprocess(
    emptyToUndefined,
    z.string().min(1).default("https://archer.software"),
  ),

  // Same Discord application as apps/web's NextAuth config. Optional at the
  // env-schema level (not required-to-boot) so an unconfigured deployment
  // doesn't crash-loop the whole API the way SENTRY_DSN did — the mobile
  // auth route checks for these itself and returns a clear 503 if unset.
  DISCORD_CLIENT_ID: z.preprocess(emptyToUndefined, z.string().optional()),
  DISCORD_CLIENT_SECRET: z.preprocess(emptyToUndefined, z.string().optional()),

  // GitHub Student Pack Mailgun credits — used by /auth/mobile/register to
  // send its own verification email directly (this API never calls into
  // apps/web, so it can't reuse apps/web's Mailgun send). Optional for the
  // same crash-loop-avoidance reason as the Discord vars above: a failed
  // send is logged and swallowed by the route, not fatal to boot.
  MAILGUN_API_KEY: z.preprocess(emptyToUndefined, z.string().optional()),
  MAILGUN_DOMAIN: z.preprocess(emptyToUndefined, z.string().optional()),
  MAILGUN_API_BASE: z.preprocess(emptyToUndefined, z.string().url().optional()),
});

export const env = envSchema.parse(process.env);
export type Env = typeof env;
