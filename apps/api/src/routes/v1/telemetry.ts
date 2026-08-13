import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { eq } from "drizzle-orm";
import { servers, blockLogs } from "@pantheon/db";
import {
  telemetryIngestBodySchema,
  telemetryIngestResponseSchema,
} from "../../schemas/telemetry.schema";

/**
 * Combined metrics + batched block-log ingest from the telemetry mod, called
 * every ~10s — same api_key auth as Command Spy/Ledger/Heartbeat
 * (Authorization: Bearer <api_key>, looked up by hash via requireServerApiKey).
 * Both the metrics update and the log batch happen inside one transaction, so
 * the 200 the mod relies on to advance its local SQLite cursor is only sent
 * after everything is actually committed. A thrown error here (e.g. the
 * Oracle DB being unreachable) rolls the transaction back and falls through
 * to Fastify's default error handler, which returns 500 — exactly what tells
 * the mod to retry the same batch instead of advancing its cursor.
 */
const telemetryRoute: FastifyPluginAsyncZod = async (fastify) => {
  fastify.post(
    "/telemetry/ingest",
    {
      preHandler: fastify.requireServerApiKey,
      schema: {
        body: telemetryIngestBodySchema,
        response: { 200: telemetryIngestResponseSchema },
      },
    },
    async (request, reply) => {
      const { id: serverId } = request.serverContext!;
      const { metrics, logs } = request.body;

      const snapshotUpdates: Partial<typeof servers.$inferInsert> = { lastSeenAt: new Date() };
      if (metrics.tps_10s !== undefined) snapshotUpdates.tps10s = metrics.tps_10s;
      if (metrics.mspt_10s !== undefined) snapshotUpdates.mspt10s = metrics.mspt_10s;
      if (metrics.cpu_process_10s !== undefined) snapshotUpdates.cpuProcess10s = metrics.cpu_process_10s;
      if (metrics.cpu_system_10s !== undefined) snapshotUpdates.cpuSystem10s = metrics.cpu_system_10s;
      if (metrics.hostile_mobcap_overworld !== undefined) {
        snapshotUpdates.hostileMobcapOverworld = metrics.hostile_mobcap_overworld;
      }

      const inserted = await fastify.db.transaction(async (tx) => {
        await tx.update(servers).set(snapshotUpdates).where(eq(servers.id, serverId));

        if (logs.length === 0) {
          return 0;
        }

        const rows = logs.map((log) => ({
          serverId,
          clientLogId: log.id,
          source: log.source,
          action: log.action,
          x: log.x,
          y: log.y,
          z: log.z,
          metadata: log.metadata,
          occurredAt: new Date(log.time),
        }));

        const result = await tx.insert(blockLogs).values(rows).returning({ id: blockLogs.id });
        return result.length;
      });

      return reply.code(200).send({ ok: true, inserted });
    },
  );
};

export default telemetryRoute;
