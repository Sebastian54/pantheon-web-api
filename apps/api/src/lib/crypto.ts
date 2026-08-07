import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";

const KEY_PREFIX = "ptn_live_";

/** Raw key handed to the operator once at registration time; only its hash is persisted. */
export function generateApiKey(): string {
  return `${KEY_PREFIX}${randomBytes(32).toString("base64url")}`;
}

export function generateServerUuid(): string {
  return randomUUID();
}

/**
 * Deterministic SHA-256 — safe here because the input is a 256-bit random
 * token (crypto.randomBytes), not a low-entropy password: brute-forcing or
 * rainbow-tabling a value with that much entropy is infeasible regardless of
 * hash speed. Determinism is what lets servers authenticate via a single
 * `Authorization: Bearer` lookup (WHERE api_key_hash = ?) instead of needing
 * a secondary identifier.
 */
export function hashApiKey(rawKey: string): string {
  return createHash("sha256").update(rawKey, "utf8").digest("hex");
}

export function verifyApiKey(rawKey: string, storedHash: string): boolean {
  const candidate = Buffer.from(hashApiKey(rawKey), "hex");
  const stored = Buffer.from(storedHash, "hex");
  if (candidate.length !== stored.length) return false;

  return timingSafeEqual(candidate, stored);
}
