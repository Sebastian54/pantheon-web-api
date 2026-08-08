import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { encode } from "next-auth/jwt";
import { and, eq } from "drizzle-orm";
import { accounts, users } from "@pantheon/db";
import { env } from "../../config/env";
import { exchangeDiscordCode, fetchDiscordUser } from "../../lib/discord";
import {
  mobileDiscordAuthBodySchema,
  mobileDiscordAuthResponseSchema,
  mobileDiscordAuthErrorSchema,
} from "../../schemas/mobile-auth.schema";

// Matches apps/web's NextAuth default session maxAge (30 days) so mobile and
// web sessions behave consistently.
const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

/**
 * Native-app counterpart to apps/web's browser-based NextAuth Discord flow.
 * The app drives the Discord authorize step itself (PKCE, custom URL scheme
 * redirect) and hands us just the resulting code — we do the token exchange
 * server-side (the only place DISCORD_CLIENT_SECRET may live) and mint a
 * session token in the exact same format apps/api's requireOwner already
 * decodes, so mobile and web sessions are interchangeable.
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
      // flow's default: new users land as ADMIN with zero server grants.
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

      const token = await encode({
        token: { sub: user.id, name: user.name },
        secret: env.NEXTAUTH_SECRET,
        maxAge: SESSION_MAX_AGE_SECONDS,
      });

      return reply.code(200).send({
        token,
        user: { id: user.id, name: user.name, email: user.email, role: user.role },
      });
    },
  );
};

export default mobileAuthRoute;
