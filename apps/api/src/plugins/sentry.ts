import fp from "fastify-plugin";
import * as Sentry from "@sentry/node";
import type { FastifyPluginAsync } from "fastify";
import { env } from "../config/env";

const sentryPlugin: FastifyPluginAsync = async (fastify) => {
  if (!env.SENTRY_DSN) {
    fastify.log.warn("SENTRY_DSN not set — error tracking disabled");
    return;
  }

  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,
    tracesSampleRate: env.NODE_ENV === "production" ? 0.2 : 1.0,
  });

  fastify.addHook("onError", async (_request, _reply, error) => {
    Sentry.captureException(error);
  });
};

export default fp(sentryPlugin, { name: "sentry" });
