import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { eq } from "drizzle-orm";
import { servers } from "@pantheon/db";
import { heartbeatBodySchema, heartbeatResponseSchema } from "../../schemas/heartbeat.schema";

/**
 * Live stats ping from the Minecraft server plugin — same api_key auth as
 * Command Spy/Ledger (Authorization: Bearer <api_key>, looked up by hash via
 * requireServerApiKey), not a user JWT. Expected to be called frequently
 * (e.g. every few seconds), so the response body stays minimal.
 */
const heartbeatRoute: FastifyPluginAsyncZod = async (fastify) => {
  fastify.post(
    "/heartbeat",
    {
      preHandler: fastify.requireServerApiKey,
      schema: {
        body: heartbeatBodySchema,
        response: { 200: heartbeatResponseSchema },
      },
    },
    async (request, reply) => {
      const { player_count, max_players, tps, capabilities } = request.body;
      const { id } = request.serverContext!;

      await fastify.db
        .update(servers)
        .set({
          playerCount: player_count,
          maxPlayers: max_players,
          tps,
          lastSeenAt: new Date(),
          ...(capabilities !== undefined ? { installedMods: capabilities } : {}),
        })
        .where(eq(servers.id, id));

      return reply.code(200).send({ ok: true });
    },
  );
};

export default heartbeatRoute;
