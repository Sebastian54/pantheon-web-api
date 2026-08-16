import { randomBytes } from "node:crypto";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { encode, decode } from "next-auth/jwt";
import { and, eq } from "drizzle-orm";
import { accounts, users, verificationTokens } from "@pantheon/db";
import { env } from "../../config/env";
import { exchangeDiscordCode, fetchDiscordUser } from "../../lib/discord";
import { hashPassword, verifyPassword } from "../../lib/password";
import { verifyTotpCode } from "../../lib/totp";
import { sendVerificationEmail } from "../../lib/mailgun";
import {
  mobileDiscordAuthBodySchema,
  mobileDiscordAuthResponseSchema,
  mobileDiscordAuthErrorSchema,
  mobileLoginBodySchema,
  mobileLoginResponseSchema,
  mobileVerify2faBodySchema,
  mobileVerify2faResponseSchema,
  mobileAuthErrorSchema,
  mobileRegisterBodySchema,
  mobileRegisterResponseSchema,
} from "../../schemas/mobile-auth.schema";

// Matches apps/web's NextAuth default session maxAge (30 days) so mobile and
// web sessions behave consistently.
const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

// Just long enough for a user to switch to their authenticator app and type
// a code — this token can only ever be exchanged via /verify-2fa, and only
// for the one account it was minted for, so a short lifetime is purely
// about limiting the window an intercepted pendingToken would be useful in.
const PENDING_2FA_TOKEN_MAX_AGE_SECONDS = 5 * 60;

// Matches apps/web's app/register/actions.ts#registerUser exactly — both
// paths write into the same verification_tokens table and are consumed by
// the same apps/web GET /verify-email route handler.
const VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

