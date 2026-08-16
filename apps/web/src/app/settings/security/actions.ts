"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth/next";
import { eq } from "drizzle-orm";
import { db, users } from "@pantheon/db";
import { authOptions } from "@/lib/auth";
import { generateTotpSecret, buildTotpUri, totpUriToQrCodeDataUrl, verifyTotpCode } from "@/lib/totp";

/**
 * Generates and stores a fresh secret, but leaves twoFactorEnabled false —
 * it only flips to true once confirmTotpSetup verifies the user actually
 * has it loaded in an authenticator app, not just that setup was started.
 */
export async function startTotpSetup(): Promise<{ qrCodeDataUrl: string; secret: string }> {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error("Unauthorized");

  const secret = generateTotpSecret();
  await db.update(users).set({ twoFactorSecret: secret, twoFactorEnabled: false }).where(eq(users.id, session.user.id));

  const uri = buildTotpUri(session.user.email!, secret);
  const qrCodeDataUrl = await totpUriToQrCodeDataUrl(uri);
  return { qrCodeDataUrl, secret };
}

export async function confirmTotpSetup(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error("Unauthorized");

  const code = formData.get("code");
  if (typeof code !== "string" || !code.trim()) throw new Error("Enter the 6-digit code");

  const user = await db.query.users.findFirst({ where: eq(users.id, session.user.id) });
  if (!user?.twoFactorSecret) throw new Error("Start setup first");
  if (!(await verifyTotpCode(code.trim(), user.twoFactorSecret))) throw new Error("Invalid code — try again");

  await db.update(users).set({ twoFactorEnabled: true }).where(eq(users.id, session.user.id));
  revalidatePath("/settings");
}

// Requires a currently-valid code (not just a click-through confirm()) —
// the same bar GitHub/Google hold disabling 2FA to, since it's a
// security-downgrading action.
export async function disableTwoFactor(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error("Unauthorized");

  const code = formData.get("code");
  const user = await db.query.users.findFirst({ where: eq(users.id, session.user.id) });
  if (!user?.twoFactorEnabled || !user.twoFactorSecret) throw new Error("Two-factor is not enabled");
  if (typeof code !== "string" || !(await verifyTotpCode(code.trim(), user.twoFactorSecret))) {
    throw new Error("Invalid code");
  }

  await db.update(users).set({ twoFactorEnabled: false, twoFactorSecret: null }).where(eq(users.id, session.user.id));
  revalidatePath("/settings");
}
