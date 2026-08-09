import { db, servers, serverAccessGrants } from "@pantheon/db";
import { desc, eq, inArray } from "drizzle-orm";

export type ServerSummary = {
  id: string;
  serverUuid: string;
  name: string;
  loaderType: string;
  mcVersion: string;
  isActive: boolean;
  lastSeenAt: Date | null;
};

type NetworkMembership = { id: string; role: "OWNER" | "ADMIN" | "MODERATOR" };

/**
 * OWNER/ADMIN see every server in that network; MODERATOR sees only servers
 * granted via server_access_grants. Aggregated across every network the user
 * belongs to.
 */
export async function getServersForUser(
  userId: string,
  networkMemberships: NetworkMembership[],
): Promise<ServerSummary[]> {
  const fullAccessNetworkIds = networkMemberships
    .filter((membership) => membership.role === "OWNER" || membership.role === "ADMIN")
    .map((membership) => membership.id);
  const moderatorNetworkIds = new Set(
    networkMemberships.filter((membership) => membership.role === "MODERATOR").map((m) => m.id),
  );

  const results: ServerSummary[] = [];

  if (fullAccessNetworkIds.length > 0) {
    results.push(
      ...(await db.query.servers.findMany({
        where: inArray(servers.networkId, fullAccessNetworkIds),
        orderBy: desc(servers.createdAt),
      })),
    );
  }

  if (moderatorNetworkIds.size > 0) {
    const grants = await db.query.serverAccessGrants.findMany({
      where: eq(serverAccessGrants.userId, userId),
      with: { server: true },
    });

    for (const grant of grants) {
      if (grant.server.networkId && moderatorNetworkIds.has(grant.server.networkId)) {
        results.push(grant.server);
      }
    }
  }

  return results;
}
