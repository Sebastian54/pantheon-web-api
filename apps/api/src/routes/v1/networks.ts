import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { eq } from "drizzle-orm";
import { networks, networkMembers } from "@pantheon/db";
import {
  createNetworkBodySchema,
  networkResponseSchema,
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
};

export default networksRoute;
