import { relations, sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import type { AdapterAccount } from "next-auth/adapters";

// ==============================================================================
// Enums
// ==============================================================================

/**
 * Per-network role, assigned via networkMembers. OWNER/ADMIN have implicit
 * access to every server in the network; MODERATOR needs an explicit
 * serverAccessGrants row per server.
 */
export const networkRoleEnum = pgEnum("network_role", ["OWNER", "ADMIN", "MODERATOR"]);

export const loaderTypeEnum = pgEnum("loader_type", [
  "VANILLA",
  "PAPER",
  "SPIGOT",
  "PURPUR",
  "FOLIA",
  "FORGE",
  "NEOFORGE",
  "FABRIC",
  "QUILT",
]);

// ==============================================================================
// NextAuth (Auth.js) core tables
// Shape follows the official Drizzle adapter: https://authjs.dev/reference/adapter/drizzle
// ==============================================================================

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name"),
  email: text("email").notNull(),
  emailVerified: timestamp("email_verified", { mode: "date", withTimezone: true }),
  image: text("image"),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
}, (table) => ({
  emailUniqueIdx: uniqueIndex("users_email_unique_idx").on(table.email),
}));

export const accounts = pgTable(
  "accounts",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccount["type"]>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.provider, table.providerAccountId] }),
  }),
);

export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date", withTimezone: true }).notNull(),
});

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date", withTimezone: true }).notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.identifier, table.token] }),
  }),
);

// ==============================================================================
// Networks — team/tenant boundary. Each network has one owner and any number
// of members (networkMembers); servers belong to exactly one network.
// ==============================================================================

export const networks = pgTable("networks", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 128 }).notNull(),

  // Deliberately restrict, not cascade (unlike most FKs below) — deleting a
  // user should never silently delete an entire network and its servers.
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

// ==============================================================================
// Network members — per-network role, independent of the global users.role.
// ==============================================================================

export const networkMembers = pgTable(
  "network_members",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    networkId: uuid("network_id")
      .notNull()
      .references(() => networks.id, { onDelete: "cascade" }),
    role: networkRoleEnum("role").notNull().default("MODERATOR"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.userId, table.networkId] }),
  }),
);

// ==============================================================================
// Servers — one row per registered Minecraft server (the "handshake" target)
// ==============================================================================

export const servers = pgTable("servers", {
  id: uuid("id").primaryKey().defaultRandom(),

  // Null until claimed into a network — POST /api/v1/register is an
  // unauthenticated handshake with no way to know which network (if any) a
  // freshly-booted server belongs to, so new rows land unclaimed. "set null"
  // (not cascade) on delete: removing a network shouldn't delete the
  // server/its event history, just orphan it back to unclaimed.
  networkId: uuid("network_id").references(() => networks.id, { onDelete: "set null" }),

  // Public identifier embedded in the plugin/mod config on the MC server side.
  serverUuid: uuid("server_uuid").notNull().defaultRandom(),

  name: varchar("name", { length: 128 }).notNull(),

  // Never store the raw API key — only a hash, verified on each request.
  apiKeyHash: text("api_key_hash").notNull(),

  loaderType: loaderTypeEnum("loader_type").notNull().default("PAPER"),
  mcVersion: varchar("mc_version", { length: 32 }).notNull(),

  isActive: boolean("is_active").notNull().default(true),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),

  // Mod IDs detected server-side (e.g. ["ledger", "spark", "carpet"]), pushed
  // via POST /api/v1/heartbeat so the iOS app can hide UI for mods that
  // aren't actually installed. A native text[] column, not jsonb — this is
  // always a flat list of ids, nothing that needs nested structure.
  installedMods: text("installed_mods").array().notNull().default(sql`'{}'::text[]`),

  // Live stats, pushed by the Minecraft server plugin via POST /api/v1/heartbeat.
  playerCount: integer("player_count").notNull().default(0),
  maxPlayers: integer("max_players").notNull().default(20),
  tps: doublePrecision("tps").notNull().default(20.0),

  // Extended live metrics, pushed by the telemetry mod via POST /api/v1/telemetry/metrics.
  // All nullable, no defaults — unlike tps/playerCount/maxPlayers above (always
  // available from the base server), these are only reported when the mod
  // detects Spark (tps10s/mspt10s/cpuProcess10s/cpuSystem10s) or Carpet
  // (hostileMobcapOverworld) actually installed, so "unknown" is a real,
  // common state, not an edge case.
  tps10s: doublePrecision("tps_10s"),
  mspt10s: doublePrecision("mspt_10s"),
  cpuProcess10s: doublePrecision("cpu_process_10s"),
  cpuSystem10s: doublePrecision("cpu_system_10s"),
  hostileMobcapOverworld: integer("hostile_mobcap_overworld"),

  // Host health — same sparse/nullable pattern as the metrics above. No
  // mod-side source for these exists yet (nothing in pantheon-mc-mod reads
  // memory/disk today), so this is a forward-looking contract for whatever
  // agent ends up reporting it, not something already verified end-to-end.
  memoryUsedMb: doublePrecision("memory_used_mb"),
  memoryTotalMb: doublePrecision("memory_total_mb"),
  diskUsedGb: doublePrecision("disk_used_gb"),
  diskTotalGb: doublePrecision("disk_total_gb"),

  // Short-lived pairing code shown at the console so an operator can link an
  // unclaimed server into their network without exposing the api_key. Null
  // once claimed (or once the 24h window lapses) — see routes/v1/register.ts
  // and routes/v1/networks.ts's link route.
  linkCode: varchar("link_code", { length: 9 }),
  linkCodeExpiresAt: timestamp("link_code_expires_at", { withTimezone: true }),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
}, (table) => ({
  serverUuidUniqueIdx: uniqueIndex("servers_server_uuid_unique_idx").on(table.serverUuid),
  // Deterministic SHA-256 hash — unique lets server auth look up a row by
  // hash alone (WHERE api_key_hash = ?) instead of needing a second header.
  apiKeyHashUniqueIdx: uniqueIndex("servers_api_key_hash_unique_idx").on(table.apiKeyHash),
  linkCodeUniqueIdx: uniqueIndex("servers_link_code_unique_idx").on(table.linkCode),
}));

