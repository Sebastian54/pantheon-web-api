import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { and, eq, gt } from "drizzle-orm";
import { networks, networkMembers, servers, serverAccessGrants } from "@pantheon/db";
import {
  createNetworkBodySchema,
  linkServerBodySchema,
  linkServerErrorSchema,
  linkServerResponseSchema,
  networkIdParamsSchema,
  networkResponseSchema,
  networkServersListResponseSchema,
  networksListResponseSchema,
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
        lastSeenAt: server.lastSeenAt ? server.lastSeenAt.toISOString() : null,
        createdAt: server.createdAt.toISOString(),
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
        response: { 200: linkServerResponseSchema, 404: linkServerErrorSchema },
      },
    },
    async (request, reply) => {
      const { networkId } = request.params;
      const { linkCode } = request.body;
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
};

export default networksRoute;
