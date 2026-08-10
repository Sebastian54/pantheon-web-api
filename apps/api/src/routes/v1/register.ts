import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { servers } from "@pantheon/db";
import { generateApiKey, generateLinkCode, generateServerUuid, hashApiKey } from "../../lib/crypto";
import {
  registerServerBodySchema,
  registerServerResponseSchema,
} from "../../schemas/register.schema";

/**
 * The handshake: a Minecraft server calls this directly (no prior auth) to
 * provision its own server_uuid + api_key pair on first boot. Public by
 * design — the plugin has no credentials yet, that's the point of this
 * endpoint. A spammed registration only ever creates an unclaimed row (no
 * access to anything), but it's still real ingestion work per request, so
 * this route gets a tighter rate limit than the app-wide default — legitimate
 * traffic is one call per server, ever, with maybe a retry or two.
 */
const registerRoute: FastifyPluginAsyncZod = async (fastify) => {
  fastify.post(
    "/register",
    {
      config: {
        rateLimit: {
          max: 5,
          timeWindow: "10 minutes",
        },
      },
      schema: {
        body: registerServerBodySchema,
        response: {
          201: registerServerResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { loader_type, mc_version } = request.body;

      const serverUuid = generateServerUuid();
      const name = request.body.name ?? `Server-${serverUuid.slice(0, 8)}`;
      const apiKey = generateApiKey();
      const apiKeyHash = hashApiKey(apiKey);
      const linkCode = generateLinkCode();
      const linkCodeExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

      const [server] = await fastify.db
        .insert(servers)
        .values({
          serverUuid,
          name,
          apiKeyHash,
          loaderType: loader_type,
          mcVersion: mc_version,
          linkCode,
          linkCodeExpiresAt,
        })
        .returning();

      fastify.log.info({ serverId: server.id, serverUuid }, "server registered");

      // apiKey and linkCode are both returned exactly once here — only
      // apiKey's hash is persisted, and linkCode is cleared once claimed.
      return reply.code(201).send({
        server_uuid: server.serverUuid,
        api_key: apiKey,
        name: server.name,
        loader_type: server.loaderType,
        mc_version: server.mcVersion,
        link_code: server.linkCode!,
        created_at: server.createdAt.toISOString(),
      });
    },
  );
};

export default registerRoute;
