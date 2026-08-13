import { z } from "zod";

// Wire format is snake_case: sent by the mc-mod (Java), same convention as
// the rest of the telemetry endpoints. Fields verified against the legacy
// webadmin-main AntiDupeSource.Event: timestamp/action/tardis id/actor,
// same epoch-millis convention as ait-log and ledger.
const antiDupeEventSchema = z.object({
  timestamp: z.number().int(),
  action: z.string().min(1).max(32),
  tardis_uuid: z.string().uuid(),
  actor: z.string().min(1).max(64),
});

// CLAUDE.md API Batching rule: high-volume routes must expect a batch array
// — low volume in practice for this source specifically ("a handful of
// lines a week" per AntiDupeSource's own comment), but still a batch shape
// for consistency with the rest of the telemetry endpoints.
export const antiDupeBodySchema = z.object({
  events: z.array(antiDupeEventSchema).min(1).max(500),
});

export type AntiDupeBody = z.infer<typeof antiDupeBodySchema>;

export const antiDupeResponseSchema = z.object({
  inserted: z.number().int(),
});
