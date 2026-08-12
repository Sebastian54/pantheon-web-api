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

      await fastify.db.transaction(async (tx) => {
        await tx
          .update(servers)
          .set({
            tps: metrics.tps,
            mspt: metrics.mspt,
            cpuUsage: metrics.cpu_usage,
            targetTickrate: metrics.target_tickrate,
            hostileMobcap: metrics.hostile_mobcap,
            lastSeenAt: new Date(),
          })
          .where(eq(servers.id, serverId));

        await tx.insert(serverMetrics).values({
          serverId,
          tps: metrics.tps,
          mspt: metrics.mspt,
          cpuUsage: metrics.cpu_usage,
          targetTickrate: metrics.target_tickrate,
          hostileMobcap: metrics.hostile_mobcap,
        });
      });

      return reply.code(200).send({ ok: true });
    },
  );
};

export default telemetryMetricsRoute;
