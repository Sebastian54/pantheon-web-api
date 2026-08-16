import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      accountId: string;
      networks: { id: string; name: string; role: "OWNER" | "ADMIN" | "MODERATOR" }[];
    } & DefaultSession["user"];
  }
}
