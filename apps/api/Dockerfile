# syntax=docker/dockerfile:1
FROM node:20-alpine AS base
WORKDIR /usr/src/app

FROM base AS deps
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/db/package.json packages/db/package.json
RUN npm ci --workspace=@pantheon/api --workspace=@pantheon/db --include-workspace-root

# No separate compile step: @pantheon/db ships raw TypeScript (consumed via tsx
# in dev and Next's transpilePackages in apps/web), so apps/api runs the same
# way here — through tsx — to keep module resolution identical in prod and dev.
FROM base AS runtime
ENV NODE_ENV=production
COPY --from=deps /usr/src/app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY apps/api apps/api
COPY packages/db packages/db
EXPOSE 4000
CMD ["npm", "run", "start", "-w", "apps/api"]
