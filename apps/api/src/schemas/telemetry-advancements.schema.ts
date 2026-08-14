import { z } from "zod";

// Wire format is snake_case: sent by the mc-mod (Java), same convention as
// the rest of the telemetry endpoints. ts is epoch millis, matching the
// Ledger/ait-log convention (not an ISO string like the rest of this API).
const advancementEventSchema = z.object({
  player_uuid: z.string().uuid(),
  player_name: z.string().min(1).max(64),
  advancement: z.string().min(1).max(255),
  title: z.string().min(1).max(255).optional(),
  frame: z.string().min(1).max(16).optional(),
  dimension: z.string().min(1).max(128).optional(),
  x: z.number().int().optional(),
  y: z.number().int().optional(),
  z: z.number().int().optional(),
  ts: z.number().int(),
});

// CLAUDE.md API Batching rule: high-volume routes must expect a batch array
// — low volume in practice for this source, but batched for consistency.
export const advancementsBodySchema = z.object({
  events: z.array(advancementEventSchema).min(1).max(500),
});

export type AdvancementsBody = z.infer<typeof advancementsBodySchema>;

export const advancementsResponseSchema = z.object({
  inserted: z.number().int(),
});
