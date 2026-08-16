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
  serverUuid: z.string().uuid(),
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

export const addNetworkMemberBodySchema = z.object({
  accountId: z.string().length(8),
});

export const networkMemberSchema = z.object({
  userId: z.string().uuid(),
  name: z.string().nullable(),
  accountId: z.string().length(8),
  role: z.enum(networkRoleEnum.enumValues),
  // This member's server_access_grants scoped to servers in *this* network
  // — grants are stored per-user with no network_id column of their own
  // (server_access_grants.server_uuid -> servers.network_id is how the
  // scoping happens), so every read/write here filters through this
  // network's own server list.
  serverUuids: z.array(z.string().uuid()),
});

export const networkMembersListResponseSchema = z.array(networkMemberSchema);

export const networkMemberParamsSchema = z.object({
  networkId: z.string().uuid(),
  userId: z.string().uuid(),
});

export const updateMemberGrantsBodySchema = z.object({
  serverUuids: z.array(z.string().uuid()),
});

// command_spy_logs stores server_id (the internal servers.id FK), not
// serverUuid — this is joined in at query time, not a raw column. Not
// nullable: server_id is NOT NULL with ON DELETE CASCADE (see
// packages/db/src/schema.ts), so a command_spy_logs row can't outlive its
// server or exist without one — the join always resolves.
export const networkCommandSpyLogSchema = z.object({
  id: z.string().uuid(),
  executor: z.string(),
  executorUuid: z.string().uuid().nullable(),
  command: z.string(),
  occurredAt: z.string(),
  serverUuid: z.string().uuid(),
});

export const networkCommandSpyLogsListResponseSchema = z.array(networkCommandSpyLogSchema);

// Every column but the identity fields is nullable — see
// packages/db/src/schema.ts's ait_tardises comment for why (AIT's save
// format isn't something to assume is always fully populated).
const aitTardisCoreFields = {
  uuid: z.string().uuid(),
  name: z.string().nullable(),
  owner: z.string().nullable(),
  ownerUuid: z.string().uuid().nullable(),
  fuel: z.number().nullable(),
  maxFuel: z.number().nullable(),
  powered: z.boolean().nullable(),
  locked: z.boolean().nullable(),
  travelState: z.string().nullable(),
  doorState: z.string().nullable(),
  dimension: z.string().nullable(),
  x: z.number().int().nullable(),
  y: z.number().int().nullable(),
  z: z.number().int().nullable(),
  updatedAt: z.string(),
};

export const networkTardisSummarySchema = z.object({
  ...aitTardisCoreFields,
  crewCount: z.number().int(),
});

export const networkTardisListResponseSchema = z.array(networkTardisSummarySchema);

// Crew/subsystem shapes aren't rigidly typed here — crew's exact fields
// depend on what the mod actually sends (see telemetry-ait-fleet.schema.ts's
// comment), and both are stored as jsonb passthrough rather than a schema
// this API asserts it fully understands.
export const networkTardisDetailSchema = z.object({
  ...aitTardisCoreFields,
  crew: z.array(z.record(z.unknown())),
  subsystems: z.array(z.object({ name: z.string(), enabled: z.boolean(), fitted: z.boolean() })),
});

export const networkTardisParamsSchema = z.object({
  networkId: z.string().uuid(),
  tardisUuid: z.string().uuid(),
});

