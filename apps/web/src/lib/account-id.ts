import { randomInt } from "node:crypto";
import { db, users } from "@pantheon/db";

/**
 * 8-digit numeric string for a user's Account ID — a short, human-shareable
 * identifier for network invitations (unlike `users.id`, a uuid nobody
 * could reasonably read aloud or type in). Stored with no separator; the UI
 * formats it for display (e.g. "1234-5678"). Callers must retry on a
 * unique-constraint conflict — this only generates a candidate, it doesn't
 * check uniqueness itself. Mirrors apps/api/src/lib/crypto.ts's
 * generateAccountId exactly — duplicated rather than shared since apps/web
 * never imports from apps/api (see lib/password.ts, lib/totp.ts for the
 * same convention).
 */
export function generateAccountId(): string {
  return String(randomInt(0, 100_000_000)).padStart(8, "0");
}

function isAccountIdConflict(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: string }).code === "23505" &&
    (error as { constraint?: string }).constraint === "users_account_id_unique_idx"
  );
}

const MAX_ACCOUNT_ID_ATTEMPTS = 5;

/**
 * Every user-creation path (NextAuth adapter's createUser override,
 * app/register/actions.ts) needs a unique accountId — this retries with a
 * fresh candidate on the rare collision rather than failing the whole
 * signup. Mirrors apps/api's insertUserWithAccountId in mobile-auth.ts.
 */
export async function insertUserWithAccountId(values: Omit<typeof users.$inferInsert, "accountId">) {
  for (let attempt = 0; attempt < MAX_ACCOUNT_ID_ATTEMPTS; attempt++) {
    try {
      const [user] = await db
        .insert(users)
        .values({ ...values, accountId: generateAccountId() })
        .returning();
      return user;
    } catch (error) {
      if (attempt === MAX_ACCOUNT_ID_ATTEMPTS - 1 || !isAccountIdConflict(error)) throw error;
    }
  }
  throw new Error("unreachable");
}
