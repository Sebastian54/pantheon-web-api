import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { eq } from "drizzle-orm";
import { servers, serverMetrics } from "@pantheon/db";
import {
  telemetryMetricsBodySchema,
  telemetryMetricsResponseSchema,
} from "../../schemas/telemetry-metrics.schema";

/**
 * Metrics-only ping from the telemetry mod (no log batch) — same api_key
 * auth as the rest of Command Spy/Ledger/Heartbeat/telemetry/ingest
 * (Authorization: Bearer <api_key>, looked up by hash via requireServerApiKey).
 * Writes both the servers "latest snapshot" columns (for fast reads, e.g. the
 * dashboard's live server list) and a server_metrics history row (for
 * over-time charts) in one transaction — same both-writes design as
 * telemetry.ts's combined /telemetry/ingest route.
 */
const telemetryMetricsRoute: FastifyPluginAsyncZod = async (fastify) => {
  fastify.post(
    "/telemetry/metrics",
    {
      preHandler: fastify.requireServerApiKey,
      schema: {
        body: telemetryMetricsBodySchema,
        response: { 200: telemetryMetricsResponseSchema },
      },
    },
    async (request, reply) => {
      const { id: serverId } = request.serverContext!;
      const metrics = request.body;

      // Only touch a snapshot column when the field was actually present in
      // this payload — a field missing entirely (Spark/Carpet not loaded)
      // should leave the last-known value on servers alone, not null it out.
      // An explicit `null` (loaded, but this particular reading unavailable
      // this tick) does still overwrite, since that's a real observation.
      const snapshotUpdates: Partial<typeof servers.$inferInsert> = { lastSeenAt: new Date() };
      if (metrics.tps_10s !== undefined) snapshotUpdates.tps10s = metrics.tps_10s;
      if (metrics.mspt_10s !== undefined) snapshotUpdates.mspt10s = metrics.mspt_10s;
      if (metrics.cpu_process_10s !== undefined) snapshotUpdates.cpuProcess10s = metrics.cpu_process_10s;
      if (metrics.cpu_system_10s !== undefined) snapshotUpdates.cpuSystem10s = metrics.cpu_system_10s;
      if (metrics.hostile_mobcap_overworld !== undefined) {
        snapshotUpdates.hostileMobcapOverworld = metrics.hostile_mobcap_overworld;
      }
      if (metrics.memory_used_mb !== undefined) snapshotUpdates.memoryUsedMb = metrics.memory_used_mb;
      if (metrics.memory_total_mb !== undefined) snapshotUpdates.memoryTotalMb = metrics.memory_total_mb;
      if (metrics.disk_used_gb !== undefined) snapshotUpdates.diskUsedGb = metrics.disk_used_gb;
      if (metrics.disk_total_gb !== undefined) snapshotUpdates.diskTotalGb = metrics.disk_total_gb;

      await fastify.db.transaction(async (tx) => {
        await tx.update(servers).set(snapshotUpdates).where(eq(servers.id, serverId));

        // Unlike the snapshot, the history row always records this ping as-is
        // (missing/null both become NULL) — there's no "leave unchanged" for
        // a freshly inserted row.
        await tx.insert(serverMetrics).values({
          serverId,
          tps10s: metrics.tps_10s ?? null,
          mspt10s: metrics.mspt_10s ?? null,
          cpuProcess10s: metrics.cpu_process_10s ?? null,
          cpuSystem10s: metrics.cpu_system_10s ?? null,
          hostileMobcapOverworld: metrics.hostile_mobcap_overworld ?? null,
          memoryUsedMb: metrics.memory_used_mb ?? null,
          memoryTotalMb: metrics.memory_total_mb ?? null,
          diskUsedGb: metrics.disk_used_gb ?? null,
          diskTotalGb: metrics.disk_total_gb ?? null,
        });
      });

      return reply.code(200).send({ ok: true });
    },
  );
};

export default telemetryMetricsRoute;
