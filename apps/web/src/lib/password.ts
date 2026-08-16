import bcrypt from "bcryptjs";

// 12 rounds — bcryptjs's own recommendation for interactive (not
// batch/offline) hashing as of 2026, balancing brute-force cost against
// login-request latency on modest LXC-hosted hardware.
const SALT_ROUNDS = 12;

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  return bcrypt.compare(password, passwordHash);
}
