import { z } from "zod";
import { loaderTypeEnum } from "@pantheon/db";

// Wire format is snake_case: this endpoint is called directly by the
// Minecraft server plugin (Java), not the JS dashboard.
export const registerServerBodySchema = z.object({
  name: z.string().trim().min(1).max(128).optional(),
  loader_type: z.enum(loaderTypeEnum.enumValues),
  mc_version: z.string().trim().min(1).max(32),
});

export type RegisterServerBody = z.infer<typeof registerServerBodySchema>;

export const registerServerResponseSchema = z.object({
  server_uuid: z.string().uuid(),
  api_key: z.string(),
  name: z.string(),
  loader_type: z.enum(loaderTypeEnum.enumValues),
  mc_version: z.string(),
  created_at: z.string(),
});
