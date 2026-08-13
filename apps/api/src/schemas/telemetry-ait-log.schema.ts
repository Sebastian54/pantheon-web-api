import { z } from "zod";

// Wire format is snake_case: sent by the mc-mod (Java), same convention as
// the rest of the telemetry endpoints. Field list and nullability verified
// directly against the legacy webadmin-main AitLogSource.java, not guessed:
// ts is epoch millis (that source stores/queries it as a raw long, unlike
// every other timestamp field in this API which is an ISO string), and
// from_*/to_* are only populated for travel-related actions.
const aitLogEntrySchema = z.object({
  // aitlog's own row id — not globally unique across servers (see
  // packages/db/src/schema.ts's ait_logs comment), kept only for reference.
  id: z.number().int(),
  ts: z.number().int(),
  tardis_id: z.string().min(1).max(64),
  player_uuid: z.string().uuid().optional(),
  player_name: z.string().min(1).max(64),
  category: z.string().min(1).max(64),
  action: z.string().min(1).max(64),
  result: z.string().min(1).max(64).optional(),
  from_dim: z.string().min(1).max(128).optional(),
  from_x: z.number().int().optional(),
  from_y: z.number().int().optional(),
  from_z: z.number().int().optional(),
  to_dim: z.string().min(1).max(128).optional(),
  to_x: z.number().int().optional(),
  to_y: z.number().int().optional(),
  to_z: z.number().int().optional(),
  detail: z.string().optional(),
});

// CLAUDE.md API Batching rule: high-volume routes must expect a batch array.
export const aitLogBodySchema = z.object({
  events: z.array(aitLogEntrySchema).min(1).max(500),
});

export type AitLogBody = z.infer<typeof aitLogBodySchema>;

export const aitLogResponseSchema = z.object({
  inserted: z.number().int(),
});
