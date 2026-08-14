import { db, servers, serverAccessGrants } from "@pantheon/db";
import { eq, inArray } from "drizzle-orm";

export type NetworkMembership = { id: string; role: "OWNER" | "ADMIN" | "MODERATOR" };

export type VisibleServer = { id: string; serverUuid: string; name: string; networkId: string | null };

/**
 * Every server visible to this user across every network they belong to —
 * OWNER/ADMIN see every server in that network, MODERATOR only servers
 * granted via server_access_grants. Same rule as every network-scoped
 * Fastify route in apps/api, just aggregated across all networks instead of
 * scoped to one (this dashboard has no per-network picker). Returns full
 * lightweight records rather than bare ids since different tables key off
 * either the internal id (command_spy_logs, ait_logs, etc) or the public
 * serverUuid (player_sessions, server_access_grants) — callers pick
 * whichever field they need without a second query.
 */
export async function getVisibleServers(
  userId: string,
  networkMemberships: NetworkMembership[],
): Promise<VisibleServer[]> {
  const fullAccessNetworkIds = networkMemberships
    .filter((membership) => membership.role === "OWNER" || membership.role === "ADMIN")
    .map((membership) => membership.id);
  const moderatorNetworkIds = new Set(
    networkMemberships.filter((membership) => membership.role === "MODERATOR").map((m) => m.id),
  );

  const results: VisibleServer[] = [];
  const columns = { id: true, serverUuid: true, name: true, networkId: true } as const;

  if (fullAccessNetworkIds.length > 0) {
    results.push(
      ...(await db.query.servers.findMany({
        where: inArray(servers.networkId, fullAccessNetworkIds),
        columns,
      })),
    );
  }

  if (moderatorNetworkIds.size > 0) {
    const grants = await db.query.serverAccessGrants.findMany({
      where: eq(serverAccessGrants.userId, userId),
      with: { server: { columns } },
    });
    for (const grant of grants) {
      if (grant.server.networkId && moderatorNetworkIds.has(grant.server.networkId)) {
        results.push(grant.server);
      }
    }
  }

  return results;
}

export async function getVisibleServerIds(
  userId: string,
  networkMemberships: NetworkMembership[],
): Promise<string[]> {
  return (await getVisibleServers(userId, networkMemberships)).map((server) => server.id);
}
