import Fastify from "fastify";
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from "fastify-type-provider-zod";
import { env } from "./config/env";
import dbPlugin from "./plugins/db";
import sentryPlugin from "./plugins/sentry";
import securityPlugin from "./plugins/security";
import authPlugin from "./plugins/auth";
import serverAuthPlugin from "./plugins/serverAuth";
import healthRoute from "./routes/health";
import registerRoute from "./routes/v1/register";
import commandSpyRoute from "./routes/v1/command-spy";
import ledgerRoute from "./routes/v1/ledger";
import mobileAuthRoute from "./routes/v1/mobile-auth";
import networksRoute from "./routes/v1/networks";

export async function buildApp() {
  const fastify = Fastify({
    logger: {
      level: env.LOG_LEVEL,
      transport: env.NODE_ENV === "development" ? { target: "pino-pretty" } : undefined,
    },
    // The only ingress path is the cloudflared tunnel (the API container isn't
    // publicly port-mapped — see docker-compose.yml), so it's safe to trust its
    // X-Forwarded-For. Without this, every request behind the tunnel would
    // appear to share one IP, making all per-IP rate limiting meaningless.
    trustProxy: true,
  }).withTypeProvider<ZodTypeProvider>();

  fastify.setValidatorCompiler(validatorCompiler);
  fastify.setSerializerCompiler(serializerCompiler);

  fastify.setErrorHandler((error, request, reply) => {
    if (error.validation) {
      return reply.code(400).send({ error: "Bad Request", message: error.message });
    }

    request.log.error(error);
    const statusCode = error.statusCode ?? 500;
    return reply.code(statusCode).send({
      error: statusCode === 500 ? "Internal Server Error" : error.message,
    });
  });

  await fastify.register(sentryPlugin);
  await fastify.register(dbPlugin);
  await fastify.register(securityPlugin);
  await fastify.register(authPlugin);
  await fastify.register(serverAuthPlugin);

  await fastify.register(healthRoute);
  await fastify.register(registerRoute, { prefix: "/api/v1" });
  await fastify.register(commandSpyRoute, { prefix: "/api/v1" });
  await fastify.register(ledgerRoute, { prefix: "/api/v1" });
  await fastify.register(mobileAuthRoute, { prefix: "/api/v1" });
  await fastify.register(networksRoute, { prefix: "/api/v1" });

  return fastify;
}
