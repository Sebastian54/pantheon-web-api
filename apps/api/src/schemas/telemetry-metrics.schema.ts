import { z } from "zod";
import { telemetryMetricsSchema } from "./telemetry.schema";

// Same wire format as the `metrics` object in telemetry.schema.ts's combined
// /telemetry/ingest route — this endpoint just skips the logs batch.
export const telemetryMetricsBodySchema = telemetryMetricsSchema;

export type TelemetryMetricsBody = z.infer<typeof telemetryMetricsBodySchema>;

export const telemetryMetricsResponseSchema = z.object({
  ok: z.literal(true),
});
