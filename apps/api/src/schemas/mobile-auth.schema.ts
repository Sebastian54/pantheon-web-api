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

export const mobileLoginBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export type MobileLoginBody = z.infer<typeof mobileLoginBodySchema>;

const mobileAuthUserSchema = z.object({
  id: z.string().uuid(),
  name: z.string().nullable(),
  email: z.string(),
});

// A successful /login either finishes the sign-in (token + user, same shape
// as /auth/mobile/discord) or, if the account has 2FA enabled, hands back a
// short-lived pendingToken instead — the client then calls /verify-2fa with
// that token plus the authenticator code to get the real session token.
export const mobileLoginResponseSchema = z.union([
  z.object({ token: z.string(), user: mobileAuthUserSchema }),
  z.object({ requiresTwoFactor: z.literal(true), pendingToken: z.string() }),
]);

export const mobileVerify2faBodySchema = z.object({
  pendingToken: z.string().min(1),
  code: z.string().min(1),
});

export type MobileVerify2faBody = z.infer<typeof mobileVerify2faBodySchema>;

export const mobileVerify2faResponseSchema = z.object({
  token: z.string(),
  user: mobileAuthUserSchema,
});

export const mobileAuthErrorSchema = mobileDiscordAuthErrorSchema;

export const mobileRegisterBodySchema = z.object({
  name: z.string().trim().min(1).optional(),
  email: z.string().email(),
  password: z.string().min(8),
});

export type MobileRegisterBody = z.infer<typeof mobileRegisterBodySchema>;

// No token here — mirrors apps/web's /register (no auto-login), and stays
// consistent with /login's own rule that an unverified account can't get a
// session token at all.
export const mobileRegisterResponseSchema = z.object({
  user: mobileAuthUserSchema,
});

// camelCase, matching login/register/verify-2fa's convention — unlike
// Discord's snake_case body, which exists specifically to match apps/web's
// Server Action form fields, not applicable here since there's no
// code/verifier/redirect_uri in the "verify an on-device-signed ID token"
// flow at all.
export const mobileGoogleAuthBodySchema = z.object({
  idToken: z.string().min(1),
});

export type MobileGoogleAuthBody = z.infer<typeof mobileGoogleAuthBodySchema>;

// Reuses mobileDiscordAuthResponseSchema's exact { token, user } shape —
// like Discord, this route never has a 2FA branch (an OAuth provider
// vouching for the identity makes that gate redundant for this path), so
// the plain object schema is a more accurate contract than reusing the
// /login union for a variant this route can never actually produce.
export const mobileGoogleAuthResponseSchema = mobileDiscordAuthResponseSchema;
