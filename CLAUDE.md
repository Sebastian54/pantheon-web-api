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
