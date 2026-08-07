import fp from "fastify-plugin";
import { eq } from "drizzle-orm";
import { servers } from "@pantheon/db";
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import { verifyApiKey } from "../lib/crypto";

type ServerContext = { id: string; serverUuid: string };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
 * server_uuid + api_key pair issued by POST /api/v1/register. server_uuid gives
 * an O(1) row lookup so the (expensive, scrypt) key check only ever runs once
 * per request, regardless of how many servers are registered.
 */
const serverAuthPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.decorateRequest("serverContext", null);

  fastify.decorate("requireServerApiKey", async (request: FastifyRequest, reply: FastifyReply) => {
    const serverUuid = request.headers["x-server-uuid"];
    const apiKey = request.headers["x-api-key"];

    if (typeof serverUuid !== "string" || typeof apiKey !== "string" || !UUID_RE.test(serverUuid)) {
      return reply.code(401).send({ error: "Unauthorized" });
    }

    const server = await fastify.db.query.servers.findFirst({
      where: eq(servers.serverUuid, serverUuid),
    });

    if (!server || !server.isActive || !verifyApiKey(apiKey, server.apiKeyHash)) {
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
