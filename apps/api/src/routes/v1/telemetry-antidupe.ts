import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { antiDupeEvents } from "@pantheon/db";
import { antiDupeBodySchema, antiDupeResponseSchema } from "../../schemas/telemetry-antidupe.schema";

/** Ingests a batch of ait-antidupe creative-TARDIS flag events from a registered Minecraft server. */
const telemetryAntiDupeRoute: FastifyPluginAsyncZod = async (fastify) => {
  fastify.post(
    "/telemetry/antidupe",
    {
      preHandler: fastify.requireServerApiKey,
      schema: {
        body: antiDupeBodySchema,
        response: { 201: antiDupeResponseSchema },
      },
    },
    async (request, reply) => {
      const serverId = request.serverContext!.id;

      const rows = request.body.events.map((event) => ({
        serverId,
        tardisUuid: event.tardis_uuid,
        action: event.action,
        actor: event.actor,
        occurredAt: new Date(event.timestamp),
      }));

      const inserted = await fastify.db.insert(antiDupeEvents).values(rows).returning({ id: antiDupeEvents.id });

      return reply.code(201).send({ inserted: inserted.length });
    },
  );
};

export default telemetryAntiDupeRoute;
