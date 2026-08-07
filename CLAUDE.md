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
*   **Web Users:** Handled via Discord OAuth. The database tracks roles: `OWNER` (Global Super-Admin) and `ADMIN` (Server-specific Admin).
*   **Server Identity:** Every Minecraft server is tracked via a `server_uuid`.
*   **The Handshake:** Fastify exposes a `/api/v1/register` endpoint to provision `server_uuid`s and `api_key`s for new servers.

## Security & Development Rules
1.  **Strict `.gitignore` Policy:** Sensitive data must never be committed. The `.gitignore` must strictly block `.env`, `.env.local`, `.env.*`, all API keys, database URLs, and TLS/SSL certs.
2.  **API Batching:** Fastify routes handling high-volume data (Command Spy, Ledger) must expect and validate batch JSON arrays.

## Deployment & Infrastructure Rules
*   **Host Environment:** Self-hosted Proxmox VE server.
*   **Target Container:** Debian/Ubuntu LXC or VM running Docker and Docker Compose.
*   **Networking & SSL:** Cloudflare Tunnel (`cloudflared`) for securely routing traffic.
*   **GitHub Student Pack Tools:** Integrate `@sentry/node` and `@sentry/nextjs` for error tracking.

## Current State

**Monorepo:** `apps/api` (Fastify), `apps/web` (Next.js 16, App Router, Turbopack), `packages/db` (Drizzle schema + migrations), npm workspaces.

**Database (`packages/db`):** `users`/`accounts`/`sessions`/`verification_tokens` (NextAuth Drizzle adapter shape, `users.role` enum `OWNER`/`ADMIN`), `servers` (`server_uuid`, `api_key_hash`, `loader_type`, `mc_version`, unique-indexed on both `server_uuid` and `api_key_hash`), `user_servers` (join table scoping `ADMIN` access), `command_spy_logs` / `ledger_logs` (TimescaleDB hypertables, `occurred_at`-partitioned, 90-day retention). Migrations in `packages/db/drizzle`; the hypertable conversion (`0001_timescale_hypertables.sql`) requires the `timescaledb` extension, present on the `timescale/timescaledb` image in `docker-compose.yml` — not on a plain local Postgres.

**API (`apps/api`):**
*   `POST /api/v1/register` — **public handshake**, no auth required. Called directly by the Minecraft server plugin on first boot. Body: `{ name?, loader_type, mc_version }` (snake_case — Java-consumed wire format). Generates `server_uuid` (UUIDv4) and an API key (`ptn_live_` + 32 random bytes), stores only `SHA-256(api_key)` (deterministic — safe for a 256-bit random secret, and enables O(1) lookup by hash), returns `{ server_uuid, api_key, ... }` once. Abuse protection: a route-level rate limit (5 req/10 min per IP, tighter than the app-wide default) plus `trustProxy: true` so per-IP limiting actually works behind the Cloudflare Tunnel instead of bucketing every request under the tunnel's IP.
*   `POST /api/v1/command-spy`, `POST /api/v1/ledger` — batch ingestion (`{ events: [...] }`, 1–500 items, Zod-validated), authenticated via `Authorization: Bearer <api_key>` (looked up by hash — see `plugins/serverAuth.ts`).
*   `fastify.requireOwner` (`plugins/auth.ts`) decodes a NextAuth JWT forwarded as a Bearer token and re-checks role against the DB; not currently applied to any route, but available for future OWNER-gated admin endpoints.
*   `GET /healthz` for container healthchecks.

**Web (`apps/web`):** NextAuth v4 + Discord OAuth (`@auth/drizzle-adapter`, JWT session strategy so `apps/api` can decode it), shadcn/ui initialized (`components.json`, `Button`/`Card`/`Badge`), dashboard (`/`) shows a role-scoped Servers overview (`OWNER` sees all, `ADMIN` sees only servers granted via `user_servers`) queried directly from `@pantheon/db`. `/sign-in` has the Discord sign-in button. `/admin` (OWNER-only, redirects everyone else) lists every `ADMIN` user and lets the OWNER grant/revoke per-server access via Server Actions (`app/admin/actions.ts`) that independently re-check the caller's role — Server Actions are directly POST-reachable regardless of page-level redirects, so the page guard alone isn't sufficient. No UI yet for triggering `/register` (it's server-initiated, not dashboard-initiated).

**Not yet built:** Command Spy / Ledger dashboard views, any use of the ingested event-log data.
