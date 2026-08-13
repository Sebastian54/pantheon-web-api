import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { aitTardises } from "@pantheon/db";
import { aitFleetBodySchema, aitFleetResponseSchema } from "../../schemas/telemetry-ait-fleet.schema";

/**
 * Live TARDIS fleet snapshot from the AIT integration — same api_key auth as
 * the rest of the telemetry endpoints. Unlike the event-log ingestion
 * routes, this is current-state, not append-only: each call upserts every
 * TARDIS in the payload by uuid. Looped per-entry (not one batched
 * multi-row upsert) for the same reason as telemetry-players.ts — Postgres
 * rejects an ON CONFLICT DO UPDATE that would touch the same conflict
 * target twice in one statement, which a duplicate uuid in the array
 * (a mod-side bug, or the same TARDIS somehow reported twice) can't be
 * ruled out for.
 */
const telemetryAitFleetRoute: FastifyPluginAsyncZod = async (fastify) => {
  fastify.post(
    "/telemetry/ait-fleet",
    {
      preHandler: fastify.requireServerApiKey,
      schema: {
        body: aitFleetBodySchema,
        response: { 200: aitFleetResponseSchema },
      },
    },
    async (request, reply) => {
      const { id: serverId } = request.serverContext!;
      const { tardises } = request.body;

      await fastify.db.transaction(async (tx) => {
        for (const tardis of tardises) {
          await tx
            .insert(aitTardises)
            .values({
              uuid: tardis.uuid,
              serverId,
              name: tardis.name,
              owner: tardis.owner,
              ownerUuid: tardis.owner_uuid,
              fuel: tardis.fuel,
              maxFuel: tardis.max_fuel,
              powered: tardis.powered,
              locked: tardis.locked,
              travelState: tardis.travel_state,
              doorState: tardis.door_state,
              dimension: tardis.dimension,
              x: tardis.x,
              y: tardis.y,
              z: tardis.z,
              crew: tardis.crew,
              subsystems: tardis.subsystems,
            })
            .onConflictDoUpdate({
              target: aitTardises.uuid,
              set: {
                serverId,
                name: tardis.name,
                owner: tardis.owner,
                ownerUuid: tardis.owner_uuid,
                fuel: tardis.fuel,
                maxFuel: tardis.max_fuel,
                powered: tardis.powered,
                locked: tardis.locked,
                travelState: tardis.travel_state,
                doorState: tardis.door_state,
                dimension: tardis.dimension,
                x: tardis.x,
                y: tardis.y,
                z: tardis.z,
                crew: tardis.crew,
                subsystems: tardis.subsystems,
                updatedAt: new Date(),
              },
            });
        }
      });

      return reply.code(200).send({ ok: true, upserted: tardises.length });
    },
  );
};

export default telemetryAitFleetRoute;
