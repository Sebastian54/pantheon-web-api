import fp from "fastify-plugin";
import { eq } from "drizzle-orm";
import { servers } from "@pantheon/db";
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import { hashApiKey } from "../lib/crypto";

type ServerContext = { id: string; serverUuid: string };

declare module "fastify" {
  interface FastifyRequest {
    serverContext: ServerContext | null;
  }
  interface FastifyInstance {
    requireServerApiKey: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

/**
 * Authenticates Minecraft-server-side requests (Command Spy, Ledger) using the
 * api_key issued by POST /api/v1/register, sent as `Authorization: Bearer`.
 * The hash is deterministic (see lib/crypto.ts), so the row is found with a
 * single indexed lookup — no separate server_uuid header needed.
 */
const serverAuthPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.decorateRequest("serverContext", null);

  fastify.decorate("requireServerApiKey", async (request: FastifyRequest, reply: FastifyReply) => {
    const authHeader = request.headers.authorization;
    const apiKey = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined;

    if (!apiKey) {
      return reply.code(401).send({ error: "Unauthorized" });
    }

    const server = await fastify.db.query.servers.findFirst({
      where: eq(servers.apiKeyHash, hashApiKey(apiKey)),
    });

    if (!server || !server.isActive) {
      return reply.code(401).send({ error: "Unauthorized" });
    }

    request.serverContext = { id: server.id, serverUuid: server.serverUuid };

    await fastify.db
      .update(servers)
      .set({ lastSeenAt: new Date() })
      .where(eq(servers.id, server.id));
  });
};

export default fp(serverAuthPlugin, { name: "server-auth", dependencies: ["db"] });
