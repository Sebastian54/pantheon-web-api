import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { aitLogs } from "@pantheon/db";
import { aitLogBodySchema, aitLogResponseSchema } from "../../schemas/telemetry-ait-log.schema";

/** Ingests a batch of AIT TARDIS console log events from a registered Minecraft server. */
const telemetryAitLogRoute: FastifyPluginAsyncZod = async (fastify) => {
  fastify.post(
    "/telemetry/ait-log",
    {
      preHandler: fastify.requireServerApiKey,
      schema: {
        body: aitLogBodySchema,
        response: { 201: aitLogResponseSchema },
      },
    },
    async (request, reply) => {
      const serverId = request.serverContext!.id;

      const rows = request.body.events.map((event) => ({
        serverId,
        clientLogId: event.id,
        tardisId: event.tardis_id,
        playerUuid: event.player_uuid,
        playerName: event.player_name,
        category: event.category,
        action: event.action,
        result: event.result,
        fromDim: event.from_dim,
        fromX: event.from_x,
        fromY: event.from_y,
        fromZ: event.from_z,
        toDim: event.to_dim,
        toX: event.to_x,
        toY: event.to_y,
        toZ: event.to_z,
        detail: event.detail,
        occurredAt: new Date(event.ts),
      }));

      const inserted = await fastify.db.insert(aitLogs).values(rows).returning({ id: aitLogs.id });

      return reply.code(201).send({ inserted: inserted.length });
    },
  );
};

export default telemetryAitLogRoute;
