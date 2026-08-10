import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // pg's defaults for these are 0 (no timeout — wait forever), the same class
  // of bug as the un-timed-out Discord fetch calls in apps/api/src/lib/discord.ts:
  // a stalled connection attempt or a hung query would leave a request handler
  // awaiting indefinitely, eventually surfacing as a Cloudflare 502.
  connectionTimeoutMillis: 10_000,
  query_timeout: 15_000,
  statement_timeout: 15_000,
});

export const db = drizzle(pool, { schema });

export * from "./schema";
