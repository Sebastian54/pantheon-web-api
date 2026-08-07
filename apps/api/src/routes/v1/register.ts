import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { servers } from "@pantheon/db";
import { generateApiKey, generateServerUuid, hashApiKey } from "../../lib/crypto";
import {
  registerServerBodySchema,
  registerServerResponseSchema,
} from "../../schemas/register.schema";

/**
 * Provisions a server_uuid + api_key pair for a new Minecraft server.
 * OWNER-only: called from the dashboard, not by the Minecraft server itself —
 * the returned api_key is pasted into the plugin/mod config on the MC side.
 */
const registerRoute: FastifyPluginAsyncZod = async (fastify) => {
  fastify.post(
    "/register",
    {
      // preValidation (not preHandler) so auth is checked before body
      // validation runs — an unauthenticated caller never sees schema details.
      preValidation: fastify.requireOwner,
      schema: {
        body: registerServerBodySchema,
        response: {
          201: registerServerResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { name, loaderType, mcVersion } = request.body;

      const serverUuid = generateServerUuid();
      const apiKey = generateApiKey();
      const apiKeyHash = hashApiKey(apiKey);

      const [server] = await fastify.db
        .insert(servers)
        .values({ serverUuid, name, apiKeyHash, loaderType, mcVersion })
        .returning();

      fastify.log.info(
        { serverId: server.id, serverUuid, ownerId: request.session?.userId },
        "server registered",
      );

      // apiKey is returned exactly once here; only its hash is ever persisted.
      return reply.code(201).send({
        serverId: server.id,
        serverUuid: server.serverUuid,
        name: server.name,
        loaderType: server.loaderType,
        mcVersion: server.mcVersion,
        apiKey,
        createdAt: server.createdAt.toISOString(),
      });
    },
  );
};

export default registerRoute;
