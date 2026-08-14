import {
  db,
  commandSpyLogs,
  ledgerBlockLogs,
  advancements,
  griefLoggerEvents,
  aitLogs,
  antiDupeEvents,
  aitTardises,
  players,
} from "@pantheon/db";
import { desc, eq, inArray } from "drizzle-orm";
import type { VisibleServer } from "@/lib/visibility";

// All of these cap at 100 rows, matching the same convention the Fastify API
// uses for these same tables — a single page, no pagination UI here yet.
const LIST_LIMIT = 100;

function nameById(visibleServers: VisibleServer[]) {
  return new Map(visibleServers.map((server) => [server.id, server.name]));
}

export type CommandSpyEntry = {
  id: string;
  executor: string;
  executorUuid: string | null;
  command: string;
  occurredAt: Date;
  serverName: string;
};

export async function getCommandSpyLogs(visibleServers: VisibleServer[]): Promise<CommandSpyEntry[]> {
  if (visibleServers.length === 0) return [];
  const names = nameById(visibleServers);

  const rows = await db.query.commandSpyLogs.findMany({
    where: inArray(commandSpyLogs.serverId, visibleServers.map((server) => server.id)),
    orderBy: desc(commandSpyLogs.occurredAt),
    limit: LIST_LIMIT,
  });

  return rows.map((row) => ({
    id: row.id,
    executor: row.executor,
    executorUuid: row.executorUuid,
    command: row.command,
    occurredAt: row.occurredAt,
    serverName: names.get(row.serverId) ?? "Unknown server",
  }));
}

export type LedgerEntry = {
  id: string;
  action: string;
  world: string;
  x: number;
  y: number;
  z: number;
  object: string;
  source: string;
  playerName: string | null;
  rolledBack: boolean;
  occurredAt: Date;
  serverName: string;
};

export async function getLedgerLogs(visibleServers: VisibleServer[]): Promise<LedgerEntry[]> {
  if (visibleServers.length === 0) return [];
  const names = nameById(visibleServers);

  const rows = await db.query.ledgerBlockLogs.findMany({
    where: inArray(ledgerBlockLogs.serverId, visibleServers.map((server) => server.id)),
    orderBy: desc(ledgerBlockLogs.occurredAt),
    limit: LIST_LIMIT,
  });

  return rows.map((row) => ({
    id: row.id,
    action: row.action,
    world: row.world,
    x: row.x,
    y: row.y,
    z: row.z,
    object: row.object,
    source: row.source,
    playerName: row.playerName,
    rolledBack: row.rolledBack,
    occurredAt: row.occurredAt,
    serverName: names.get(row.serverId) ?? "Unknown server",
  }));
}

export type AdvancementEntry = {
  id: string;
  playerName: string;
  advancement: string;
  title: string | null;
  frame: string | null;
  occurredAt: Date;
  serverName: string;
};

export async function getAdvancements(visibleServers: VisibleServer[]): Promise<AdvancementEntry[]> {
  if (visibleServers.length === 0) return [];
  const names = nameById(visibleServers);

  const rows = await db.query.advancements.findMany({
    where: inArray(advancements.serverId, visibleServers.map((server) => server.id)),
    orderBy: desc(advancements.occurredAt),
    limit: LIST_LIMIT,
  });

  return rows.map((row) => ({
    id: row.id,
    playerName: row.playerName,
    advancement: row.advancement,
    title: row.title,
    frame: row.frame,
    occurredAt: row.occurredAt,
    serverName: names.get(row.serverId) ?? "Unknown server",
  }));
}

export type GriefLoggerKind = "blocks" | "items" | "containers" | "chats";

export type GriefLoggerEntry = {
  id: string;
  kind: GriefLoggerKind;
  playerName: string | null;
  world: string;
  x: number;
  y: number;
  z: number;
  type: string | null;
  action: string | null;
  amount: number | null;
  message: string | null;
  occurredAt: Date;
  serverName: string;
};

export async function getGriefLoggerEvents(
  visibleServers: VisibleServer[],
  kind: GriefLoggerKind,
): Promise<GriefLoggerEntry[]> {
  if (visibleServers.length === 0) return [];
  const names = nameById(visibleServers);

  const rows = await db.query.griefLoggerEvents.findMany({
    where: (table, { and, eq: whereEq, inArray: whereInArray }) =>
      and(
        whereInArray(table.serverId, visibleServers.map((server) => server.id)),
        whereEq(table.kind, kind),
      ),
    orderBy: desc(griefLoggerEvents.occurredAt),
    limit: LIST_LIMIT,
  });

  return rows.map((row) => ({
    id: row.id,
    kind: row.kind as GriefLoggerKind,
    playerName: row.playerName,
    world: row.world,
    x: row.x,
    y: row.y,
    z: row.z,
    type: row.type,
    action: row.action,
    amount: row.amount,
    message: row.message,
    occurredAt: row.occurredAt,
    serverName: names.get(row.serverId) ?? "Unknown server",
  }));
}

export type AitLogEntry = {
  id: string;
  tardisId: string;
  playerName: string;
  category: string;
  action: string;
  result: string | null;
  fromDim: string | null;
  toDim: string | null;
  occurredAt: Date;
  serverName: string;
};

