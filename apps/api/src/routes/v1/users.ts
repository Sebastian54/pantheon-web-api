import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { eq } from "drizzle-orm";
import { users } from "@pantheon/db";
import { updateMeBodySchema, meResponseSchema, usersErrorSchema } from "../../schemas/users.schema";

/**
 * The one profile-editing endpoint the mobile app needs so far: setting a
 * missing display name (its one-time "Complete Profile" screen, and any
 * future profile-editing UI). Always acts on the authenticated caller —
 * there's no :userId param, so there's nothing to authorize beyond "is this
 * a valid session at all."
 */
const usersRoute: FastifyPluginAsyncZod = async (fastify) => {
  fastify.patch(
    "/users/me",
    {
      preHandler: fastify.requireAuth,
      schema: {
        body: updateMeBodySchema,
        response: {
          200: meResponseSchema,
          401: usersErrorSchema,
        },
      },
    },
    async (request, reply) => {
      const { name } = request.body;
      const { userId } = request.session!;

      const [updated] = await fastify.db.update(users).set({ name }).where(eq(users.id, userId)).returning();

      return reply
        .code(200)
        .send({ id: updated.id, name: updated.name, email: updated.email, accountId: updated.accountId });
    },
  );
};

export default usersRoute;
