import type { NextAuthOptions } from "next-auth";
import DiscordProvider from "next-auth/providers/discord";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { eq } from "drizzle-orm";
import { db, users, accounts, sessions, verificationTokens, networkMembers } from "@pantheon/db";

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
