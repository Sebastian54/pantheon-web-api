import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { commandSpyLogs } from "@pantheon/db";
import {
  commandSpyBatchBodySchema,
  commandSpyBatchResponseSchema,
} from "../../schemas/command-spy.schema";

/** Ingests a batch of executed-command events from a registered Minecraft server. */
const commandSpyRoute: FastifyPluginAsyncZod = async (fastify) => {
  fastify.post(
    "/command-spy",
    {
      preValidation: fastify.requireServerApiKey,
      schema: {
        body: commandSpyBatchBodySchema,
        response: {
          201: commandSpyBatchResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const serverId = request.serverContext!.id;

      const rows = request.body.events.map((event) => ({
        serverId,
        executor: event.executor,
        executorUuid: event.executorUuid,
        command: event.command,
        occurredAt: event.occurredAt ? new Date(event.occurredAt) : undefined,
      }));

      const inserted = await fastify.db.insert(commandSpyLogs).values(rows).returning({
        id: commandSpyLogs.id,
      });

      return reply.code(201).send({ inserted: inserted.length });
    },
  );
};

export default commandSpyRoute;
