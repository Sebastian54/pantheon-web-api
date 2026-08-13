import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { ledgerBlockLogs } from "@pantheon/db";
import { ledgerBlockLogBodySchema, ledgerBlockLogResponseSchema } from "../../schemas/telemetry-ledger.schema";

/**
 * Ingests a batch of Ledger block/grief change events from a registered
 * Minecraft server — same api_key auth as the rest of the telemetry
 * endpoints. Highest-volume of the five telemetry sources by far.
 */
const telemetryLedgerRoute: FastifyPluginAsyncZod = async (fastify) => {
  fastify.post(
    "/telemetry/ledger",
    {
      preHandler: fastify.requireServerApiKey,
      schema: {
        body: ledgerBlockLogBodySchema,
        response: { 201: ledgerBlockLogResponseSchema },
      },
    },
    async (request, reply) => {
      const serverId = request.serverContext!.id;

      const rows = request.body.events.map((event) => ({
        serverId,
        clientLogId: event.id,
        action: event.action,
        world: event.world,
        x: event.x,
        y: event.y,
        z: event.z,
        object: event.object,
        oldObject: event.old_object,
        blockState: event.block_state,
        oldBlockState: event.old_block_state,
        source: event.source,
        playerName: event.player_name,
        playerUuid: event.player_uuid,
        extraData: event.extra_data,
        rolledBack: event.rolled_back,
        occurredAt: new Date(event.timestamp),
      }));

      const inserted = await fastify.db.insert(ledgerBlockLogs).values(rows).returning({ id: ledgerBlockLogs.id });

      return reply.code(201).send({ inserted: inserted.length });
    },
  );
};

export default telemetryLedgerRoute;
