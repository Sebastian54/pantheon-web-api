import { db, servers, serverAccessGrants } from "@pantheon/db";
import { desc, eq, inArray } from "drizzle-orm";

export type ServerSummary = {
  id: string;
  serverUuid: string;
  networkId: string | null;
  name: string;
  loaderType: string;
  mcVersion: string;
  isActive: boolean;
  lastSeenAt: Date | null;
  playerCount: number;
  maxPlayers: number;
  tps: number;
  tps10s: number | null;
  mspt10s: number | null;
  cpuProcess10s: number | null;
  cpuSystem10s: number | null;
  hostileMobcapOverworld: number | null;
  memoryUsedMb: number | null;
  memoryTotalMb: number | null;
  diskUsedGb: number | null;
  diskTotalGb: number | null;
  installedMods: string[];
};

const SERVER_SUMMARY_COLUMNS = {
  id: true,
  serverUuid: true,
  networkId: true,
  name: true,
  loaderType: true,
  mcVersion: true,
  isActive: true,
  lastSeenAt: true,
  playerCount: true,
  maxPlayers: true,
  tps: true,
  tps10s: true,
  mspt10s: true,
  cpuProcess10s: true,
  cpuSystem10s: true,
  hostileMobcapOverworld: true,
  memoryUsedMb: true,
  memoryTotalMb: true,
  diskUsedGb: true,
  diskTotalGb: true,
  installedMods: true,
} as const;

type NetworkMembership = { id: string; role: "OWNER" | "ADMIN" | "MODERATOR" };

/**
 * OWNER/ADMIN see every server in that network; MODERATOR sees only servers
 * granted via server_access_grants. Aggregated across every network the user
 * belongs to — this dashboard doesn't have a per-network picker like the iOS
 * app does, everything is a merged view across all memberships.
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
        columns: SERVER_SUMMARY_COLUMNS,
      })),
    );
  }

  if (moderatorNetworkIds.size > 0) {
    const grants = await db.query.serverAccessGrants.findMany({
      where: eq(serverAccessGrants.userId, userId),
      with: { server: { columns: SERVER_SUMMARY_COLUMNS } },
    });

    for (const grant of grants) {
      if (grant.server.networkId && moderatorNetworkIds.has(grant.server.networkId)) {
        results.push(grant.server);
      }
    }
  }

  return results;
}

/**
 * A single server, only returned if the caller's membership actually grants
 * them visibility (same OWNER/ADMIN-full-access vs MODERATOR-granted-only
 * rule as getServersForUser) — the caller is responsible for treating a null
 * return as "not found", not distinguishing that from "exists but hidden".
 */
export async function getServerForUser(
  serverId: string,
  userId: string,
  networkMemberships: NetworkMembership[],
): Promise<ServerSummary | null> {
  const server = await db.query.servers.findFirst({
    where: eq(servers.id, serverId),
    columns: SERVER_SUMMARY_COLUMNS,
  });
  if (!server || !server.networkId) return null;

  const membership = networkMemberships.find((m) => m.id === server.networkId);
  if (!membership) return null;

  if (membership.role === "OWNER" || membership.role === "ADMIN") {
    return server;
  }

  const grants = await db.query.serverAccessGrants.findMany({
    where: eq(serverAccessGrants.userId, userId),
    columns: { serverUuid: true },
  });
  return grants.some((g) => g.serverUuid === server.serverUuid) ? server : null;
}
