import { z } from "zod";
import { networkRoleEnum } from "@pantheon/db";

export const createNetworkBodySchema = z.object({
  name: z.string().trim().min(1).max(128),
});

export type CreateNetworkBody = z.infer<typeof createNetworkBodySchema>;

export const networkResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  ownerId: z.string().uuid(),
  role: z.enum(networkRoleEnum.enumValues),
  createdAt: z.string(),
});

export const networksListResponseSchema = z.array(networkResponseSchema);

export const networkIdParamsSchema = z.object({
  networkId: z.string().uuid(),
});

// camelCase, like the rest of this file — unlike registerServerBodySchema,
// this endpoint is JS/mobile-facing, not Java-plugin-consumed.
export const linkServerBodySchema = z.object({
  linkCode: z.string().trim().min(1),
});

export const linkServerResponseSchema = z.object({
  id: z.string().uuid(),
  serverUuid: z.string().uuid(),
  name: z.string(),
  networkId: z.string().uuid(),
});

export const linkServerErrorSchema = z.object({
  error: z.string(),
  message: z.string().optional(),
});

export const networkServerSummarySchema = z.object({
  id: z.string().uuid(),
  serverUuid: z.string().uuid(),
  name: z.string(),
  loaderType: z.string(),
  mcVersion: z.string(),
  isActive: z.boolean(),
  lastSeenAt: z.string().nullable(),
  createdAt: z.string(),
});

export const networkServersListResponseSchema = z.array(networkServerSummarySchema);
