import { z } from "zod";

// Wire format is snake_case: sent by the Minecraft-side mod (Java), same
// convention as the rest of the telemetry endpoints.
const playerEntrySchema = z.object({
  uuid: z.string().uuid(),
  username: z.string().min(1).max(16),
  total_playtime_seconds: z.number().int().min(0),
  registered_at: z.string().datetime(),

  // The mod's/Plan's own session id — see packages/db/src/schema.ts's
  // player_sessions composite unique index for why this is only unique
  // per-server, not globally. server_uuid is deliberately NOT part of this
  // shape: it comes from the authenticated server (requireServerApiKey),
  // never trusted from the body, so one server's api_key can't write
  // session rows claiming to be a different server.
  session_id: z.string().min(1).max(128),
  login_time: z.string().datetime(),
  // Absent/omitted while the session is still active.
  logout_time: z.string().datetime().optional(),

  // Resolved location only, never a raw IP.
  geolocation_country: z.string().length(2).optional(),
  geolocation_city: z.string().min(1).max(128).optional(),
});

// CLAUDE.md API Batching rule: high-volume routes must expect a batch array.
export const telemetryPlayersBodySchema = z.object({
  players: z.array(playerEntrySchema).min(1).max(500),
});

export type TelemetryPlayersBody = z.infer<typeof telemetryPlayersBodySchema>;

export const telemetryPlayersResponseSchema = z.object({
  ok: z.literal(true),
  upserted: z.number().int(),
});