// ==============================================================================
// Server access grants — whitelist of exactly which servers inside a network
// a given user may see, on top of their network_members role.
// ==============================================================================

export const serverAccessGrants = pgTable(
  "server_access_grants",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    serverUuid: uuid("server_uuid")
      .notNull()
      .references(() => servers.serverUuid, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.userId, table.serverUuid] }),
  }),
);

// ==============================================================================
// Event logs — TimescaleDB hypertables (converted in a follow-up custom
// migration; see packages/db/drizzle/*_hypertables.sql). `occurredAt` is the
// partitioning column, so it must be part of every unique/primary constraint.
// ==============================================================================

export const commandSpyLogs = pgTable(
  "command_spy_logs",
  {
    id: uuid("id").notNull().defaultRandom(),
    serverId: uuid("server_id")
      .notNull()
      .references(() => servers.id, { onDelete: "cascade" }),

    executor: varchar("executor", { length: 64 }).notNull(),
    executorUuid: uuid("executor_uuid"),
    command: text("command").notNull(),

    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.id, table.occurredAt] }),
    serverOccurredIdx: index("command_spy_logs_server_occurred_idx").on(
      table.serverId,
      table.occurredAt,
    ),
  }),
);

export const ledgerLogs = pgTable(
  "ledger_logs",
  {
    id: uuid("id").notNull().defaultRandom(),
    serverId: uuid("server_id")
      .notNull()
      .references(() => servers.id, { onDelete: "cascade" }),

    actor: varchar("actor", { length: 64 }).notNull(),
    actorUuid: uuid("actor_uuid"),
    actionType: varchar("action_type", { length: 64 }).notNull(),
    target: varchar("target", { length: 255 }),

    world: varchar("world", { length: 64 }),
    x: integer("x"),
    y: integer("y"),
    z: integer("z"),

    metadata: jsonb("metadata"),

    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.id, table.occurredAt] }),
    serverOccurredIdx: index("ledger_logs_server_occurred_idx").on(
      table.serverId,
      table.occurredAt,
    ),
  }),
);

