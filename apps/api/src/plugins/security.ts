import fp from "fastify-plugin";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import type { FastifyPluginAsync } from "fastify";
import { env } from "../config/env";

const securityPlugin: FastifyPluginAsync = async (fastify) => {
  await fastify.register(helmet, { global: true });

  await fastify.register(cors, {
    origin: env.CORS_ORIGIN.split(",").map((origin) => origin.trim()),
    credentials: true,
  });

  await fastify.register(rateLimit, {
    max: 100,
    timeWindow: "1 minute",
  });
};

export default fp(securityPlugin, { name: "security" });
