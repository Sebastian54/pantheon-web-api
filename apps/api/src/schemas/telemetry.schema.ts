import { z } from "zod";

// Wire format is snake_case: sent directly by the telemetry mod (Java), not
// the JS dashboard — same convention as register.schema.ts / heartbeat.schema.ts.
// Exported for reuse by telemetry-metrics.schema.ts (POST /telemetry/metrics
// sends exactly this shape on its own, without a logs batch).
//
// Every field is nullish (optional AND nullable) because the mod only reports
// what it can actually detect: tps_10s/mspt_10s/cpu_process_10s/cpu_system_10s
// come from Spark and are entirely absent from the payload if Spark isn't
// loaded; hostile_mobcap_overworld likewise depends on Carpet. A field can
// also be present-but-null if the mod's loaded but a specific reading isn't
// available that tick. There is no target_tickrate — nothing in the mod
// currently sources it.
export const telemetryMetricsSchema = z.object({
  tps_10s: z.number().min(0).nullish(),
  mspt_10s: z.number().min(0).nullish(),
  cpu_process_10s: z.number().min(0).max(100).nullish(),
  cpu_system_10s: z.number().min(0).max(100).nullish(),
  hostile_mobcap_overworld: z.number().int().min(0).nullish(),
});

const telemetryLogEntrySchema = z.object({
  // The row's own id in the mod's local SQLite db — not used as our primary
  // key, kept only for cross-referencing a batch when debugging.
  id: z.number().int(),
  time: z.string().datetime(),
  source: z.string().min(1).max(64),
  action: z.string().min(1).max(64),
  x: z.number().int().optional(),
  y: z.number().int().optional(),
  z: z.number().int().optional(),
  metadata: z.record(z.unknown()).optional(),
});

// CLAUDE.md API Batching rule: high-volume routes must expect a batch array.
// logs may legitimately be empty — the mod posts every 10s regardless of
// whether new SQLite rows have accumulated since the last tick.
export const telemetryIngestBodySchema = z.object({
  metrics: telemetryMetricsSchema,
  logs: z.array(telemetryLogEntrySchema).max(500),
});

export type TelemetryIngestBody = z.infer<typeof telemetryIngestBodySchema>;

export const telemetryIngestResponseSchema = z.object({
  ok: z.literal(true),
  inserted: z.number().int(),
});
