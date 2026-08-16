import { verify } from "otplib";

// otplib v13's verify() defaults to epochTolerance: 0 (exact 30s step only,
// no drift allowance) — 30s each side (one step) matches the old v12
// "authenticator" default window of 1 and is the standard allowance for
// phone clock drift.
const EPOCH_TOLERANCE_SECONDS = 30;

export async function verifyTotpCode(code: string, secret: string): Promise<boolean> {
  try {
    const result = await verify({ secret, token: code, epochTolerance: EPOCH_TOLERANCE_SECONDS });
    return result.valid;
  } catch {
    return false;
  }
}
