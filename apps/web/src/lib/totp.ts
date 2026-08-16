import { generateSecret, generateURI, verify } from "otplib";
import QRCode from "qrcode";

const ISSUER = "Pantheon";

// otplib v13's verify() defaults to epochTolerance: 0 (exact 30s step only,
// no drift allowance) — 30s each side (one step) matches the old v12
// "authenticator" default window of 1 and is the standard allowance for
// phone clock drift.
const EPOCH_TOLERANCE_SECONDS = 30;

export function generateTotpSecret(): string {
  return generateSecret();
}

/** otpauth:// URI an authenticator app (Google Authenticator, 1Password, etc.) scans to add the account. */
export function buildTotpUri(email: string, secret: string): string {
  return generateURI({ issuer: ISSUER, label: email, secret });
}

export function totpUriToQrCodeDataUrl(otpAuthUri: string): Promise<string> {
  return QRCode.toDataURL(otpAuthUri);
}

export async function verifyTotpCode(code: string, secret: string): Promise<boolean> {
  try {
    const result = await verify({ secret, token: code, epochTolerance: EPOCH_TOLERANCE_SECONDS });
    return result.valid;
  } catch {
    return false;
  }
}
