import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { players, playerSessions } from "@pantheon/db";
import {
  telemetryPlayersBodySchema,
  telemetryPlayersResponseSchema,
} from "../../schemas/telemetry-players.schema";

/**
 * Bulk upsert of Plan-style player analytics (identity + per-session
 * geolocation) from a registered Minecraft server — same api_key auth as the
 * rest of the telemetry endpoints. Each entry upserts both a `players` row
 * (global identity/playtime, keyed by the Minecraft account uuid) and a
 * `player_sessions` row (this specific session, keyed per-server since the
 * mod's/Plan's own session id is only unique within one server) — a session
 * is first written on login (logoutTime null) and updated in place once the
 * player disconnects, rather than inserted twice.
 *
 * Looped per-entry rather than one batched multi-row upsert: Postgres
 * rejects an ON CONFLICT DO UPDATE that would touch the same conflict target
 * twice within a single statement, which a naive batched upsert can't rule
 * out if a duplicate uuid/session_id ever lands in the same array. Batch
 * sizes here are bounded by actual concurrent+recent player counts (tens,
 * not the hundreds/thousands Command Spy or Ledger can see), so the
 * per-entry round trips aren't the efficiency concern batching large event
 * logs is.
 */
const telemetryPlayersRoute: FastifyPluginAsyncZod = async (fastify) => {
  fastify.post(
    "/telemetry/players",
    {
      preHandler: fastify.requireServerApiKey,
      schema: {
        body: telemetryPlayersBodySchema,
        response: { 200: telemetryPlayersResponseSchema },
      },
    },
    async (request, reply) => {
      const { serverUuid } = request.serverContext!;
      const { players: entries } = request.body;

      const upserted = await fastify.db.transaction(async (tx) => {
        for (const entry of entries) {
          await tx
            .insert(players)
            .values({
              uuid: entry.uuid,
              username: entry.username,
              totalPlaytimeSeconds: entry.total_playtime_seconds,
              registeredAt: new Date(entry.registered_at),
            })
            .onConflictDoUpdate({
              target: players.uuid,
              // registeredAt intentionally excluded — it's a one-time
              // first-seen value, not something a later call should revise.
              set: {
                username: entry.username,
                totalPlaytimeSeconds: entry.total_playtime_seconds,
              },
            });

          // updatedAt is always included so the SET clause is never empty —
          // if neither logout_time nor geolocation is sent this call (e.g.
          // just reconfirming an active session), an empty `set: {}` would
          // produce an invalid "SET" with no columns.
          const sessionUpdates: Partial<typeof playerSessions.$inferInsert> = { updatedAt: new Date() };
          if (entry.logout_time !== undefined) sessionUpdates.logoutTime = new Date(entry.logout_time);
          if (entry.geolocation_country !== undefined) sessionUpdates.geolocationCountry = entry.geolocation_country;
          if (entry.geolocation_city !== undefined) sessionUpdates.geolocationCity = entry.geolocation_city;

          await tx
            .insert(playerSessions)
            .values({
              sessionId: entry.session_id,
              playerUuid: entry.uuid,
              serverUuid,
              loginTime: new Date(entry.login_time),
              logoutTime: entry.logout_time ? new Date(entry.logout_time) : undefined,
              geolocationCountry: entry.geolocation_country,
              geolocationCity: entry.geolocation_city,
            })
            .onConflictDoUpdate({
              target: [playerSessions.serverUuid, playerSessions.sessionId],
              // loginTime intentionally excluded — same reasoning as
              // registeredAt above.
              set: sessionUpdates,
            });
        }
        return entries.length;
      });

      return reply.code(200).send({ ok: true, upserted });
    },
  );
};

export default telemetryPlayersRoute;
