import { z } from "zod";

// Wire format is snake_case: sent by the mc-mod (Java), same convention as
// the rest of the telemetry endpoints. Field list and nullability verified
// directly against the legacy webadmin-main LedgerSource.Row/buildWhere —
// not guessed. timestamp is epoch millis (confirmed by the mc-mod session,
// matching how Ledger's own `time` column is read there), not an ISO string
// like the rest of this API's timestamp fields.
const ledgerEventSchema = z.object({
  // Ledger's own row id — not globally unique across servers (see
  // packages/db/src/schema.ts's ledger_block_logs comment), kept only for
  // reference.
  id: z.number().int(),
  timestamp: z.number().int(),
  action: z.string().min(1).max(64),
  world: z.string().min(1).max(64),
  x: z.number().int(),
  y: z.number().int(),
  z: z.number().int(),
  object: z.string().min(1).max(128),
  old_object: z.string().min(1).max(128).optional(),
  block_state: z.string().optional(),
  old_block_state: z.string().optional(),
  // What caused it — "player", "fire", "explosion", etc, not who.
  source: z.string().min(1).max(64),
  player_name: z.string().min(1).max(64).optional(),
  player_uuid: z.string().uuid().optional(),
  extra_data: z.string().optional(),
  rolled_back: z.boolean(),
});

// CLAUDE.md API Batching rule: high-volume routes must expect a batch array.
// This is the highest-volume of the five telemetry sources by far.
export const ledgerBlockLogBodySchema = z.object({
  events: z.array(ledgerEventSchema).min(1).max(500),
});

export type LedgerBlockLogBody = z.infer<typeof ledgerBlockLogBodySchema>;

export const ledgerBlockLogResponseSchema = z.object({
  inserted: z.number().int(),
});
