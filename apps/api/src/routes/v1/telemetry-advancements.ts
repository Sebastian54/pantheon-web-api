import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { advancements } from "@pantheon/db";
import { advancementsBodySchema, advancementsResponseSchema } from "../../schemas/telemetry-advancements.schema";

/**
 * Ingests a batch of advancement grants from a registered Minecraft server —
 * same api_key auth as the rest of the telemetry endpoints. Upsert keyed on
 * (server_id, player_uuid, advancement) with ON CONFLICT DO NOTHING — a
 * grant is permanent once earned, so a resent batch (e.g. the mod retrying
 * after a network blip) is a safe no-op rather than a duplicate row. Unlike
 * telemetry-players.ts's per-entry loop, a single batched multi-row insert
 * is safe here even with a duplicate key inside the same batch: Postgres
 * only rejects a repeated conflict target for DO UPDATE, not DO NOTHING.
 */
const telemetryAdvancementsRoute: FastifyPluginAsyncZod = async (fastify) => {
  fastify.post(
    "/telemetry/advancements",
    {
      preHandler: fastify.requireServerApiKey,
      schema: {
        body: advancementsBodySchema,
        response: { 201: advancementsResponseSchema },
      },
    },
    async (request, reply) => {
      const serverId = request.serverContext!.id;

      const rows = request.body.events.map((event) => ({
        serverId,
        playerUuid: event.player_uuid,
        playerName: event.player_name,
        advancement: event.advancement,
        title: event.title,
        frame: event.frame,
        dimension: event.dimension,
        x: event.x,
        y: event.y,
        z: event.z,
        occurredAt: new Date(event.ts),
      }));

      const inserted = await fastify.db
        .insert(advancements)
        .values(rows)
        .onConflictDoNothing({
          target: [advancements.serverId, advancements.playerUuid, advancements.advancement],
        })
        .returning({ id: advancements.id });

      return reply.code(201).send({ inserted: inserted.length });
    },
  );
};

export default telemetryAdvancementsRoute;
