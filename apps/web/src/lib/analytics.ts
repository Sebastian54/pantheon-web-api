import { db, playerSessions, players } from "@pantheon/db";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import type { VisibleServer } from "@/lib/visibility";

export type ActiveSession = {
  id: string;
  playerUuid: string;
  username: string | null;
  serverUuid: string;
  serverName: string;
  startedAt: Date;
  geolocationCountry: string | null;
};

export async function getActiveSessions(visibleServers: VisibleServer[]): Promise<ActiveSession[]> {
  if (visibleServers.length === 0) return [];
  const serverUuids = visibleServers.map((server) => server.serverUuid);
  const nameByUuid = new Map(visibleServers.map((server) => [server.serverUuid, server.name]));

  const rows = await db
    .select({
      id: playerSessions.id,
      playerUuid: playerSessions.playerUuid,
      username: players.username,
      serverUuid: playerSessions.serverUuid,
      startedAt: playerSessions.loginTime,
      geolocationCountry: playerSessions.geolocationCountry,
    })
    .from(playerSessions)
    .leftJoin(players, eq(players.uuid, playerSessions.playerUuid))
    .where(and(inArray(playerSessions.serverUuid, serverUuids), isNull(playerSessions.logoutTime)))
    .orderBy(desc(playerSessions.loginTime));

  return rows.map((row) => ({ ...row, serverName: nameByUuid.get(row.serverUuid) ?? "Unknown server" }));
}

export type CountryCount = { country: string; count: number };

/**
 * Distinct players per country, not session count — a player with sessions
 * from two different countries legitimately appears in both buckets, since
 * this counts "has at least one session from this country", not "belongs to
 * exactly one country". Sessions with no resolved country are dropped
 * entirely rather than bucketed as "Unknown", matching the iOS app.
 */
export async function getPlayerDemographics(visibleServerUuids: string[]): Promise<CountryCount[]> {
  if (visibleServerUuids.length === 0) return [];

  const rows = await db
    .selectDistinct({
      playerUuid: playerSessions.playerUuid,
      geolocationCountry: playerSessions.geolocationCountry,
    })
    .from(playerSessions)
    .where(inArray(playerSessions.serverUuid, visibleServerUuids));

  const counts = new Map<string, number>();
  for (const row of rows) {
    if (!row.geolocationCountry) continue;
    counts.set(row.geolocationCountry, (counts.get(row.geolocationCountry) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([country, count]) => ({ country, count }))
    .sort((a, b) => b.count - a.count);
}

export type LeaderboardEntry = { uuid: string; username: string; totalPlaytimeSeconds: number };

/**
 * Summed fresh from visible player_sessions rows, not players.totalPlaytimeSeconds
 * (a global running total across every network this deployment hosts) — same
 * reasoning as the API's leaderboard route, just scoped to "every server this
 * user can see" instead of one network.
 */
export async function getPlaytimeLeaderboard(visibleServerUuids: string[]): Promise<LeaderboardEntry[]> {
  if (visibleServerUuids.length === 0) return [];

  const totalPlaytimeSecondsExpr = sql<number>`SUM(EXTRACT(EPOCH FROM (COALESCE(${playerSessions.logoutTime}, now()) - ${playerSessions.loginTime})))`;

  const rows = await db
    .select({
      uuid: players.uuid,
      username: players.username,
      totalPlaytimeSeconds: totalPlaytimeSecondsExpr.as("total_playtime_seconds"),
    })
    .from(playerSessions)
    .innerJoin(players, eq(players.uuid, playerSessions.playerUuid))
    .where(inArray(playerSessions.serverUuid, visibleServerUuids))
    .groupBy(players.uuid, players.username)
    .orderBy(desc(totalPlaytimeSecondsExpr))
    .limit(100);

  return rows.map((row) => ({
    uuid: row.uuid,
    username: row.username,
    totalPlaytimeSeconds: Math.round(row.totalPlaytimeSeconds),
  }));
}
