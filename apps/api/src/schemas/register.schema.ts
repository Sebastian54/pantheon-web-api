import { z } from "zod";
import { loaderTypeEnum } from "@pantheon/db";

export const registerServerBodySchema = z.object({
  name: z.string().trim().min(1).max(128),
  loaderType: z.enum(loaderTypeEnum.enumValues),
  mcVersion: z.string().trim().min(1).max(32),
});

export type RegisterServerBody = z.infer<typeof registerServerBodySchema>;

export const registerServerResponseSchema = z.object({
  serverId: z.string().uuid(),
  serverUuid: z.string().uuid(),
  name: z.string(),
  loaderType: z.enum(loaderTypeEnum.enumValues),
  mcVersion: z.string(),
  apiKey: z.string(),
  createdAt: z.string(),
});
