import fp from "fastify-plugin";
import { decode } from "next-auth/jwt";
import { eq } from "drizzle-orm";
import { users } from "@pantheon/db";
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import { env } from "../config/env";

type Session = { userId: string; role: "OWNER" | "ADMIN" };

declare module "fastify" {
  interface FastifyRequest {
    session: Session | null;
  }
  interface FastifyInstance {
    requireOwner: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

/**
 * apps/web forwards its NextAuth session token as `Authorization: Bearer <token>`
 * on requests that need OWNER-level access. Both apps share NEXTAUTH_SECRET, so
 * the token can be decoded here directly. Role is re-checked against the
 * database (not trusted from the token) so a demotion takes effect immediately.
 */
const authPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.decorateRequest("session", null);

  fastify.decorate("requireOwner", async (request: FastifyRequest, reply: FastifyReply) => {
    const authHeader = request.headers.authorization;
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined;

    if (!token) {
      return reply.code(401).send({ error: "Unauthorized" });
    }

    const payload = await decode({ token, secret: env.NEXTAUTH_SECRET }).catch(() => null);
    if (!payload?.sub) {
      return reply.code(401).send({ error: "Unauthorized" });
    }

    const user = await fastify.db.query.users.findFirst({
      where: eq(users.id, payload.sub),
      columns: { id: true, role: true },
    });

    if (!user) {
      return reply.code(401).send({ error: "Unauthorized" });
    }

    if (user.role !== "OWNER") {
      return reply.code(403).send({ error: "Forbidden: OWNER role required" });
    }

    request.session = { userId: user.id, role: user.role };
  });
};

export default fp(authPlugin, { name: "auth", dependencies: ["db"] });
