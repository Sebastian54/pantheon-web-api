import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { griefLoggerEvents } from "@pantheon/db";
import { griefLoggerBodySchema, griefLoggerResponseSchema } from "../../schemas/telemetry-grieflogger.schema";

/** Ingests a batch of legacy GriefLogger events (blocks/items/containers/chats) from a registered Minecraft server. */
const telemetryGriefLoggerRoute: FastifyPluginAsyncZod = async (fastify) => {
  fastify.post(
    "/telemetry/grieflogger",
    {
      preHandler: fastify.requireServerApiKey,
      schema: {
        body: griefLoggerBodySchema,
        response: { 201: griefLoggerResponseSchema },
      },
    },
    async (request, reply) => {
      const serverId = request.serverContext!.id;

      const rows = request.body.events.map((event) => ({
        serverId,
        kind: event.kind,
        playerName: event.player,
        playerUuid: event.player_uuid,
        world: event.world,
        x: event.x,
        y: event.y,
        z: event.z,
        type: event.type,
        action: event.action,
        amount: event.amount,
        message: event.message,
        occurredAt: new Date(event.time),
      }));

      const inserted = await fastify.db.insert(griefLoggerEvents).values(rows).returning({ id: griefLoggerEvents.id });

      return reply.code(201).send({ inserted: inserted.length });
    },
  );
};

export default telemetryGriefLoggerRoute;
