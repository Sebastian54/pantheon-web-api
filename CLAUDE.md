# Project Overview
**Name:** Pantheon - Admin Web Dashboard
**Domains:** `archer.software` (Frontend), `api.archer.software` (Backend)
**Purpose:** A centralized multi-tenant dashboard displaying analytics, command logs, and moderation data from remote Minecraft servers.

## Tech Stack Constraints
*   **Monorepo Tooling:** npm workspaces or Turborepo.
*   **Backend API (`/apps/api`):** Node.js, TypeScript, Fastify, Zod validation.
*   **Database:** PostgreSQL (with TimescaleDB extension for event logs), Drizzle ORM.
*   **Frontend (`/apps/web`):** Next.js (App Router), TypeScript, Tailwind CSS, shadcn/ui, Tremor for charts, Framer Motion.
*   **Authentication:** NextAuth.js (Auth.js) using **Discord OAuth**.

## UI/UX: Apple Liquid Glass Standards
The frontend must strictly adhere to Apple's Liquid Glass UI (macOS Tahoe / iOS 26) and Human Interface Guidelines. Use heavily layered `backdrop-blur`, fluid bubbles, thin semi-transparent borders, and a San Francisco system font stack.

## Authentication & Multi-Tenancy
*   **Web Users:** Handled via Discord OAuth.
*   **Multi-tenancy model:** Network-first. A `network` is the team/tenant boundary, owned by one user (`networks.owner_id`) with per-network roles (`OWNER`/`ADMIN`/`MODERATOR`) assigned via `network_members`. OWNER/ADMIN have implicit access to every server in their network; MODERATOR needs an explicit `server_access_grants` row per server. There is no global role anymore — `users.role` and `user_servers` were removed in the cutover to this model (2026-08-09).
*   **Server claiming:** `servers.network_id` is nullable. `POST /api/v1/register` is an unauthenticated handshake with no way to know which network a freshly-booted server belongs to, so new rows land with `network_id = NULL` ("unclaimed"). A network OWNER/ADMIN claims an unclaimed server into their network from `/admin`.
*   **Bootstrapping:** A signed-in user with zero network memberships sees a "Create your network" prompt on `/` instead of the dashboard; creating one makes them its OWNER.
*   **Server Identity:** Every Minecraft server is tracked via a `server_uuid`.
*   **The Handshake:** Fastify exposes a `/api/v1/register` endpoint to provision `server_uuid`s and `api_key`s for new servers.

## Security & Development Rules
1.  **Strict `.gitignore` Policy:** Sensitive data must never be committed. The `.gitignore` must strictly block `.env`, `.env.local`, `.env.*`, all API keys, database URLs, and TLS/SSL certs.
2.  **API Batching:** Fastify routes handling high-volume data (Command Spy, Ledger) must expect and validate batch JSON arrays.

## Deployment & Infrastructure Rules
*   **Host Environment:** Self-hosted Proxmox VE server.
*   **Target Container:** Debian/Ubuntu LXC or VM running Docker and Docker Compose.
*   **Database Hosting (production):** PostgreSQL/TimescaleDB is externally hosted on an Oracle Cloud VPS, not a container in `docker-compose.prod.yml` — there is no `postgres` service in prod (unlike `docker-compose.yml`, local dev, which still runs `timescale/timescaledb` locally). `api`/`web` both take `DATABASE_URL` straight from `.env.production` unmodified — nothing in the compose file rewrites it to an internal service name. The Oracle instance needs the `timescaledb` extension installed for the hypertable migrations (`0001`, `0007`) to apply.
*   **Networking & SSL:** Cloudflare Tunnel (`cloudflared`) for securely routing traffic. Transport protocol is pinned to `http2` (TCP) via `command: tunnel --protocol http2 --no-autoupdate run` in `docker-compose.prod.yml` — the default QUIC (UDP) transport was timing out/dropping connections over the Proxmox LXC network path, so http2 trades QUIC's latency benefits for connection stability in this environment.
*   **GitHub Student Pack Tools:** Integrate `@sentry/node` and `@sentry/nextjs` for error tracking.

## Current State

**Monorepo:** `apps/api` (Fastify), `apps/web` (Next.js 16, App Router, Turbopack), `packages/db` (Drizzle schema + migrations), npm workspaces.

