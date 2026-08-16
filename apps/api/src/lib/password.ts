import bcrypt from "bcryptjs";

// Matches apps/web/src/lib/password.ts's SALT_ROUNDS exactly — a hash
// produced by one app must verify correctly against the other, since both
// /register (web) and /auth/mobile/register (this file) write to the same
// users.password_hash column.
const SALT_ROUNDS = 12;

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  return bcrypt.compare(password, passwordHash);
}
