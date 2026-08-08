# syntax=docker/dockerfile:1
FROM node:20-alpine AS base
WORKDIR /usr/src/app

FROM base AS deps
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
COPY packages/db/package.json packages/db/package.json
RUN npm ci --workspace=@pantheon/web --workspace=@pantheon/db --include-workspace-root

FROM base AS build
# NEXT_PUBLIC_* vars are inlined into the client bundle by `next build`, so
# they must be supplied here as build args — setting them only as container
# runtime env (via env_file/environment in docker-compose) has no effect on
# already-built client-side code. Real secrets (DATABASE_URL, NEXTAUTH_SECRET,
# DISCORD_CLIENT_SECRET, ...) are deliberately NOT passed as build args, since
# build args get baked into image layer history — they stay runtime-only.
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_SENTRY_DSN
ARG SENTRY_ORG
ARG SENTRY_PROJECT
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_SENTRY_DSN=$NEXT_PUBLIC_SENTRY_DSN
ENV SENTRY_ORG=$SENTRY_ORG
ENV SENTRY_PROJECT=$SENTRY_PROJECT
COPY --from=deps /usr/src/app/node_modules ./node_modules
COPY . .
RUN npm run build -w apps/web

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=deps /usr/src/app/node_modules ./node_modules
# `npm run start -w apps/web` needs the workspace-root package.json (for the
# "workspaces" field) present at /usr/src/app — without it npm can't resolve
# the -w flag and fails with ENOENT on /usr/src/app/package.json.
COPY package.json package-lock.json ./
COPY --from=build /usr/src/app/apps/web/.next ./apps/web/.next
COPY --from=build /usr/src/app/apps/web/public ./apps/web/public
COPY --from=build /usr/src/app/apps/web/package.json ./apps/web/package.json
EXPOSE 3000
CMD ["npm", "run", "start", "-w", "apps/web"]
