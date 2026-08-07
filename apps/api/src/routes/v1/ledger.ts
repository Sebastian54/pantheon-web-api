import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { ledgerLogs } from "@pantheon/db";
import { ledgerBatchBodySchema, ledgerBatchResponseSchema } from "../../schemas/ledger.schema";

/** Ingests a batch of moderation/transaction events (Ledger) from a registered Minecraft server. */
const ledgerRoute: FastifyPluginAsyncZod = async (fastify) => {
  fastify.post(
    "/ledger",
    {
      preValidation: fastify.requireServerApiKey,
      schema: {
        body: ledgerBatchBodySchema,
        response: {
          201: ledgerBatchResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const serverId = request.serverContext!.id;

      const rows = request.body.events.map((event) => ({
        serverId,
        actor: event.actor,
        actorUuid: event.actorUuid,
        actionType: event.actionType,
        target: event.target,
        world: event.world,
        x: event.x,
        y: event.y,
        z: event.z,
        metadata: event.metadata,
        occurredAt: event.occurredAt ? new Date(event.occurredAt) : undefined,
      }));

      const inserted = await fastify.db.insert(ledgerLogs).values(rows).returning({
        id: ledgerLogs.id,
      });

      return reply.code(201).send({ inserted: inserted.length });
    },
  );
};

export default ledgerRoute;
