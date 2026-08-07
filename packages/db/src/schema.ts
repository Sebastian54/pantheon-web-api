import { relations } from "drizzle-orm";
import {
  boolean,
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
 * OWNER: global super-admin, implicit access to every server.
 * ADMIN: scoped access, granted per-server via userServers.
 */
export const roleEnum = pgEnum("role", ["OWNER", "ADMIN"]);

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
// NextAuth (Auth.js) core tables — extended with `role`
// Shape follows the official Drizzle adapter: https://authjs.dev/reference/adapter/drizzle
// ==============================================================================

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name"),
  email: text("email").notNull(),
  emailVerified: timestamp("email_verified", { mode: "date", withTimezone: true }),
  image: text("image"),

  // Discord OAuth identity is captured via the `accounts` table; this is
  // Pantheon's own authorization role, independent of the OAuth provider.
  role: roleEnum("role").notNull().default("ADMIN"),

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
// Servers — one row per registered Minecraft server (the "handshake" target)
// ==============================================================================

export const servers = pgTable("servers", {
  id: uuid("id").primaryKey().defaultRandom(),

  // Public identifier embedded in the plugin/mod config on the MC server side.
  serverUuid: uuid("server_uuid").notNull().defaultRandom(),

  name: varchar("name", { length: 128 }).notNull(),

  // Never store the raw API key — only a hash, verified on each request.
  apiKeyHash: text("api_key_hash").notNull(),

  loaderType: loaderTypeEnum("loader_type").notNull().default("PAPER"),
  mcVersion: varchar("mc_version", { length: 32 }).notNull(),

  isActive: boolean("is_active").notNull().default(true),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),

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
}));

// ==============================================================================
// User <-> Server relation — scopes ADMIN role users to specific servers.
// OWNER role users bypass this table entirely (global access).
// ==============================================================================

export const userServers = pgTable(
  "user_servers",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    serverId: uuid("server_id")
      .notNull()
      .references(() => servers.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.userId, table.serverId] }),
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

// ==============================================================================
// Relations (drizzle-orm query API)
// ==============================================================================

export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  sessions: many(sessions),
  userServers: many(userServers),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const serversRelations = relations(servers, ({ many }) => ({
  userServers: many(userServers),
  commandSpyLogs: many(commandSpyLogs),
  ledgerLogs: many(ledgerLogs),
}));

export const userServersRelations = relations(userServers, ({ one }) => ({
  user: one(users, { fields: [userServers.userId], references: [users.id] }),
  server: one(servers, { fields: [userServers.serverId], references: [servers.id] }),
}));

export const commandSpyLogsRelations = relations(commandSpyLogs, ({ one }) => ({
  server: one(servers, { fields: [commandSpyLogs.serverId], references: [servers.id] }),
}));

export const ledgerLogsRelations = relations(ledgerLogs, ({ one }) => ({
  server: one(servers, { fields: [ledgerLogs.serverId], references: [servers.id] }),
}));