**Database (`packages/db`):** `users`/`accounts`/`sessions`/`verification_tokens` (NextAuth Drizzle adapter shape — `users` has no role column, see Authentication & Multi-Tenancy), `networks` (`name`, `owner_id` → `users.id`, `onDelete: restrict` — deleting a user never silently deletes their network), `network_members` (join table: `user_id`, `network_id`, per-network `role` enum `OWNER`/`ADMIN`/`MODERATOR`, composite PK), `servers` (`server_uuid`, `api_key_hash`, `loader_type`, `mc_version`, nullable `network_id` → `networks.id` `onDelete: set null`, unique-indexed on both `server_uuid` and `api_key_hash`), `server_access_grants` (join table: `user_id`, `server_uuid` → `servers.server_uuid` cascade, composite PK — whitelists servers within a network per MODERATOR user), `command_spy_logs` / `ledger_logs` (TimescaleDB hypertables, `occurred_at`-partitioned, 90-day retention). Migrations in `packages/db/drizzle`; migration `0003` is the network-first cutover — adds `networks`/`network_members`/`server_access_grants` and `servers.network_id`, drops `users.role` (column + enum) and `user_servers` entirely. The hypertable conversion (`0001_timescale_hypertables.sql`) requires the `timescaledb` extension, present on the `timescale/timescaledb` image in `docker-compose.yml` — not on a plain local Postgres.

**API (`apps/api`):**
*   `POST /api/v1/register` — **public handshake**, no auth required. Called directly by the Minecraft server plugin on first boot. Body: `{ name?, loader_type, mc_version }` (snake_case — Java-consumed wire format). Generates `server_uuid` (UUIDv4) and an API key (`ptn_live_` + 32 random bytes), stores only `SHA-256(api_key)` (deterministic — safe for a 256-bit random secret, and enables O(1) lookup by hash), returns `{ server_uuid, api_key, ... }` once. Abuse protection: a route-level rate limit (5 req/10 min per IP, tighter than the app-wide default) plus `trustProxy: true` so per-IP limiting actually works behind the Cloudflare Tunnel instead of bucketing every request under the tunnel's IP.
*   `POST /api/v1/command-spy`, `POST /api/v1/ledger` — batch ingestion (`{ events: [...] }`, 1–500 items, Zod-validated), authenticated via `Authorization: Bearer <api_key>` (looked up by hash — see `plugins/serverAuth.ts`).
*   `GET /api/v1/networks`, `POST /api/v1/networks` (`routes/v1/networks.ts`) — **fully implemented**, used by the iOS app. Both require `Authorization: Bearer <token>` (a NextAuth session token — the same one `/api/v1/auth/mobile/discord` mints) via `fastify.requireAuth`. `GET` returns every network the caller belongs to (`{ id, name, ownerId, role, createdAt }[]`, camelCase — JS/mobile wire format, unlike `/register`'s Java-consumed snake_case) by joining `network_members` → `networks`. `POST` takes `{ name }`, inserts the network and the caller's own `network_members` row with role `OWNER` in one transaction, returns `201` with the created network (`role: "OWNER"`).
*   `fastify.requireAuth` (`plugins/auth.ts`) decodes a NextAuth JWT forwarded as a Bearer token and re-checks the user still exists in the DB (never trusted from the token alone) — no role check, just authentication. `fastify.requireNetworkRole(minRole)` builds on the same token decoding, additionally reading `:networkId` from the route params and re-checking the caller's `network_members` role; not currently applied to any route (no route needs a `:networkId`-scoped check yet), but available for future network-scoped admin endpoints.
*   `GET /healthz` for container healthchecks.

**Web (`apps/web`):** NextAuth v4 + Discord OAuth (`@auth/drizzle-adapter`, JWT session strategy so `apps/api` can decode it), shadcn/ui initialized (`components.json`, `Button`/`Card`/`Badge`). The session's `session.user.networks` (`{ id, name, role }[]`) is re-derived from `network_members` on every request inside the `session()` callback (`lib/auth.ts`) — never stale, since the JWT strategy re-runs that callback on each `getServerSession` call. Dashboard (`/`) aggregates servers across every network the user belongs to (`lib/servers.ts`: OWNER/ADMIN see all servers in that network, MODERATOR sees only servers granted via `server_access_grants`); a user with zero network memberships sees a "Create your network" prompt instead (`app/actions.ts#createNetwork`). `/sign-in` has the Discord sign-in button and redirects to `/` if already authenticated. `/admin` (redirects anyone managing zero networks) renders one section per network the caller is OWNER/ADMIN of: an unclaimed-servers list with a claim button, and MODERATOR members with per-server grant/revoke controls, via Server Actions (`app/admin/actions.ts`) that independently re-check the caller's network role — Server Actions are directly POST-reachable regardless of page-level redirects, so the page guard alone isn't sufficient.

**Not yet built:** Command Spy / Ledger dashboard views, any use of the ingested event-log data. Also not yet built: any route actually using `fastify.requireNetworkRole`; a UI for inviting/removing network members (network membership rows currently only get created via `createNetwork`'s own-OWNER insert).
