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