async function mintSessionToken(user: { id: string; name: string | null; email: string }) {
  const token = await encode({
    token: { sub: user.id, name: user.name },
    secret: env.NEXTAUTH_SECRET,
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return { token, user: { id: user.id, name: user.name, email: user.email } };
}

/**
 * Native-app counterpart to apps/web's browser-based NextAuth Discord flow.
 * The app drives the Discord authorize step itself (PKCE, custom URL scheme
 * redirect) and hands us just the resulting code — we do the token exchange
 * server-side (the only place DISCORD_CLIENT_SECRET may live) and mint a
 * session token in the exact same format apps/api's requireNetworkRole
 * already decodes, so mobile and web sessions are interchangeable.
 */
const mobileAuthRoute: FastifyPluginAsyncZod = async (fastify) => {
  fastify.post(
    "/auth/mobile/discord",
    {
      schema: {
        body: mobileDiscordAuthBodySchema,
        response: {
          200: mobileDiscordAuthResponseSchema,
          400: mobileDiscordAuthErrorSchema,
          401: mobileDiscordAuthErrorSchema,
          503: mobileDiscordAuthErrorSchema,
        },
      },
    },
    async (request, reply) => {
      if (!env.DISCORD_CLIENT_ID || !env.DISCORD_CLIENT_SECRET) {
        return reply
          .code(503)
          .send({ error: "Service Unavailable", message: "Discord mobile auth is not configured" });
      }

      const { code, code_verifier, redirect_uri } = request.body;

      let discordUser;
      try {
        const tokenResponse = await exchangeDiscordCode({
          code,
          codeVerifier: code_verifier,
          redirectUri: redirect_uri,
          clientId: env.DISCORD_CLIENT_ID,
          clientSecret: env.DISCORD_CLIENT_SECRET,
        });
        discordUser = await fetchDiscordUser(tokenResponse.access_token);
      } catch (error) {
        fastify.log.warn({ error }, "Discord mobile auth exchange failed");
        return reply.code(401).send({ error: "Unauthorized" });
      }

      if (!discordUser.email) {
        return reply.code(400).send({
          error: "Bad Request",
          message: "Discord authorization must include the 'email' scope",
        });
      }

      // 1. Already linked to a Pantheon account?
      const existingAccount = await fastify.db.query.accounts.findFirst({
        where: and(eq(accounts.provider, "discord"), eq(accounts.providerAccountId, discordUser.id)),
      });

      let user = existingAccount
        ? await fastify.db.query.users.findFirst({ where: eq(users.id, existingAccount.userId) })
        : undefined;

      // 2. First time this Discord account has signed in, but the email
      // matches an existing user (e.g. they signed up via the web dashboard
      // first) — link, but only if Discord has confirmed the user owns that
      // email. An unverified email is not sufficient proof to link accounts.
      if (!user && discordUser.verified) {
        user = await fastify.db.query.users.findFirst({ where: eq(users.email, discordUser.email) });
        if (user) {
          await fastify.db.insert(accounts).values({
            userId: user.id,
            type: "oauth",
            provider: "discord",
            providerAccountId: discordUser.id,
          });
        }
      }

      // 3. Genuinely new identity — create both rows. Matches the web
      // flow's default: new users land with zero network memberships.
      if (!user) {
        const [newUser] = await fastify.db
          .insert(users)
          .values({ name: discordUser.username, email: discordUser.email })
          .returning();
        user = newUser;

        await fastify.db.insert(accounts).values({
          userId: user.id,
          type: "oauth",
          provider: "discord",
          providerAccountId: discordUser.id,
        });
      }

      return reply.code(200).send(await mintSessionToken(user));
    },
  );

  /**
   * Native-app counterpart to apps/web's Credentials provider. Same
   * generic-401 rule as the web authorize() callback: "no such user",
   * "OAuth-only account (no passwordHash)", and "wrong password" are all
   * indistinguishable to the caller.
   */
  fastify.post(
    "/auth/mobile/login",
    {
      schema: {
        body: mobileLoginBodySchema,
        response: {
          200: mobileLoginResponseSchema,
          401: mobileAuthErrorSchema,
          403: mobileAuthErrorSchema,
        },
      },
    },
    async (request, reply) => {
      const { email, password } = request.body;

      const user = await fastify.db.query.users.findFirst({ where: eq(users.email, email) });
      if (!user?.passwordHash || !(await verifyPassword(password, user.passwordHash))) {
        return reply.code(401).send({ error: "Unauthorized" });
      }

      if (!user.emailVerified) {
        return reply.code(403).send({ error: "Forbidden", message: "Email not verified" });
      }

      if (user.twoFactorEnabled) {
        const pendingToken = await encode({
          token: { sub: user.id, pending2fa: true },
          secret: env.NEXTAUTH_SECRET,
          maxAge: PENDING_2FA_TOKEN_MAX_AGE_SECONDS,
        });
        return reply.code(200).send({ requiresTwoFactor: true, pendingToken });
      }

      return reply.code(200).send(await mintSessionToken(user));
    },
  );

  fastify.post(
    "/auth/mobile/verify-2fa",
    {
      schema: {
        body: mobileVerify2faBodySchema,
        response: {
          200: mobileVerify2faResponseSchema,
          401: mobileAuthErrorSchema,
        },
      },
    },
    async (request, reply) => {
      const { pendingToken, code } = request.body;

      // decode() itself rejects an expired token (standard JWT `exp` check),
      // so an expired pendingToken falls straight into the catch below.
      let decoded;
      try {
        decoded = await decode({ token: pendingToken, secret: env.NEXTAUTH_SECRET });
      } catch {
        decoded = null;
      }
      if (!decoded?.sub || decoded.pending2fa !== true) {
        return reply.code(401).send({ error: "Unauthorized", message: "Invalid or expired login attempt" });
      }

      const user = await fastify.db.query.users.findFirst({ where: eq(users.id, decoded.sub) });
      if (!user?.twoFactorEnabled || !user.twoFactorSecret) {
        return reply.code(401).send({ error: "Unauthorized" });
      }

      if (!(await verifyTotpCode(code, user.twoFactorSecret))) {
        return reply.code(401).send({ error: "Unauthorized", message: "Invalid two-factor code" });
      }

      return reply.code(200).send(await mintSessionToken(user));
    },
  );

  /**
   * Native-app counterpart to apps/web's /register Server Action. Same
   * no-auto-login rule: the account is created and a verification email
   * goes out, but the caller gets no session token — /login would reject
   * an unverified account anyway, so minting one here would just be a
   * session the client can't meaningfully keep using after re-login.
   */
  fastify.post(
    "/auth/mobile/register",
    {
      schema: {
        body: mobileRegisterBodySchema,
        response: {
          201: mobileRegisterResponseSchema,
          409: mobileAuthErrorSchema,
        },
      },
    },
    async (request, reply) => {
      const { name, password } = request.body;
      const email = request.body.email.toLowerCase();

      const existing = await fastify.db.query.users.findFirst({ where: eq(users.email, email) });
      if (existing) {
        return reply.code(409).send({ error: "Conflict", message: "An account with that email already exists" });
      }

      const passwordHash = await hashPassword(password);
      const [user] = await fastify.db
        .insert(users)
        .values({ name: name ?? null, email, passwordHash })
        .returning();

      const token = randomBytes(32).toString("hex");
      await fastify.db.transaction(async (tx) => {
        await tx.delete(verificationTokens).where(eq(verificationTokens.identifier, email));
        await tx.insert(verificationTokens).values({
          identifier: email,
          token,
          expires: new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS),
        });
      });

      const verifyUrl = `${env.CORS_ORIGIN}/verify-email?token=${token}&email=${encodeURIComponent(email)}`;
      try {
        await sendVerificationEmail(user.email, verifyUrl);
      } catch (error) {
        // Same tradeoff as apps/web's registerUser: the account exists
        // either way, so a Mailgun outage shouldn't turn into a 500 for a
        // request that otherwise fully succeeded.
        fastify.log.error({ error }, "Failed to send verification email");
      }

      return reply.code(201).send({ user: { id: user.id, name: user.name, email: user.email } });
    },
  );
};

export default mobileAuthRoute;
