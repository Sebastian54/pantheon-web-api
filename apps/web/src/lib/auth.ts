import type { NextAuthOptions } from "next-auth";
import DiscordProvider from "next-auth/providers/discord";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { eq } from "drizzle-orm";
import { db, users, accounts, sessions, verificationTokens } from "@pantheon/db";

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

        const dbUser = await db.query.users.findFirst({
          where: eq(users.id, token.sub),
          columns: { role: true },
        });
        session.user.role = dbUser?.role ?? "ADMIN";
      }
      return session;
    },
  },
};
