import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

// Read once at module load, not per-request — the version can't change while
// the process is running. Resolved relative to this file's own location
// (not process.cwd()) so it works the same whether run locally via tsx or
// from the Docker image's /usr/src/app, both of which preserve this same
// apps/api/src/routes/v1 -> repo-root path shape (see apps/api/Dockerfile's
// COPY package.json ./ alongside COPY apps/api apps/api).
const currentDir = dirname(fileURLToPath(import.meta.url));
const rootPackageJsonPath = resolve(currentDir, "../../../../../package.json");
const { version } = JSON.parse(readFileSync(rootPackageJsonPath, "utf-8")) as { version: string };

const versionResponseSchema = z.object({
  version: z.string(),
});

/**
 * Unauthenticated — the mc-mod's /pantheon version command and pre-login
 * app screens both need this reachable without a Bearer token, same as
 * /healthz.
 */
const versionRoute: FastifyPluginAsyncZod = async (fastify) => {
  fastify.get(
    "/version",
    {
      schema: {
        response: { 200: versionResponseSchema },
      },
    },
    async (_request, reply) => {
      return reply.code(200).send({ version });
    },
  );
};

export default versionRoute;
