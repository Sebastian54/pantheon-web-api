import { z } from "zod";

const commandSpyEntrySchema = z.object({
  executor: z.string().min(1).max(64),
  executorUuid: z.string().uuid().optional(),
  command: z.string().min(1),
  occurredAt: z.string().datetime().optional(),
});

// CLAUDE.md API Batching rule: high-volume routes must expect a batch array.
export const commandSpyBatchBodySchema = z.object({
  events: z.array(commandSpyEntrySchema).min(1).max(500),
});

export type CommandSpyBatchBody = z.infer<typeof commandSpyBatchBodySchema>;

export const commandSpyBatchResponseSchema = z.object({
  inserted: z.number().int(),
});
