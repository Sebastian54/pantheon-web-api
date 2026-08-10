import { createHash, randomBytes, randomInt, randomUUID, timingSafeEqual } from "node:crypto";

const KEY_PREFIX = "ptn_live_";

// Excludes 0/O and 1/I/L — this code gets read off a server console and typed
// into a phone, so ambiguous glyphs cost more than the entropy they'd add
// (31^8 ≈ 8.5e11 possibilities is already far more than this deployment's
// scale will ever need).
const LINK_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** 8-char pairing code for linking an unclaimed server into a network, formatted XXXX-XXXX. */
export function generateLinkCode(): string {
  const chars = Array.from(
    { length: 8 },
    () => LINK_CODE_ALPHABET[randomInt(LINK_CODE_ALPHABET.length)],
  );
  return `${chars.slice(0, 4).join("")}-${chars.slice(4).join("")}`;
}

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
