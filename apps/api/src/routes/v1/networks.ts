import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { and, desc, eq, gt, inArray, sql } from "drizzle-orm";
import { networks, networkMembers, servers, serverAccessGrants, playerSessions, players } from "@pantheon/db";
import { normalizeLinkCode } from "../../lib/crypto";
import {
  apiErrorSchema,
  createNetworkBodySchema,
  linkServerBodySchema,
  linkServerResponseSchema,
  networkIdParamsSchema,
  networkPlayerSessionsListResponseSchema,
  networkPlaytimeLeaderboardResponseSchema,
  networkResponseSchema,
  networkServerParamsSchema,
  networkServerSummarySchema,
  networkServersListResponseSchema,
  networksListResponseSchema,
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
