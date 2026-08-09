import fp from "fastify-plugin";
import { decode } from "next-auth/jwt";
import { and, eq } from "drizzle-orm";
import { networkMembers, users } from "@pantheon/db";
import type { FastifyPluginAsync, FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { env } from "../config/env";

type Session = { userId: string };
type NetworkRole = "OWNER" | "ADMIN" | "MODERATOR";

const ROLE_RANK: Record<NetworkRole, number> = { MODERATOR: 0, ADMIN: 1, OWNER: 2 };

declare module "fastify" {
  interface FastifyRequest {
    session: Session | null;
  }
  interface FastifyInstance {
    requireAuth: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireNetworkRole: (
      minRole: NetworkRole,
    ) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

/**
 * Both apps/web and the mobile app forward their NextAuth session token as
 * `Authorization: Bearer <token>`; both share NEXTAUTH_SECRET, so the token
 * can be decoded here directly. Re-checks the user still exists (not trusted
 * from the token) so an account deletion takes effect immediately.
 */
async function decodeSession(fastify: FastifyInstance, request: FastifyRequest): Promise<Session | null> {
  const authHeader = request.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined;
  if (!token) {
    return null;
  }

  const payload = await decode({ token, secret: env.NEXTAUTH_SECRET }).catch(() => null);
  if (!payload?.sub) {
    return null;
  }

  const user = await fastify.db.query.users.findFirst({
    where: eq(users.id, payload.sub),
    columns: { id: true },
  });
  if (!user) {
    return null;
  }

  return { userId: user.id };
}

const authPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.decorateRequest("session", null);

  fastify.decorate("requireAuth", async (request: FastifyRequest, reply: FastifyReply) => {
    const session = await decodeSession(fastify, request);
    if (!session) {
      return reply.code(401).send({ error: "Unauthorized" });
    }
    request.session = session;
  });

  /** Routes using this must have a `:networkId` param. */
  fastify.decorate("requireNetworkRole", (minRole: NetworkRole) => {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      const session = await decodeSession(fastify, request);
      if (!session) {
        return reply.code(401).send({ error: "Unauthorized" });
      }

      const { networkId } = request.params as { networkId?: string };
      if (!networkId) {
        return reply.code(400).send({ error: "Bad Request", message: "networkId param required" });
      }

      const membership = await fastify.db.query.networkMembers.findFirst({
        where: and(eq(networkMembers.userId, session.userId), eq(networkMembers.networkId, networkId)),
        columns: { role: true },
      });

      if (!membership || ROLE_RANK[membership.role] < ROLE_RANK[minRole]) {
        return reply.code(403).send({ error: `Forbidden: ${minRole}+ role required` });
      }

      request.session = session;
    };
  });
};

export default fp(authPlugin, { name: "auth", dependencies: ["db"] });
