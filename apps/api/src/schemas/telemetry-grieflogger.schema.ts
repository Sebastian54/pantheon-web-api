import { z } from "zod";

// Wire format is snake_case: sent by the mc-mod (Java), same convention as
// the rest of the telemetry endpoints. Field list and per-kind nullability
// verified directly against the legacy webadmin-main GriefLoggerSource
// (KINDS, Entry, selectFor) — kind discriminates between four record shapes
// that table originally lived in as four separate tables: type/action are
// null for chats, amount only applies to items/containers, message only to
// chats. time is epoch millis, same convention as ait-log/ledger/antidupe.
const griefLoggerKindSchema = z.enum(["blocks", "items", "containers", "chats"]);

const griefLoggerEventSchema = z.object({
  kind: griefLoggerKindSchema,
  time: z.number().int(),
  player: z.string().min(1).max(64).optional(),
  player_uuid: z.string().uuid().optional(),
  world: z.string().min(1).max(64),
  x: z.number().int(),
  y: z.number().int(),
  z: z.number().int(),
  type: z.string().min(1).max(128).optional(),
  action: z.string().min(1).max(32).optional(),
  amount: z.number().int().optional(),
  message: z.string().optional(),
});

// CLAUDE.md API Batching rule: high-volume routes must expect a batch array.
export const griefLoggerBodySchema = z.object({
  events: z.array(griefLoggerEventSchema).min(1).max(500),
});

export type GriefLoggerBody = z.infer<typeof griefLoggerBodySchema>;

export const griefLoggerResponseSchema = z.object({
  inserted: z.number().int(),
});