export const blockLogs = pgTable(
  "block_logs",
  {
    id: uuid("id").notNull().defaultRandom(),
    serverId: uuid("server_id")
      .notNull()
      .references(() => servers.id, { onDelete: "cascade" }),

    // The log row's own id in the telemetry mod's local SQLite db. Not used
    // as our primary key (we generate our own), kept only for cross-referencing
    // against the mod's cursor when debugging a specific batch.
    clientLogId: integer("client_log_id").notNull(),

    source: varchar("source", { length: 64 }).notNull(),
    action: varchar("action", { length: 64 }).notNull(),

    x: integer("x"),
    y: integer("y"),
    z: integer("z"),

    metadata: jsonb("metadata"),

    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.id, table.occurredAt] }),
    serverOccurredIdx: index("block_logs_server_occurred_idx").on(
      table.serverId,
      table.occurredAt,
    ),
  }),
);

// Append-only history of the same metrics servers.tps10s/mspt10s/
// cpuProcess10s/cpuSystem10s/hostileMobcapOverworld snapshot the latest
// value of — written alongside that snapshot on every POST
// /api/v1/telemetry/metrics so historical charts (e.g. TPS over time) are
// possible, which a single overwritten row on servers can't support. All
// nullable, matching the snapshot columns — see the comment there.
export const serverMetrics = pgTable(
  "server_metrics",
  {
    id: uuid("id").notNull().defaultRandom(),
    serverId: uuid("server_id")
      .notNull()
      .references(() => servers.id, { onDelete: "cascade" }),

    tps10s: doublePrecision("tps_10s"),
    mspt10s: doublePrecision("mspt_10s"),
    cpuProcess10s: doublePrecision("cpu_process_10s"),
    cpuSystem10s: doublePrecision("cpu_system_10s"),
    hostileMobcapOverworld: integer("hostile_mobcap_overworld"),

    memoryUsedMb: doublePrecision("memory_used_mb"),
    memoryTotalMb: doublePrecision("memory_total_mb"),
    diskUsedGb: doublePrecision("disk_used_gb"),
    diskTotalGb: doublePrecision("disk_total_gb"),

    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.id, table.occurredAt] }),
    serverOccurredIdx: index("server_metrics_server_occurred_idx").on(
      table.serverId,
      table.occurredAt,
    ),
  }),
);

// ==============================================================================
// Players — Plan-style player analytics, a separate pipeline from Command
// Spy/Ledger/heartbeat/telemetry metrics (POST /api/v1/telemetry/players).
// `players` is deliberately global, not per-network/per-server: a Minecraft
// account uuid is one identity regardless of which server it's seen on, so
// totalPlaytimeSeconds accumulates across every server this whole
// multi-tenant deployment tracks — a player active on two different
// networks' servers gets one combined total, visible to either network via
// their own server's player_sessions rows.
// ==============================================================================

