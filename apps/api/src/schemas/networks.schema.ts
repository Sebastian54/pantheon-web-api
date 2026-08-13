import { z } from "zod";
import { networkRoleEnum } from "@pantheon/db";

export const createNetworkBodySchema = z.object({
  name: z.string().trim().min(1).max(128),
});

export type CreateNetworkBody = z.infer<typeof createNetworkBodySchema>;

export const networkResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  ownerId: z.string().uuid(),
  role: z.enum(networkRoleEnum.enumValues),
  createdAt: z.string(),
});

export const networksListResponseSchema = z.array(networkResponseSchema);

export const networkIdParamsSchema = z.object({
  networkId: z.string().uuid(),
});

// camelCase, like the rest of this file — unlike registerServerBodySchema,
// this endpoint is JS/mobile-facing, not Java-plugin-consumed.
export const linkServerBodySchema = z.object({
  linkCode: z.string().trim().min(1),
});

export const linkServerResponseSchema = z.object({
  id: z.string().uuid(),
  serverUuid: z.string().uuid(),
  name: z.string(),
  networkId: z.string().uuid(),
});

// Generic error shape, reused across every route below that can 404/403.
export const apiErrorSchema = z.object({
  error: z.string(),
  message: z.string().optional(),
});

// Fastify skips body serialization entirely for a 204 status regardless of
// the declared schema, but fastify-type-provider-zod still needs a schema
// entry to know the response is expected to validate against "no value".
export const noContentResponseSchema = z.void();

export const networkServerSummarySchema = z.object({
  id: z.string().uuid(),
  serverUuid: z.string().uuid(),
  name: z.string(),
  loaderType: z.string(),
  mcVersion: z.string(),
  isActive: z.boolean(),
  playerCount: z.number().int(),
  maxPlayers: z.number().int(),
  tps: z.number(),
  // Spark/Carpet-derived, all nullable — absent whenever the mod hasn't
  // reported them yet (e.g. those mods aren't installed on that server).
  // See apps/api/src/schemas/telemetry.schema.ts for why these are split out
  // from `tps` above rather than replacing it (different data source).
  tps10s: z.number().nullable(),
  mspt10s: z.number().nullable(),
  cpuProcess10s: z.number().nullable(),
  cpuSystem10s: z.number().nullable(),
  hostileMobcapOverworld: z.number().int().nullable(),
  // Host health — same sparse/nullable contract as the metrics above; see
  // packages/db/src/schema.ts for why this has no verified mod-side source yet.
  memoryUsedMb: z.number().nullable(),
  memoryTotalMb: z.number().nullable(),
  diskUsedGb: z.number().nullable(),
  diskTotalGb: z.number().nullable(),
  installedMods: z.array(z.string()),
  lastSeenAt: z.string().nullable(),
  createdAt: z.string(),
});

export const networkServersListResponseSchema = z.array(networkServerSummarySchema);

export const networkServerParamsSchema = z.object({
  networkId: z.string().uuid(),
  serverUuid: z.string().uuid(),
});

export const renameServerBodySchema = z.object({
  name: z.string().trim().min(1).max(128),
});

// camelCase, like the rest of this file — mobile/JS-facing, not
// Java-plugin-consumed (see the convention note above linkServerBodySchema).
export const networkPlayerSessionSchema = z.object({
  id: z.string().uuid(),
  playerUuid: z.string().uuid(),
  startedAt: z.string(),
  endedAt: z.string().nullable(),
  durationMinutes: z.number().int(),
  // Either a 2-letter ISO code or a full country name, depending on how
  // Plan resolved it — see packages/db/src/schema.ts's player_sessions
  // comment. Null until Plan's async GeoIP lookup resolves it.
  geolocationCountry: z.string().nullable(),
});

export const networkPlayerSessionsListResponseSchema = z.array(networkPlayerSessionSchema);

// Deliberately NOT players.totalPlaytimeSeconds (that column is a global
// running total across every network this deployment hosts — see
// packages/db/src/schema.ts's comment on the players table). This is
// computed fresh per request from this network's own player_sessions rows
// only, so a player shared between two networks doesn't leak their
// playtime on one network's servers into another network's leaderboard.
export const networkPlaytimeLeaderboardEntrySchema = z.object({
  uuid: z.string().uuid(),
  username: z.string(),
  totalPlaytimeSeconds: z.number().int(),
});

export const networkPlaytimeLeaderboardResponseSchema = z.array(networkPlaytimeLeaderboardEntrySchema);
