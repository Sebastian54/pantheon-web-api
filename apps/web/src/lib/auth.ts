import type { NextAuthOptions } from "next-auth";
import DiscordProvider from "next-auth/providers/discord";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { eq } from "drizzle-orm";
import { db, users, accounts, sessions, verificationTokens, networkMembers } from "@pantheon/db";
import { verifyPassword } from "@/lib/password";
import { verifyTotpCode } from "@/lib/totp";
import { TWO_FACTOR_REQUIRED_ERROR, EMAIL_NOT_VERIFIED_ERROR } from "@/lib/auth-errors";

export const authOptions: NextAuthOptions = {
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  providers: [
    DiscordProvider({
      clientId: process.env.DISCORD_CLIENT_ID!,
      clientSecret: process.env.DISCORD_CLIENT_SECRET!,
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    CredentialsProvider({
      name: "Email and password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        // Only present on the form's second submission, once the first
        // (password-only) attempt has told the client 2FA is required.
        totpCode: { label: "Two-factor code", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials.password) return null;

        const user = await db.query.users.findFirst({ where: eq(users.email, credentials.email) });
        // Same null return for "no such user" and "wrong password" — never
        // tell an attacker which one it was. Also covers OAuth-only users
        // (no passwordHash set), who can't sign in via this provider at all.
        if (!user?.passwordHash) return null;

        const validPassword = await verifyPassword(credentials.password, user.passwordHash);
        if (!validPassword) return null;

        if (!user.emailVerified) {
          throw new Error(EMAIL_NOT_VERIFIED_ERROR);
        }

        if (user.twoFactorEnabled) {
          if (!credentials.totpCode) {
            throw new Error(TWO_FACTOR_REQUIRED_ERROR);
          }
          if (!(await verifyTotpCode(credentials.totpCode, user.twoFactorSecret!))) {
            throw new Error("Invalid two-factor code");
          }
        }

        return { id: user.id, name: user.name, email: user.email };
      },
    }),
  ],
  // JWT (not the adapter's database sessions) so apps/api can decode the
  // session token directly via next-auth/jwt, without a round-trip back here.
  session: { strategy: "jwt" },
  secret: process.env.NEXTAUTH_SECRET,
  pages: {
    signIn: "/sign-in",
  },
  callbacks: {
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;

        const memberships = await db.query.networkMembers.findMany({
          where: eq(networkMembers.userId, token.sub),
          columns: { role: true },
          with: { network: { columns: { id: true, name: true } } },
        });
        session.user.networks = memberships.map((membership) => ({
          id: membership.network.id,
          name: membership.network.name,
          role: membership.role,
        }));
      }
      return session;
    },
  },
};