export async function getAitLogs(visibleServers: VisibleServer[]): Promise<AitLogEntry[]> {
  if (visibleServers.length === 0) return [];
  const names = nameById(visibleServers);

  const rows = await db.query.aitLogs.findMany({
    where: inArray(aitLogs.serverId, visibleServers.map((server) => server.id)),
    orderBy: desc(aitLogs.occurredAt),
    limit: LIST_LIMIT,
  });

  return rows.map((row) => ({
    id: row.id,
    tardisId: row.tardisId,
    playerName: row.playerName,
    category: row.category,
    action: row.action,
    result: row.result,
    fromDim: row.fromDim,
    toDim: row.toDim,
    occurredAt: row.occurredAt,
    serverName: names.get(row.serverId) ?? "Unknown server",
  }));
}

export type AntiDupeFlag = { tardisUuid: string; creative: boolean; since: Date; actor: string };

// Copied exactly from apps/api/src/routes/v1/networks.ts's ANTI_DUPE_FLAGGING_ACTIONS
// (itself copied from the legacy webadmin-main AntiDupeSource.FLAGGING).
const ANTI_DUPE_FLAGGING_ACTIONS = new Set(["PLACED_IN_CREATIVE", "SET_CREATIVE"]);

export async function getAntiDupeFlags(visibleServers: VisibleServer[]): Promise<AntiDupeFlag[]> {
  if (visibleServers.length === 0) return [];

  const latestPerTardis = await db
    .selectDistinctOn([antiDupeEvents.tardisUuid], {
      tardisUuid: antiDupeEvents.tardisUuid,
      action: antiDupeEvents.action,
      actor: antiDupeEvents.actor,
      occurredAt: antiDupeEvents.occurredAt,
    })
    .from(antiDupeEvents)
    .where(inArray(antiDupeEvents.serverId, visibleServers.map((server) => server.id)))
    .orderBy(antiDupeEvents.tardisUuid, desc(antiDupeEvents.occurredAt));

  return latestPerTardis.map((row) => ({
    tardisUuid: row.tardisUuid,
    creative: ANTI_DUPE_FLAGGING_ACTIONS.has(row.action.toUpperCase()),
    since: row.occurredAt,
    actor: row.actor,
  }));
}

export type TardisSummary = {
  uuid: string;
  name: string | null;
  owner: string | null;
  travelState: string | null;
  doorState: string | null;
  locked: boolean | null;
  fuel: number | null;
  maxFuel: number | null;
  crewCount: number;
  serverName: string;
};

export async function getTardises(visibleServers: VisibleServer[]): Promise<TardisSummary[]> {
  if (visibleServers.length === 0) return [];
  const names = nameById(visibleServers);

  const rows = await db.query.aitTardises.findMany({
    where: inArray(aitTardises.serverId, visibleServers.map((server) => server.id)),
  });

  return rows.map((row) => ({
    uuid: row.uuid,
    name: row.name,
    owner: row.owner,
    travelState: row.travelState,
    doorState: row.doorState,
    locked: row.locked,
    fuel: row.fuel,
    maxFuel: row.maxFuel,
    crewCount: Array.isArray(row.crew) ? row.crew.length : 0,
    serverName: names.get(row.serverId) ?? "Unknown server",
  }));
}

export type TardisDetail = {
  uuid: string;
  name: string | null;
  owner: string | null;
  ownerUuid: string | null;
  fuel: number | null;
  maxFuel: number | null;
  powered: boolean | null;
  locked: boolean | null;
  travelState: string | null;
  doorState: string | null;
  dimension: string | null;
  x: number | null;
  y: number | null;
  z: number | null;
  serverName: string;
  crew: { uuid: string; name: string | null; level: unknown; type: unknown }[];
  subsystems: { name: string; enabled: boolean; fitted: boolean }[];
};

/** Enriches crew with a resolved username the same way the API's tardis detail route does. */
export async function getTardisDetail(
  tardisUuid: string,
  visibleServers: VisibleServer[],
): Promise<TardisDetail | null> {
  const visibleServerIds = new Set(visibleServers.map((server) => server.id));
  const names = nameById(visibleServers);

  const tardis = await db.query.aitTardises.findFirst({ where: eq(aitTardises.uuid, tardisUuid) });
  if (!tardis || !visibleServerIds.has(tardis.serverId)) return null;

  const crewArray = Array.isArray(tardis.crew) ? (tardis.crew as Record<string, unknown>[]) : [];
  const crewUuids = crewArray
    .map((member) => member.uuid)
    .filter((uuid): uuid is string => typeof uuid === "string");

  const knownPlayers = crewUuids.length
    ? await db.query.players.findMany({ where: inArray(players.uuid, crewUuids), columns: { uuid: true, username: true } })
    : [];
  const usernameByUuid = new Map(knownPlayers.map((player) => [player.uuid, player.username]));

  return {
    uuid: tardis.uuid,
    name: tardis.name,
    owner: tardis.owner,
    ownerUuid: tardis.ownerUuid,
    fuel: tardis.fuel,
    maxFuel: tardis.maxFuel,
    powered: tardis.powered,
    locked: tardis.locked,
    travelState: tardis.travelState,
    doorState: tardis.doorState,
    dimension: tardis.dimension,
    x: tardis.x,
    y: tardis.y,
    z: tardis.z,
    serverName: names.get(tardis.serverId) ?? "Unknown server",
    crew: crewArray.map((member) => ({
      uuid: typeof member.uuid === "string" ? member.uuid : "",
      name: typeof member.uuid === "string" ? (usernameByUuid.get(member.uuid) ?? null) : null,
      level: member.level,
      type: member.type,
    })),
    subsystems: Array.isArray(tardis.subsystems)
      ? (tardis.subsystems as { name: string; enabled: boolean; fitted: boolean }[])
      : [],
  };
}
