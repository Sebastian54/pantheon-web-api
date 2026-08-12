import { z } from "zod";

// Wire format is snake_case: sent directly by the Minecraft server plugin
// (Java), not the JS dashboard — same convention as register.schema.ts.
export const heartbeatBodySchema = z.object({
  player_count: z.number().int().min(0),
  max_players: z.number().int().min(0),
  tps: z.number().min(0),
  // Optional — older plugin/mod versions won't send this yet, and omitting
  // it should leave the server's previously-known installed_mods untouched
  // rather than wiping it back to empty.
  installed_mods: z.array(z.string().min(1).max(64)).max(100).optional(),
});

export type HeartbeatBody = z.infer<typeof heartbeatBodySchema>;

export const heartbeatResponseSchema = z.object({
  ok: z.literal(true),
});