// tardis/player/action/category/result are exact (case-insensitive) matches,
// contains is a substring search on detail only — mirrors the legacy
// webadmin-main AitLogSource's own filter semantics exactly (appendExact for
// the first five, no substring support there at all besides what this API
// adds for detail). Query string values always arrive as strings; z.coerce
// turns page/limit into numbers.
export const networkAitLogQuerySchema = z.object({
  tardis: z.string().min(1).optional(),
  player: z.string().min(1).optional(),
  action: z.string().min(1).optional(),
  category: z.string().min(1).optional(),
  result: z.string().min(1).optional(),
  after: z.string().datetime().optional(),
  before: z.string().datetime().optional(),
  contains: z.string().min(1).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export const networkAitLogEntrySchema = z.object({
  id: z.string().uuid(),
  clientLogId: z.number().int(),
  tardisId: z.string(),
  playerUuid: z.string().uuid().nullable(),
  playerName: z.string(),
  category: z.string(),
  action: z.string(),
  result: z.string().nullable(),
  fromDim: z.string().nullable(),
  fromX: z.number().int().nullable(),
  fromY: z.number().int().nullable(),
  fromZ: z.number().int().nullable(),
  toDim: z.string().nullable(),
  toX: z.number().int().nullable(),
  toY: z.number().int().nullable(),
  toZ: z.number().int().nullable(),
  detail: z.string().nullable(),
  occurredAt: z.string(),
});

export const networkAitLogListResponseSchema = z.array(networkAitLogEntrySchema);

// player/action/world/source are exact (case-insensitive) matches; object is
// a substring search — mirrors the legacy webadmin-main LedgerSource's own
// filter semantics exactly (appendExact for the first four, appendLike for
// object). Deliberately NOT z.coerce.boolean() for rolledBack: Zod's coerce
// just calls Boolean(value), so the literal string "false" would coerce to
// true (any non-empty string is truthy) — this maps the two real query
// values explicitly instead.
export const networkLedgerQuerySchema = z.object({
  player: z.string().min(1).optional(),
  action: z.string().min(1).optional(),
  world: z.string().min(1).optional(),
  object: z.string().min(1).optional(),
  source: z.string().min(1).optional(),
  rolledBack: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
  after: z.string().datetime().optional(),
  before: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export const networkLedgerEntrySchema = z.object({
  id: z.string().uuid(),
  clientLogId: z.number().int(),
  action: z.string(),
  world: z.string(),
  x: z.number().int(),
  y: z.number().int(),
  z: z.number().int(),
  object: z.string(),
  oldObject: z.string().nullable(),
  blockState: z.string().nullable(),
  oldBlockState: z.string().nullable(),
  source: z.string(),
  playerName: z.string().nullable(),
  playerUuid: z.string().uuid().nullable(),
  extraData: z.string().nullable(),
  rolledBack: z.boolean(),
  occurredAt: z.string(),
});

export const networkLedgerListResponseSchema = z.array(networkLedgerEntrySchema);

// Current derived state, not raw events — the useful view here is "who's
// flagged right now," computed from each TARDIS's latest anti_dupe_events
// row (see routes/v1/networks.ts's FLAGGING constant).
export const networkAntiDupeFlagSchema = z.object({
  tardisUuid: z.string().uuid(),
  creative: z.boolean(),
  since: z.string(),
  actor: z.string(),
});

export const networkAntiDupeListResponseSchema = z.array(networkAntiDupeFlagSchema);

const networkGriefLoggerKindSchema = z.enum(["blocks", "items", "containers", "chats"]);

// player is an exact (case-insensitive) match; contains is a substring
// search whose TARGET COLUMN depends on kind — message for chats, type for
// everything else — mirroring GriefLoggerSource.whereFor exactly.
export const networkGriefLoggerQuerySchema = z.object({
  kind: networkGriefLoggerKindSchema.default("blocks"),
  player: z.string().min(1).optional(),
  contains: z.string().min(1).optional(),
  after: z.string().datetime().optional(),
  before: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export const networkGriefLoggerEntrySchema = z.object({
  id: z.string().uuid(),
  kind: networkGriefLoggerKindSchema,
  playerName: z.string().nullable(),
  playerUuid: z.string().uuid().nullable(),
  world: z.string(),
  x: z.number().int(),
  y: z.number().int(),
  z: z.number().int(),
  type: z.string().nullable(),
  action: z.string().nullable(),
  amount: z.number().int().nullable(),
  message: z.string().nullable(),
  occurredAt: z.string(),
});

export const networkGriefLoggerListResponseSchema = z.array(networkGriefLoggerEntrySchema);

// player is an exact (case-insensitive) match on playerName; contains
// searches BOTH the advancement id and its title (an OR, not one or the
// other) — the peer's spec explicitly said "substring on advancement id/title".
export const networkAdvancementsQuerySchema = z.object({
  player: z.string().min(1).optional(),
  contains: z.string().min(1).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export const networkAdvancementEntrySchema = z.object({
  id: z.string().uuid(),
  playerUuid: z.string().uuid(),
  playerName: z.string(),
  advancement: z.string(),
  title: z.string().nullable(),
  frame: z.string().nullable(),
  dimension: z.string().nullable(),
  x: z.number().int().nullable(),
  y: z.number().int().nullable(),
  z: z.number().int().nullable(),
  occurredAt: z.string(),
});

export const networkAdvancementsListResponseSchema = z.array(networkAdvancementEntrySchema);
