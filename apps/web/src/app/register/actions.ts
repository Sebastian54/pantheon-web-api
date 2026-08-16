"use server";

import { randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, users, verificationTokens } from "@pantheon/db";
import { hashPassword } from "@/lib/password";
import { sendVerificationEmail } from "@/lib/mailgun";
import { insertUserWithAccountId } from "@/lib/account-id";

const VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

export async function registerUser(formData: FormData) {
  const name = formData.get("name");
  const email = formData.get("email");
  const password = formData.get("password");

  if (typeof name !== "string" || !name.trim()) {
    throw new Error("A display name is required");
  }
  if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("A valid email address is required");
  }
  if (typeof password !== "string" || password.length < 8) {
    throw new Error("Password must be at least 8 characters");
  }

  const normalizedEmail = email.trim().toLowerCase();

  const existing = await db.query.users.findFirst({ where: eq(users.email, normalizedEmail) });
  if (existing) {
    // Same "don't reveal which part was wrong" instinct as the sign-in
    // path — but registration has no password to check against, so the
    // honest error is the best we can do without a full "if this email is
    // already registered" flow email — acceptable since account enumeration
    // via registration forms is a lower-severity, widely-accepted tradeoff.
    throw new Error("An account with that email already exists");
  }

  const passwordHash = await hashPassword(password);

  const user = await insertUserWithAccountId({
    name: name.trim(),
    email: normalizedEmail,
    passwordHash,
  });

  const token = randomBytes(32).toString("hex");
  await db.transaction(async (tx) => {
    await tx.delete(verificationTokens).where(eq(verificationTokens.identifier, normalizedEmail));
    await tx.insert(verificationTokens).values({
      identifier: normalizedEmail,
      token,
      expires: new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS),
    });
  });

  const verifyUrl = `${process.env.NEXTAUTH_URL}/verify-email?token=${token}&email=${encodeURIComponent(normalizedEmail)}`;
  try {
    await sendVerificationEmail(user.email, verifyUrl);
  } catch (error) {
    // The account was created either way — don't strand the user on a
    // generic error page for a Mailgun outage. verify-email's own
    // "resend" path (once built) is the recovery route.
    console.error("Failed to send verification email", error);
  }

  redirect("/register/success");
}