export const players = pgTable("players", {
  // The player's actual Minecraft account UUID — already a stable, unique,
  // permanent identity (Mojang never reassigns it), so it's the primary key
  // directly rather than a synthetic id + separate unique column.
  uuid: uuid("uuid").primaryKey(),
  username: varchar("username", { length: 16 }).notNull(),
  totalPlaytimeSeconds: integer("total_playtime_seconds").notNull().default(0),
  registeredAt: timestamp("registered_at", { withTimezone: true }).notNull(),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const playerSessions = pgTable(
  "player_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // The mod's/Plan's own session identifier. Only unique per-server (each
    // server's own Plan instance keeps its own counter/id space), not
    // globally — see the composite unique index below, which is also the
    // upsert's ON CONFLICT target (a session is first written on login with
    // logoutTime null, then updated in place once the player disconnects).
    sessionId: text("session_id").notNull(),

    playerUuid: uuid("player_uuid")
      .notNull()
      .references(() => players.uuid, { onDelete: "cascade" }),
    serverUuid: uuid("server_uuid")
      .notNull()
      .references(() => servers.serverUuid, { onDelete: "cascade" }),

    // Resolved location only — deliberately never a raw IP address. Not
    // constrained to a 2-letter ISO code: Plan's GeoIP resolution can emit a
    // full country name depending on its GeoIP database/config, so this has
    // to hold either.
    geolocationCountry: varchar("geolocation_country", { length: 128 }),
    geolocationCity: varchar("geolocation_city", { length: 128 }),

    loginTime: timestamp("login_time", { withTimezone: true }).notNull(),
    logoutTime: timestamp("logout_time", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    serverSessionUniqueIdx: uniqueIndex("player_sessions_server_session_unique_idx").on(
      table.serverUuid,
      table.sessionId,
    ),
    playerIdx: index("player_sessions_player_idx").on(table.playerUuid),
  }),
);

// ==============================================================================
// Adventures in Time (AIT) — live TARDIS fleet, ported from the legacy
// webadmin-main dashboard's TardisDataSource. Current-state snapshot (mc-mod
// POSTs the whole fleet periodically, upserted by uuid), not an append-only
// log — a regular table, not a hypertable. Every column but the identity
// fields is nullable despite the ingestion schema requiring them: the legacy
// source's own extensive comments explain why — AIT is a mod under active
// development with an undocumented save format, and a renamed/dropped field
// should degrade a column to null rather than break ingestion outright.
// Rows are pure upsert, never deleted when a TARDIS stops appearing in a
// later snapshot (e.g. destroyed) — they just go stale. crew/subsystems are
// jsonb rather than normalized tables since nothing needs to query into them
// independently, only display them on a single TARDIS's detail view.
// ==============================================================================

export const aitTardises = pgTable(
  "ait_tardises",
  {
    uuid: uuid("uuid").primaryKey(),
    serverId: uuid("server_id")
      .notNull()
      .references(() => servers.id, { onDelete: "cascade" }),

    name: varchar("name", { length: 128 }),
    owner: varchar("owner", { length: 64 }),
    // Absent from the legacy webadmin's data entirely ("there is no creator
    // uuid in the file" per TardisDataSource's own comment) — optional here
    // since the new mc-mod ingestion path may have better data than the old
    // file-scraper did, but can't be assumed to.
    ownerUuid: uuid("owner_uuid"),

    fuel: doublePrecision("fuel"),
    maxFuel: doublePrecision("max_fuel"),
    powered: boolean("powered"),
    locked: boolean("locked"),

    // Free-form strings, not enums — AIT's own state names, not something
    // this API should constrain to a guessed value list.
    travelState: varchar("travel_state", { length: 32 }),
    doorState: varchar("door_state", { length: 32 }),

    dimension: varchar("dimension", { length: 128 }),
    // Block coordinates — confirmed Integer in AIT's own data (TardisDataSource.Location),
    // not fractional.
    x: integer("x"),
    y: integer("y"),
    z: integer("z"),

    crew: jsonb("crew"),
    subsystems: jsonb("subsystems"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    serverIdx: index("ait_tardises_server_idx").on(table.serverId),
  }),
);

// AIT's TARDIS console log — a hypertable (occurredAt-partitioned), same
// shape as command_spy_logs, ported from the legacy webadmin-main
// AitLogSource. Append-only, insert-only — no dedupe constraint on the
// mod's own row id (clientLogId), matching command_spy_logs' precedent: an
// occasional duplicate row on a client-side retry is harmless, and that id
// isn't even unique across servers to begin with. Every field but the
// identity/category/action ones is nullable — confirmed directly from
// AitLogSource.java: e.g. from_*/to_* location fields are only populated for
// travel-related actions ("only take-offs carry both ends").
export const aitLogs = pgTable(
  "ait_logs",
  {
    id: uuid("id").notNull().defaultRandom(),
    serverId: uuid("server_id")
      .notNull()
      .references(() => servers.id, { onDelete: "cascade" }),

    // aitlog's own row id (a Java long) — not globally unique across
    // servers, kept only for cross-referencing a specific batch.
    clientLogId: bigint("client_log_id", { mode: "number" }).notNull(),

    tardisId: varchar("tardis_id", { length: 64 }).notNull(),
    playerUuid: uuid("player_uuid"),
    playerName: varchar("player_name", { length: 64 }).notNull(),
    category: varchar("category", { length: 64 }).notNull(),
    action: varchar("action", { length: 64 }).notNull(),
    result: varchar("result", { length: 64 }),

    fromDim: varchar("from_dim", { length: 128 }),
    fromX: integer("from_x"),
    fromY: integer("from_y"),
    fromZ: integer("from_z"),
    toDim: varchar("to_dim", { length: 128 }),
    toX: integer("to_x"),
    toY: integer("to_y"),
    toZ: integer("to_z"),

    detail: text("detail"),

    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.id, table.occurredAt] }),
    serverOccurredIdx: index("ait_logs_server_occurred_idx").on(table.serverId, table.occurredAt),
  }),
);

