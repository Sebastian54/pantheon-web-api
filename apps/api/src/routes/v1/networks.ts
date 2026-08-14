import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { and, desc, eq, gt, gte, ilike, inArray, lte, or, sql } from "drizzle-orm";
import {
  networks,
  networkMembers,
  servers,
  serverAccessGrants,
  playerSessions,
  players,
  commandSpyLogs,
  aitTardises,
  aitLogs,
  ledgerBlockLogs,
  antiDupeEvents,
  griefLoggerEvents,
  advancements,
} from "@pantheon/db";
import { normalizeLinkCode } from "../../lib/crypto";
import {
  apiErrorSchema,
  createNetworkBodySchema,
  linkServerBodySchema,
  linkServerResponseSchema,
  networkAdvancementsListResponseSchema,
  networkAdvancementsQuerySchema,
  networkAitLogListResponseSchema,
  networkAitLogQuerySchema,
  networkAntiDupeListResponseSchema,
  networkCommandSpyLogsListResponseSchema,
  networkGriefLoggerListResponseSchema,
  networkGriefLoggerQuerySchema,
  networkIdParamsSchema,
  networkLedgerListResponseSchema,
  networkLedgerQuerySchema,
  networkPlayerSessionsListResponseSchema,
  networkPlaytimeLeaderboardResponseSchema,
  networkResponseSchema,
  networkServerParamsSchema,
  networkServerSummarySchema,
  networkServersListResponseSchema,
  networksListResponseSchema,
  networkTardisDetailSchema,
  networkTardisListResponseSchema,
  networkTardisParamsSchema,
  noContentResponseSchema,
  renameServerBodySchema,
} from "../../schemas/networks.schema";

