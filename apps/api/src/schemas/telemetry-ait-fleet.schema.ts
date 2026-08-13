import { z } from "zod";

// Crew shape is deliberately lenient: the peer's spec said {uuid, level},
// but the legacy webadmin-main source (TardisDataSource.Crew) actually has
// {uuid, name, level, type} — passthrough() preserves whichever shape the
// real mod ends up sending rather than silently dropping fields Zod's
// default .strip() behavior would otherwise discard, since this is stored
// as-is in jsonb.
const aitCrewMemberSchema = z
  .object({
    uuid: z.string().uuid(),
    level: z.number().int(),
  })
  .passthrough();

const aitSubsystemSchema = z.object({
  name: z.string().min(1),
  enabled: z.boolean(),
  fitted: z.boolean(),
});

// Wire format is snake_case: sent by the mc-mod (Java), same convention as
// the rest of the telemetry endpoints.
const aitTardisEntrySchema = z.object({
  uuid: z.string().uuid(),
  name: z.string().min(1).max(128),
  owner: z.string().min(1).max(64),
  // Legacy webadmin-main never had this (no creator uuid in AIT's save
  // files) — optional since the new ingestion path may have better data.
  owner_uuid: z.string().uuid().optional(),
  fuel: z.number(),
  max_fuel: z.number(),
  powered: z.boolean(),
  locked: z.boolean(),
  travel_state: z.string().min(1).max(32),
  door_state: z.string().min(1).max(32),
  dimension: z.string().min(1).max(128),
  // Block coordinates, confirmed Integer in AIT's own data — not fractional.
  x: z.number().int(),
  y: z.number().int(),
  z: z.number().int(),
  crew: z.array(aitCrewMemberSchema),
  subsystems: z.array(aitSubsystemSchema),
});

// This is a full current-state snapshot, not a batch of discrete events —
// empty is a valid state (a server with no TARDISes built yet), so no
// .min(1) like the event-log ingestion endpoints have. Capped generously
// given a busy AIT server can have hundreds of TARDISes.
export const aitFleetBodySchema = z.object({
  tardises: z.array(aitTardisEntrySchema).max(2000),
});

export type AitFleetBody = z.infer<typeof aitFleetBodySchema>;

export const aitFleetResponseSchema = z.object({
  ok: z.literal(true),
  upserted: z.number().int(),
});
