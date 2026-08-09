import type { FastifyPluginAsync } from "fastify";

// Temporary: confirms the api -> Sentry pipe is wired up. Remove after verifying.
const debugSentryRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get("/debug-sentry", async () => {
    throw new Error("Sentry test error from apps/api");
  });
};

export default debugSentryRoute;