const networksRoute: FastifyPluginAsyncZod = async (fastify) => {
  fastify.get(
    "/networks",
    {
      preHandler: fastify.requireAuth,
      schema: {
        response: { 200: networksListResponseSchema },
      },
    },
    async (request) => {
      const memberships = await fastify.db.query.networkMembers.findMany({
        where: eq(networkMembers.userId, request.session!.userId),
        with: { network: true },
      });

      return memberships.map((membership) => ({
        id: membership.network.id,
        name: membership.network.name,
        ownerId: membership.network.ownerId,
        role: membership.role,
        createdAt: membership.network.createdAt.toISOString(),
      }));
    },
  );

  fastify.post(
    "/networks",
    {
      preHandler: fastify.requireAuth,
      schema: {
        body: createNetworkBodySchema,
        response: { 201: networkResponseSchema },
      },
    },
    async (request, reply) => {
      const { name } = request.body;
      const userId = request.session!.userId;

      const network = await fastify.db.transaction(async (tx) => {
        const [created] = await tx.insert(networks).values({ name, ownerId: userId }).returning();
        await tx.insert(networkMembers).values({ userId, networkId: created.id, role: "OWNER" });
        return created;
      });

      return reply.code(201).send({
        id: network.id,
        name: network.name,
        ownerId: network.ownerId,
        role: "OWNER" as const,
        createdAt: network.createdAt.toISOString(),
      });
    },
  );

  fastify.get(
    "/networks/:networkId/servers",
    {
      // Lowest rank ("MODERATOR") — this just requires *some* network_members
      // row, i.e. any role counts as membership, per Task 1.2.
      preHandler: fastify.requireNetworkRole("MODERATOR"),
      schema: {
        params: networkIdParamsSchema,
        response: { 200: networkServersListResponseSchema },
      },
    },
    async (request) => {
      const { networkId } = request.params;
      const { userId, networkRole } = request.session!;

      // OWNER/ADMIN see every server in the network; MODERATOR only sees
      // servers explicitly granted via server_access_grants — same rule
      // apps/web's dashboard applies (lib/servers.ts).
      const networkServers =
        networkRole === "MODERATOR"
          ? (
              await fastify.db.query.serverAccessGrants.findMany({
                where: eq(serverAccessGrants.userId, userId),
                with: { server: true },
              })
            )
              .map((grant) => grant.server)
              .filter((server) => server.networkId === networkId)
          : await fastify.db.query.servers.findMany({
              where: eq(servers.networkId, networkId),
            });

      return networkServers.map((server) => ({
        id: server.id,
        serverUuid: server.serverUuid,
        name: server.name,
        loaderType: server.loaderType,
        mcVersion: server.mcVersion,
        isActive: server.isActive,
        playerCount: server.playerCount,
        maxPlayers: server.maxPlayers,
        tps: server.tps,
        tps10s: server.tps10s,
        mspt10s: server.mspt10s,
        cpuProcess10s: server.cpuProcess10s,
        cpuSystem10s: server.cpuSystem10s,
        hostileMobcapOverworld: server.hostileMobcapOverworld,
        memoryUsedMb: server.memoryUsedMb,
        memoryTotalMb: server.memoryTotalMb,
        diskUsedGb: server.diskUsedGb,
        diskTotalGb: server.diskTotalGb,
        installedMods: server.installedMods,
        lastSeenAt: server.lastSeenAt ? server.lastSeenAt.toISOString() : null,
        createdAt: server.createdAt.toISOString(),
      }));
    },
  );

  fastify.get(
    "/networks/:networkId/players/sessions",
    {
      // Same visibility rule as GET /networks/:networkId/servers above:
      // OWNER/ADMIN see sessions from every server in the network, MODERATOR
      // only sessions from servers explicitly granted to them.
      preHandler: fastify.requireNetworkRole("MODERATOR"),
      schema: {
        params: networkIdParamsSchema,
        response: { 200: networkPlayerSessionsListResponseSchema },
      },
    },
    async (request) => {
      const { networkId } = request.params;
      const { userId, networkRole } = request.session!;

      const visibleServerUuids =
        networkRole === "MODERATOR"
          ? (
              await fastify.db.query.serverAccessGrants.findMany({
                where: eq(serverAccessGrants.userId, userId),
                with: { server: true },
              })
            )
              .map((grant) => grant.server)
              .filter((server) => server.networkId === networkId)
              .map((server) => server.serverUuid)
          : (
              await fastify.db.query.servers.findMany({
                where: eq(servers.networkId, networkId),
              })
            ).map((server) => server.serverUuid);

      if (visibleServerUuids.length === 0) {
        return [];
      }

      const sessions = await fastify.db.query.playerSessions.findMany({
        where: inArray(playerSessions.serverUuid, visibleServerUuids),
      });

      const now = Date.now();
      return sessions.map((session) => ({
        id: session.id,
        playerUuid: session.playerUuid,
        serverUuid: session.serverUuid,
        startedAt: session.loginTime.toISOString(),
        endedAt: session.logoutTime ? session.logoutTime.toISOString() : null,
        durationMinutes: Math.round(
          ((session.logoutTime ? session.logoutTime.getTime() : now) - session.loginTime.getTime()) / 60000,
        ),
        geolocationCountry: session.geolocationCountry,
      }));
    },
  );

  fastify.get(
    "/networks/:networkId/players/leaderboard",
    {
      // Same visibility rule as the two routes above.
      preHandler: fastify.requireNetworkRole("MODERATOR"),
      schema: {
        params: networkIdParamsSchema,
        response: { 200: networkPlaytimeLeaderboardResponseSchema },
      },
    },
    async (request) => {
      const { networkId } = request.params;
      const { userId, networkRole } = request.session!;

      const visibleServerUuids =
        networkRole === "MODERATOR"
          ? (
              await fastify.db.query.serverAccessGrants.findMany({
                where: eq(serverAccessGrants.userId, userId),
                with: { server: true },
              })
            )
              .map((grant) => grant.server)
              .filter((server) => server.networkId === networkId)
              .map((server) => server.serverUuid)
          : (
              await fastify.db.query.servers.findMany({
                where: eq(servers.networkId, networkId),
              })
            ).map((server) => server.serverUuid);

      if (visibleServerUuids.length === 0) {
        return [];
      }

      // Deliberately NOT players.totalPlaytimeSeconds (a global running total
      // across every network) — summed fresh from this network's own
      // player_sessions rows only, so a player shared between two networks
      // can't leak their playtime on one network's servers into another's
      // leaderboard. Active sessions (logoutTime still null) count elapsed
      // time up to now(), same as the /players/sessions route's duration calc.
      const totalPlaytimeSecondsExpr = sql<number>`SUM(EXTRACT(EPOCH FROM (COALESCE(${playerSessions.logoutTime}, now()) - ${playerSessions.loginTime})))`;

      const rows = await fastify.db
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
    },
  );

  fastify.get(
    "/networks/:networkId/command-spy",
    {
      // Same visibility rule as the routes above.
      preHandler: fastify.requireNetworkRole("MODERATOR"),
      schema: {
        params: networkIdParamsSchema,
        response: { 200: networkCommandSpyLogsListResponseSchema },
      },
    },
    async (request) => {
      const { networkId } = request.params;
      const { userId, networkRole } = request.session!;

      // Unlike the other network-scoped routes above, this needs the
      // internal server ids (not serverUuid) — command_spy_logs.server_id
      // references servers.id.
      const visibleServerIds =
        networkRole === "MODERATOR"
          ? (
              await fastify.db.query.serverAccessGrants.findMany({
                where: eq(serverAccessGrants.userId, userId),
                with: { server: true },
              })
            )
              .map((grant) => grant.server)
              .filter((server) => server.networkId === networkId)
              .map((server) => server.id)
          : (
              await fastify.db.query.servers.findMany({
                where: eq(servers.networkId, networkId),
              })
            ).map((server) => server.id);

      if (visibleServerIds.length === 0) {
        return [];
      }

      // Every executed command gets a row here (a TimescaleDB hypertable —
      // see packages/db/src/schema.ts), so this is much higher-volume than
      // the sessions/leaderboard routes above. Capped to the most recent 100
      // with no pagination yet, matching the leaderboard route's limit.
      const rows = await fastify.db
        .select({
          id: commandSpyLogs.id,
          executor: commandSpyLogs.executor,
          executorUuid: commandSpyLogs.executorUuid,
          command: commandSpyLogs.command,
          occurredAt: commandSpyLogs.occurredAt,
          serverUuid: servers.serverUuid,
        })
        .from(commandSpyLogs)
        .innerJoin(servers, eq(servers.id, commandSpyLogs.serverId))
        .where(inArray(commandSpyLogs.serverId, visibleServerIds))
        .orderBy(desc(commandSpyLogs.occurredAt))
        .limit(100);

      return rows.map((row) => ({
        id: row.id,
        executor: row.executor,
        executorUuid: row.executorUuid,
        command: row.command,
        occurredAt: row.occurredAt.toISOString(),
        serverUuid: row.serverUuid,
      }));
    },
  );

  fastify.get(
    "/networks/:networkId/tardises",
    {
      // Same visibility rule as the routes above.
      preHandler: fastify.requireNetworkRole("MODERATOR"),
      schema: {
        params: networkIdParamsSchema,
        response: { 200: networkTardisListResponseSchema },
      },
    },
    async (request) => {
      const { networkId } = request.params;
      const { userId, networkRole } = request.session!;

      const visibleServerIds =
        networkRole === "MODERATOR"
          ? (
              await fastify.db.query.serverAccessGrants.findMany({
                where: eq(serverAccessGrants.userId, userId),
                with: { server: true },
              })
            )
              .map((grant) => grant.server)
              .filter((server) => server.networkId === networkId)
              .map((server) => server.id)
          : (
              await fastify.db.query.servers.findMany({
                where: eq(servers.networkId, networkId),
              })
            ).map((server) => server.id);

      if (visibleServerIds.length === 0) {
        return [];
      }

      const tardises = await fastify.db.query.aitTardises.findMany({
        where: inArray(aitTardises.serverId, visibleServerIds),
      });

      return tardises.map((tardis) => ({
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
        crewCount: Array.isArray(tardis.crew) ? tardis.crew.length : 0,
        updatedAt: tardis.updatedAt.toISOString(),
      }));
    },
  );

  fastify.get(
    "/networks/:networkId/tardises/:tardisUuid",
    {
      preHandler: fastify.requireNetworkRole("MODERATOR"),
      schema: {
        params: networkTardisParamsSchema,
        response: { 200: networkTardisDetailSchema, 404: apiErrorSchema },
      },
    },
    async (request, reply) => {
      const { networkId, tardisUuid } = request.params;
      const { userId, networkRole } = request.session!;

      const visibleServerIds =
        networkRole === "MODERATOR"
          ? (
              await fastify.db.query.serverAccessGrants.findMany({
                where: eq(serverAccessGrants.userId, userId),
                with: { server: true },
              })
            )
              .map((grant) => grant.server)
              .filter((server) => server.networkId === networkId)
              .map((server) => server.id)
          : (
              await fastify.db.query.servers.findMany({
                where: eq(servers.networkId, networkId),
              })
            ).map((server) => server.id);

      const tardis = await fastify.db.query.aitTardises.findFirst({
        where: eq(aitTardises.uuid, tardisUuid),
      });

      if (!tardis || !visibleServerIds.includes(tardis.serverId)) {
        return reply.code(404).send({ error: "Not Found", message: "TARDIS not found in this network" });
      }

      // AIT's own crew/loyalty data has no player name at all (confirmed with
      // mc-mod — it's not in the source file format), only a uuid. Rather than
      // have the client resolve names via Mojang's API (an external dependency
      // that would leak crew UUIDs to a third party for something resolvable
      // internally), enrich each crew member with a username here whenever
      // that uuid has shown up in players (Plan-tracked sessions populate that
      // table already) — a pure enhancement, null when never Plan-tracked, the
      // client already falls back to a truncated uuid for that case.
      const crewArray = Array.isArray(tardis.crew) ? (tardis.crew as Record<string, unknown>[]) : [];
      const crewUuids = crewArray
        .map((member) => member.uuid)
        .filter((uuid): uuid is string => typeof uuid === "string");

      const knownPlayers = crewUuids.length
        ? await fastify.db.query.players.findMany({
            where: inArray(players.uuid, crewUuids),
            columns: { uuid: true, username: true },
          })
        : [];
      const usernameByUuid = new Map(knownPlayers.map((player) => [player.uuid, player.username]));

      const enrichedCrew = crewArray.map((member) => ({
        ...member,
        name: typeof member.uuid === "string" ? (usernameByUuid.get(member.uuid) ?? null) : null,
      }));

      return reply.code(200).send({
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
        crew: enrichedCrew,
        subsystems: Array.isArray(tardis.subsystems)
          ? (tardis.subsystems as { name: string; enabled: boolean; fitted: boolean }[])
          : [],
        updatedAt: tardis.updatedAt.toISOString(),
      });
    },
  );

  fastify.get(
    "/networks/:networkId/ait-log",
    {
      preHandler: fastify.requireNetworkRole("MODERATOR"),
      schema: {
        params: networkIdParamsSchema,
        querystring: networkAitLogQuerySchema,
        response: { 200: networkAitLogListResponseSchema },
      },
    },
    async (request) => {
      const { networkId } = request.params;
      const { tardis, player, action, category, result, after, before, contains, page, limit } = request.query;
      const { userId, networkRole } = request.session!;

      const visibleServerIds =
        networkRole === "MODERATOR"
          ? (
              await fastify.db.query.serverAccessGrants.findMany({
                where: eq(serverAccessGrants.userId, userId),
                with: { server: true },
              })
            )
              .map((grant) => grant.server)
              .filter((server) => server.networkId === networkId)
              .map((server) => server.id)
          : (
              await fastify.db.query.servers.findMany({
                where: eq(servers.networkId, networkId),
              })
            ).map((server) => server.id);

      if (visibleServerIds.length === 0) {
        return [];
      }

      const conditions = [inArray(aitLogs.serverId, visibleServerIds)];
      if (tardis) conditions.push(ilike(aitLogs.tardisId, tardis));
      if (player) conditions.push(ilike(aitLogs.playerName, player));
      if (action) conditions.push(ilike(aitLogs.action, action));
      if (category) conditions.push(ilike(aitLogs.category, category));
      if (result) conditions.push(ilike(aitLogs.result, result));
      if (contains) conditions.push(ilike(aitLogs.detail, `%${contains}%`));
      if (after) conditions.push(gte(aitLogs.occurredAt, new Date(after)));
      if (before) conditions.push(lte(aitLogs.occurredAt, new Date(before)));

      const rows = await fastify.db
        .select()
        .from(aitLogs)
        .where(and(...conditions))
        .orderBy(desc(aitLogs.occurredAt))
        .limit(limit)
        .offset((page - 1) * limit);

      return rows.map((row) => ({
        id: row.id,
        clientLogId: row.clientLogId,
        tardisId: row.tardisId,
        playerUuid: row.playerUuid,
        playerName: row.playerName,
        category: row.category,
        action: row.action,
        result: row.result,
        fromDim: row.fromDim,
        fromX: row.fromX,
        fromY: row.fromY,
        fromZ: row.fromZ,
        toDim: row.toDim,
        toX: row.toX,
        toY: row.toY,
        toZ: row.toZ,
        detail: row.detail,
        occurredAt: row.occurredAt.toISOString(),
      }));
    },
  );

  fastify.get(
    "/networks/:networkId/ledger",
    {
      preHandler: fastify.requireNetworkRole("MODERATOR"),
      schema: {
        params: networkIdParamsSchema,
        querystring: networkLedgerQuerySchema,
        response: { 200: networkLedgerListResponseSchema },
      },
    },
    async (request) => {
      const { networkId } = request.params;
      const { player, action, world, object, source, rolledBack, after, before, page, limit } = request.query;
      const { userId, networkRole } = request.session!;

      const visibleServerIds =
        networkRole === "MODERATOR"
          ? (
              await fastify.db.query.serverAccessGrants.findMany({
                where: eq(serverAccessGrants.userId, userId),
                with: { server: true },
              })
            )
              .map((grant) => grant.server)
              .filter((server) => server.networkId === networkId)
              .map((server) => server.id)
          : (
              await fastify.db.query.servers.findMany({
                where: eq(servers.networkId, networkId),
              })
            ).map((server) => server.id);

      if (visibleServerIds.length === 0) {
        return [];
      }

      const conditions = [inArray(ledgerBlockLogs.serverId, visibleServerIds)];
      if (player) conditions.push(ilike(ledgerBlockLogs.playerName, player));
      if (action) conditions.push(ilike(ledgerBlockLogs.action, action));
      if (world) conditions.push(ilike(ledgerBlockLogs.world, world));
      if (object) conditions.push(ilike(ledgerBlockLogs.object, `%${object}%`));
      if (source) conditions.push(ilike(ledgerBlockLogs.source, source));
      if (rolledBack !== undefined) conditions.push(eq(ledgerBlockLogs.rolledBack, rolledBack));
      if (after) conditions.push(gte(ledgerBlockLogs.occurredAt, new Date(after)));
      if (before) conditions.push(lte(ledgerBlockLogs.occurredAt, new Date(before)));

      const rows = await fastify.db
        .select()
        .from(ledgerBlockLogs)
        .where(and(...conditions))
        .orderBy(desc(ledgerBlockLogs.occurredAt))
        .limit(limit)
        .offset((page - 1) * limit);

      return rows.map((row) => ({
        id: row.id,
        clientLogId: row.clientLogId,
        action: row.action,
        world: row.world,
        x: row.x,
        y: row.y,
        z: row.z,
        object: row.object,
        oldObject: row.oldObject,
        blockState: row.blockState,
        oldBlockState: row.oldBlockState,
        source: row.source,
        playerName: row.playerName,
        playerUuid: row.playerUuid,
        extraData: row.extraData,
        rolledBack: row.rolledBack,
        occurredAt: row.occurredAt.toISOString(),
      }));
    },
  );

  // Copied exactly from the legacy webadmin-main AntiDupeSource.FLAGGING —
  // these two action names mark a TARDIS as creative-placed; any other
  // action (e.g. clearing the flag) means it's no longer flagged.
  const ANTI_DUPE_FLAGGING_ACTIONS = new Set(["PLACED_IN_CREATIVE", "SET_CREATIVE"]);

  fastify.get(
    "/networks/:networkId/antidupe",
    {
      preHandler: fastify.requireNetworkRole("MODERATOR"),
      schema: {
        params: networkIdParamsSchema,
        response: { 200: networkAntiDupeListResponseSchema },
      },
    },
    async (request) => {
      const { networkId } = request.params;
      const { userId, networkRole } = request.session!;

      const visibleServerIds =
        networkRole === "MODERATOR"
          ? (
              await fastify.db.query.serverAccessGrants.findMany({
                where: eq(serverAccessGrants.userId, userId),
                with: { server: true },
              })
            )
              .map((grant) => grant.server)
              .filter((server) => server.networkId === networkId)
              .map((server) => server.id)
          : (
              await fastify.db.query.servers.findMany({
                where: eq(servers.networkId, networkId),
              })
            ).map((server) => server.id);

      if (visibleServerIds.length === 0) {
        return [];
      }

      // The latest event per tardis_uuid decides its current flag state —
      // DISTINCT ON with a matching ORDER BY is Postgres's idiom for this.
      const latestPerTardis = await fastify.db
        .selectDistinctOn([antiDupeEvents.tardisUuid], {
          tardisUuid: antiDupeEvents.tardisUuid,
          action: antiDupeEvents.action,
          actor: antiDupeEvents.actor,
          occurredAt: antiDupeEvents.occurredAt,
        })
        .from(antiDupeEvents)
        .where(inArray(antiDupeEvents.serverId, visibleServerIds))
        .orderBy(antiDupeEvents.tardisUuid, desc(antiDupeEvents.occurredAt));

      return latestPerTardis.map((row) => ({
        tardisUuid: row.tardisUuid,
        creative: ANTI_DUPE_FLAGGING_ACTIONS.has(row.action.toUpperCase()),
        since: row.occurredAt.toISOString(),
        actor: row.actor,
      }));
    },
  );

  fastify.get(
    "/networks/:networkId/grieflogger",
    {
      preHandler: fastify.requireNetworkRole("MODERATOR"),
      schema: {
        params: networkIdParamsSchema,
        querystring: networkGriefLoggerQuerySchema,
        response: { 200: networkGriefLoggerListResponseSchema },
      },
    },
    async (request) => {
      const { networkId } = request.params;
      const { kind, player, contains, after, before, page, limit } = request.query;
      const { userId, networkRole } = request.session!;

      const visibleServerIds =
        networkRole === "MODERATOR"
          ? (
              await fastify.db.query.serverAccessGrants.findMany({
                where: eq(serverAccessGrants.userId, userId),
                with: { server: true },
              })
            )
              .map((grant) => grant.server)
              .filter((server) => server.networkId === networkId)
              .map((server) => server.id)
          : (
              await fastify.db.query.servers.findMany({
                where: eq(servers.networkId, networkId),
              })
            ).map((server) => server.id);

      if (visibleServerIds.length === 0) {
        return [];
      }

      const conditions = [inArray(griefLoggerEvents.serverId, visibleServerIds), eq(griefLoggerEvents.kind, kind)];
      if (player) conditions.push(ilike(griefLoggerEvents.playerName, player));
      if (contains) {
        // Target column depends on kind, mirroring GriefLoggerSource.whereFor
        // exactly: chats searches the message text, everything else searches
        // the block/item/container type identifier.
        const searchColumn = kind === "chats" ? griefLoggerEvents.message : griefLoggerEvents.type;
        conditions.push(ilike(searchColumn, `%${contains}%`));
      }
      if (after) conditions.push(gte(griefLoggerEvents.occurredAt, new Date(after)));
      if (before) conditions.push(lte(griefLoggerEvents.occurredAt, new Date(before)));

      const rows = await fastify.db
        .select()
        .from(griefLoggerEvents)
        .where(and(...conditions))
        .orderBy(desc(griefLoggerEvents.occurredAt))
        .limit(limit)
        .offset((page - 1) * limit);

      return rows.map((row) => ({
        id: row.id,
        kind: row.kind as "blocks" | "items" | "containers" | "chats",
        playerName: row.playerName,
        playerUuid: row.playerUuid,
        world: row.world,
        x: row.x,
        y: row.y,
        z: row.z,
        type: row.type,
        action: row.action,
        amount: row.amount,
        message: row.message,
        occurredAt: row.occurredAt.toISOString(),
      }));
    },
  );

  fastify.get(
    "/networks/:networkId/advancements",
    {
      preHandler: fastify.requireNetworkRole("MODERATOR"),
      schema: {
        params: networkIdParamsSchema,
        querystring: networkAdvancementsQuerySchema,
        response: { 200: networkAdvancementsListResponseSchema },
      },
    },
    async (request) => {
      const { networkId } = request.params;
      const { player, contains, page, limit } = request.query;
      const { userId, networkRole } = request.session!;

      const visibleServerIds =
        networkRole === "MODERATOR"
          ? (
              await fastify.db.query.serverAccessGrants.findMany({
                where: eq(serverAccessGrants.userId, userId),
                with: { server: true },
              })
            )
              .map((grant) => grant.server)
              .filter((server) => server.networkId === networkId)
              .map((server) => server.id)
          : (
              await fastify.db.query.servers.findMany({
                where: eq(servers.networkId, networkId),
              })
            ).map((server) => server.id);

      if (visibleServerIds.length === 0) {
        return [];
      }

      const conditions = [inArray(advancements.serverId, visibleServerIds)];
      if (player) conditions.push(ilike(advancements.playerName, player));
      if (contains) {
        const pattern = `%${contains}%`;
        conditions.push(or(ilike(advancements.advancement, pattern), ilike(advancements.title, pattern))!);
      }

      const rows = await fastify.db
        .select()
        .from(advancements)
        .where(and(...conditions))
        .orderBy(desc(advancements.occurredAt))
        .limit(limit)
        .offset((page - 1) * limit);

      return rows.map((row) => ({
        id: row.id,
        playerUuid: row.playerUuid,
        playerName: row.playerName,
        advancement: row.advancement,
        title: row.title,
        frame: row.frame,
        dimension: row.dimension,
        x: row.x,
        y: row.y,
        z: row.z,
        occurredAt: row.occurredAt.toISOString(),
      }));
    },
  );

  fastify.post(
    "/networks/:networkId/servers/link",
    {
      preHandler: fastify.requireNetworkRole("ADMIN"),
      schema: {
        params: networkIdParamsSchema,
        body: linkServerBodySchema,
        response: { 200: linkServerResponseSchema, 404: apiErrorSchema },
      },
    },
    async (request, reply) => {
      const { networkId } = request.params;
      const linkCode = normalizeLinkCode(request.body.linkCode);
      const userId = request.session!.userId;

      const claimed = await fastify.db.transaction(async (tx) => {
        // Conditioning the UPDATE itself on linkCode + expiry (rather than a
        // separate SELECT then UPDATE) makes this atomic — two concurrent
        // requests racing the same code can't both succeed, since only the
        // first UPDATE still matches the WHERE clause.
        const [server] = await tx
          .update(servers)
          .set({ networkId, linkCode: null, linkCodeExpiresAt: null })
          .where(and(eq(servers.linkCode, linkCode), gt(servers.linkCodeExpiresAt, new Date())))
          .returning();

        if (!server) {
          return null;
        }

        await tx
          .insert(serverAccessGrants)
          .values({ userId, serverUuid: server.serverUuid })
          .onConflictDoNothing();

        return server;
      });

      if (!claimed) {
        return reply.code(404).send({ error: "Not Found", message: "Invalid or expired link code" });
      }

      return reply.code(200).send({
        id: claimed.id,
        serverUuid: claimed.serverUuid,
        name: claimed.name,
        networkId: claimed.networkId!,
      });
    },
  );

  fastify.delete(
    "/networks/:networkId",
    {
      // requireNetworkRole already 403s (or 401s) before this handler runs
      // for any networkId the caller isn't an OWNER of — including a
      // nonexistent one, since a network_members row can't exist without a
      // real network behind it. No separate existence check needed.
      preHandler: fastify.requireNetworkRole("OWNER"),
      schema: {
        params: networkIdParamsSchema,
        response: { 204: noContentResponseSchema },
      },
    },
    async (request, reply) => {
      const { networkId } = request.params;

      // servers.network_id is ON DELETE SET NULL and network_members.network_id
      // is ON DELETE CASCADE (see schema.ts) — deleting the network row alone
      // is enough to orphan its servers back to unclaimed and drop its
      // membership rows, no manual cascade needed here.
      await fastify.db.delete(networks).where(eq(networks.id, networkId));

      return reply.code(204).send();
    },
  );

  fastify.patch(
    "/networks/:networkId/servers/:serverUuid",
    {
      preHandler: fastify.requireNetworkRole("ADMIN"),
      schema: {
        params: networkServerParamsSchema,
        body: renameServerBodySchema,
        response: { 200: networkServerSummarySchema, 404: apiErrorSchema },
      },
    },
    async (request, reply) => {
      const { networkId, serverUuid } = request.params;
      const { name } = request.body;

      const [renamed] = await fastify.db
        .update(servers)
        .set({ name })
        .where(and(eq(servers.serverUuid, serverUuid), eq(servers.networkId, networkId)))
        .returning();

      if (!renamed) {
        return reply.code(404).send({ error: "Not Found", message: "Server not found in this network" });
      }

      return reply.code(200).send({
        id: renamed.id,
        serverUuid: renamed.serverUuid,
        name: renamed.name,
        loaderType: renamed.loaderType,
        mcVersion: renamed.mcVersion,
        isActive: renamed.isActive,
        playerCount: renamed.playerCount,
        maxPlayers: renamed.maxPlayers,
        tps: renamed.tps,
        tps10s: renamed.tps10s,
        mspt10s: renamed.mspt10s,
        cpuProcess10s: renamed.cpuProcess10s,
        cpuSystem10s: renamed.cpuSystem10s,
        hostileMobcapOverworld: renamed.hostileMobcapOverworld,
        memoryUsedMb: renamed.memoryUsedMb,
        memoryTotalMb: renamed.memoryTotalMb,
        diskUsedGb: renamed.diskUsedGb,
        diskTotalGb: renamed.diskTotalGb,
        installedMods: renamed.installedMods,
        lastSeenAt: renamed.lastSeenAt ? renamed.lastSeenAt.toISOString() : null,
        createdAt: renamed.createdAt.toISOString(),
      });
    },
  );
};

export default networksRoute;
