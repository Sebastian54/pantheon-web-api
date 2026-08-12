import { relations } from "drizzle-orm";
import {
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

  // Live stats, pushed by the Minecraft server plugin via POST /api/v1/heartbeat.
  playerCount: integer("player_count").notNull().default(0),
  maxPlayers: integer("max_players").notNull().default(20),
  tps: doublePrecision("tps").notNull().default(20.0),

  // Extended live metrics, pushed by the telemetry mod via POST /api/v1/telemetry/ingest.
  mspt: doublePrecision("mspt").notNull().default(0),
  cpuUsage: doublePrecision("cpu_usage").notNull().default(0),
  targetTickrate: integer("target_tickrate").notNull().default(20),
  hostileMobcap: integer("hostile_mobcap").notNull().default(0),

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

// Append-only history of the same metrics servers.tps/mspt/cpuUsage/
// targetTickrate/hostileMobcap snapshot the latest value of — written
// alongside that snapshot on every POST /api/v1/telemetry/metrics so
// historical charts (e.g. TPS over time) are possible, which a single
// overwritten row on servers can't support.
export const serverMetrics = pgTable(
  "server_metrics",
  {
    id: uuid("id").notNull().defaultRandom(),
    serverId: uuid("server_id")
      .notNull()
      .references(() => servers.id, { onDelete: "cascade" }),

    tps: doublePrecision("tps").notNull(),
    mspt: doublePrecision("mspt").notNull(),
    cpuUsage: doublePrecision("cpu_usage").notNull(),
    targetTickrate: integer("target_tickrate").notNull(),
    hostileMobcap: integer("hostile_mobcap").notNull(),

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