// Ledger's full block/grief change log — a hypertable, ported from the
// legacy webadmin-main LedgerSource (POST /api/v1/telemetry/ledger).
// Deliberately a separate table from the pre-existing ledgerLogs/
// POST /api/v1/ledger (a different, unrelated route) — that table was built
// speculatively early on, before any real Ledger plugin schema was ever
// verified against source; this one's field list and nullability are
// confirmed directly against LedgerSource.Row. x/y/z/action/world/object/
// source are always present (Ledger's own row can't exist without them);
// old_object/block_state/old_block_state/player_name/player_uuid/extra_data
// are nullable — LEFT JOINed in the legacy reader, since e.g. an
// environmental action (fire, an explosion, a piston) has no player at all.
export const ledgerBlockLogs = pgTable(
  "ledger_block_logs",
  {
    id: uuid("id").notNull().defaultRandom(),
    serverId: uuid("server_id")
      .notNull()
      .references(() => servers.id, { onDelete: "cascade" }),

    // Ledger's own row id (a Java long) — not globally unique across
    // servers, kept only for cross-referencing a specific batch.
    clientLogId: bigint("client_log_id", { mode: "number" }).notNull(),

    action: varchar("action", { length: 64 }).notNull(),
    world: varchar("world", { length: 64 }).notNull(),
    x: integer("x").notNull(),
    y: integer("y").notNull(),
    z: integer("z").notNull(),

    object: varchar("object", { length: 128 }).notNull(),
    oldObject: varchar("old_object", { length: 128 }),
    blockState: text("block_state"),
    oldBlockState: text("old_block_state"),

    // What caused it — "player", "fire", "explosion", etc, not who.
    source: varchar("source", { length: 64 }).notNull(),
    playerName: varchar("player_name", { length: 64 }),
    playerUuid: uuid("player_uuid"),

    extraData: text("extra_data"),
    rolledBack: boolean("rolled_back").notNull().default(false),

    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.id, table.occurredAt] }),
    serverOccurredIdx: index("ledger_block_logs_server_occurred_idx").on(
      table.serverId,
      table.occurredAt,
    ),
  }),
);

// ait-antidupe's creative-TARDIS flag log, ported from the legacy
// webadmin-main AntiDupeSource — a plain, small table, not a hypertable
// (low volume: "a handful of lines a week on a busy server" per that
// source's own comment). Insert-only, no dedupe constraint, matching
// command_spy_logs' precedent. Whether a TARDIS is "currently creative" is
// derived at read time from its latest event's action, not stored directly
// — see the FLAGGING action-name list in routes/v1/networks.ts, copied
// exactly from AntiDupeSource.FLAGGING.
export const antiDupeEvents = pgTable(
  "anti_dupe_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    serverId: uuid("server_id")
      .notNull()
      .references(() => servers.id, { onDelete: "cascade" }),

    tardisUuid: uuid("tardis_uuid").notNull(),
    action: varchar("action", { length: 32 }).notNull(),
    actor: varchar("actor", { length: 64 }).notNull(),

    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    serverIdx: index("anti_dupe_events_server_idx").on(table.serverId),
    tardisIdx: index("anti_dupe_events_tardis_idx").on(table.tardisUuid),
  }),
);

// The legacy GriefLogger archive — a hypertable, ported from webadmin-main's
// GriefLoggerSource. Confirmed low-priority/opt-in (unlike the other four
// sources, this one required manual path config in the legacy dashboard —
// there's no auto-discovery). `kind` discriminates between the four record
// types GriefLoggerSource.KINDS covers; type/action are null for chats,
// amount only applies to items/containers, message only to chats — same
// nullability GriefLoggerSource.selectFor's per-kind SELECT produces.
// player/playerUuid are nullable here even though the legacy reader's own
// INNER JOIN made them always-present: the new mc-mod ingestion path may
// source this differently, so this doesn't assume that guarantee holds.
export const griefLoggerEvents = pgTable(
  "grief_logger_events",
  {
    id: uuid("id").notNull().defaultRandom(),
    serverId: uuid("server_id")
      .notNull()
      .references(() => servers.id, { onDelete: "cascade" }),

    kind: varchar("kind", { length: 16 }).notNull(),

    playerName: varchar("player_name", { length: 64 }),
    playerUuid: uuid("player_uuid"),
    world: varchar("world", { length: 64 }).notNull(),
    x: integer("x").notNull(),
    y: integer("y").notNull(),
    z: integer("z").notNull(),

    type: varchar("type", { length: 128 }),
    action: varchar("action", { length: 32 }),
    amount: integer("amount"),
    message: text("message"),

    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.id, table.occurredAt] }),
    serverKindOccurredIdx: index("grief_logger_events_server_kind_occurred_idx").on(
      table.serverId,
      table.kind,
      table.occurredAt,
    ),
  }),
);

