import { z } from "zod";

// Wire format is snake_case: sent directly by the telemetry mod (Java), not
// the JS dashboard — same convention as register.schema.ts / heartbeat.schema.ts.
const telemetryMetricsSchema = z.object({
  tps: z.number().min(0),
  mspt: z.number().min(0),
  cpu_usage: z.number().min(0).max(100),
  target_tickrate: z.number().int().min(1),
  hostile_mobcap: z.number().int().min(0),
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
