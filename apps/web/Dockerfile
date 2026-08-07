# syntax=docker/dockerfile:1
FROM node:20-alpine AS base
WORKDIR /usr/src/app

FROM base AS deps
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
COPY packages/db/package.json packages/db/package.json
RUN npm ci --workspace=@pantheon/web --workspace=@pantheon/db --include-workspace-root

FROM base AS build
COPY --from=deps /usr/src/app/node_modules ./node_modules
COPY . .
RUN npm run build -w apps/web

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=deps /usr/src/app/node_modules ./node_modules
COPY --from=build /usr/src/app/apps/web/.next ./apps/web/.next
COPY --from=build /usr/src/app/apps/web/public ./apps/web/public
COPY --from=build /usr/src/app/apps/web/package.json ./apps/web/package.json
EXPOSE 3000
CMD ["npm", "run", "start", "-w", "apps/web"]
