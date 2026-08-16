import { NextRequest, NextResponse } from "next/server";
import { and, eq, gt } from "drizzle-orm";
import { db, users, verificationTokens } from "@pantheon/db";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  const email = request.nextUrl.searchParams.get("email");

  if (!token || !email) {
    return NextResponse.redirect(new URL("/sign-in?verifyError=1", request.url));
  }

  const normalizedEmail = email.toLowerCase();

  const verified = await db.transaction(async (tx) => {
    const [row] = await tx
      .delete(verificationTokens)
      .where(
        and(
          eq(verificationTokens.identifier, normalizedEmail),
          eq(verificationTokens.token, token),
          gt(verificationTokens.expires, new Date()),
        ),
      )
      .returning();
    if (!row) return false;

    await tx.update(users).set({ emailVerified: new Date() }).where(eq(users.email, normalizedEmail));
    return true;
  });

  return NextResponse.redirect(
    new URL(verified ? "/sign-in?verified=1" : "/sign-in?verifyError=1", request.url),
  );
}