// ==============================================================================
// Relations (drizzle-orm query API)
// ==============================================================================

export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  sessions: many(sessions),
  ownedNetworks: many(networks),
  networkMemberships: many(networkMembers),
  serverAccessGrants: many(serverAccessGrants),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const networksRelations = relations(networks, ({ one, many }) => ({
  owner: one(users, { fields: [networks.ownerId], references: [users.id] }),
  members: many(networkMembers),
  servers: many(servers),
}));

export const networkMembersRelations = relations(networkMembers, ({ one }) => ({
  user: one(users, { fields: [networkMembers.userId], references: [users.id] }),
  network: one(networks, { fields: [networkMembers.networkId], references: [networks.id] }),
}));

export const serversRelations = relations(servers, ({ one, many }) => ({
  network: one(networks, { fields: [servers.networkId], references: [networks.id] }),
  accessGrants: many(serverAccessGrants),
  commandSpyLogs: many(commandSpyLogs),
  ledgerLogs: many(ledgerLogs),
  blockLogs: many(blockLogs),
  serverMetrics: many(serverMetrics),
  playerSessions: many(playerSessions),
  aitTardises: many(aitTardises),
  aitLogs: many(aitLogs),
  ledgerBlockLogs: many(ledgerBlockLogs),
  antiDupeEvents: many(antiDupeEvents),
  griefLoggerEvents: many(griefLoggerEvents),
}));

export const serverAccessGrantsRelations = relations(serverAccessGrants, ({ one }) => ({
  user: one(users, { fields: [serverAccessGrants.userId], references: [users.id] }),
  server: one(servers, {
    fields: [serverAccessGrants.serverUuid],
    references: [servers.serverUuid],
  }),
}));

export const commandSpyLogsRelations = relations(commandSpyLogs, ({ one }) => ({
  server: one(servers, { fields: [commandSpyLogs.serverId], references: [servers.id] }),
}));

export const ledgerLogsRelations = relations(ledgerLogs, ({ one }) => ({
  server: one(servers, { fields: [ledgerLogs.serverId], references: [servers.id] }),
}));

export const blockLogsRelations = relations(blockLogs, ({ one }) => ({
  server: one(servers, { fields: [blockLogs.serverId], references: [servers.id] }),
}));

export const serverMetricsRelations = relations(serverMetrics, ({ one }) => ({
  server: one(servers, { fields: [serverMetrics.serverId], references: [servers.id] }),
}));

export const playersRelations = relations(players, ({ many }) => ({
  sessions: many(playerSessions),
}));

export const playerSessionsRelations = relations(playerSessions, ({ one }) => ({
  player: one(players, { fields: [playerSessions.playerUuid], references: [players.uuid] }),
  server: one(servers, { fields: [playerSessions.serverUuid], references: [servers.serverUuid] }),
}));

export const aitTardisesRelations = relations(aitTardises, ({ one }) => ({
  server: one(servers, { fields: [aitTardises.serverId], references: [servers.id] }),
}));

export const aitLogsRelations = relations(aitLogs, ({ one }) => ({
  server: one(servers, { fields: [aitLogs.serverId], references: [servers.id] }),
}));

export const ledgerBlockLogsRelations = relations(ledgerBlockLogs, ({ one }) => ({
  server: one(servers, { fields: [ledgerBlockLogs.serverId], references: [servers.id] }),
}));

export const antiDupeEventsRelations = relations(antiDupeEvents, ({ one }) => ({
  server: one(servers, { fields: [antiDupeEvents.serverId], references: [servers.id] }),
}));

export const griefLoggerEventsRelations = relations(griefLoggerEvents, ({ one }) => ({
  server: one(servers, { fields: [griefLoggerEvents.serverId], references: [servers.id] }),
}));
