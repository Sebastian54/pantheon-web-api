import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { env } from "../config/env";

const KEY_PREFIX = "pk_live_";
const SCRYPT_KEYLEN = 64;

/** Raw key handed to the operator once at registration time; only its hash is persisted. */
export function generateApiKey(): string {
  return `${KEY_PREFIX}${randomBytes(32).toString("base64url")}`;
}

export function generateServerUuid(): string {
  return randomUUID();
}

/** Stored as `${salt}:${derivedHex}` — salt is per-key, pepper is a server-side secret. */
export function hashApiKey(rawKey: string): string {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(`${rawKey}${env.API_KEY_PEPPER}`, salt, SCRYPT_KEYLEN);
  return `${salt}:${derived.toString("hex")}`;
}

export function verifyApiKey(rawKey: string, storedHash: string): boolean {
  const [salt, derivedHex] = storedHash.split(":");
  if (!salt || !derivedHex) return false;

  const derived = scryptSync(`${rawKey}${env.API_KEY_PEPPER}`, salt, SCRYPT_KEYLEN);
  const stored = Buffer.from(derivedHex, "hex");
  if (derived.length !== stored.length) return false;

  return timingSafeEqual(derived, stored);
}
