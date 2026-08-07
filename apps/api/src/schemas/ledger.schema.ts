import { z } from "zod";

const ledgerEntrySchema = z.object({
  actor: z.string().min(1).max(64),
  actorUuid: z.string().uuid().optional(),
  actionType: z.string().min(1).max(64),
  target: z.string().max(255).optional(),
  world: z.string().max(64).optional(),
  x: z.number().int().optional(),
  y: z.number().int().optional(),
  z: z.number().int().optional(),
  metadata: z.record(z.unknown()).optional(),
  occurredAt: z.string().datetime().optional(),
});

// CLAUDE.md API Batching rule: high-volume routes must expect a batch array.
export const ledgerBatchBodySchema = z.object({
  events: z.array(ledgerEntrySchema).min(1).max(500),
});

export type LedgerBatchBody = z.infer<typeof ledgerBatchBodySchema>;

export const ledgerBatchResponseSchema = z.object({
  inserted: z.number().int(),
});
