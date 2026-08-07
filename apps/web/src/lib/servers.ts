import { db, servers, userServers } from "@pantheon/db";
import { desc, eq } from "drizzle-orm";

export type ServerSummary = {
  id: string;
  serverUuid: string;
  name: string;
  loaderType: string;
  mcVersion: string;
  isActive: boolean;
  lastSeenAt: Date | null;
};

/** OWNER sees every registered server; ADMIN sees only servers granted via user_servers. */
export async function getServersForUser(userId: string, role: "OWNER" | "ADMIN"): Promise<ServerSummary[]> {
  if (role === "OWNER") {
    return db.query.servers.findMany({ orderBy: desc(servers.createdAt) });
  }

  const rows = await db.query.userServers.findMany({
    where: eq(userServers.userId, userId),
    with: { server: true },
    orderBy: desc(userServers.createdAt),
  });

  return rows.map((row) => row.server);
}
