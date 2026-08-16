import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { eq } from "drizzle-orm";
import { db, users } from "@pantheon/db";

// Anything reachable without a completed profile — sign-in/registration
// itself, the completion page, and the email-verification link (a Route
// Handler, not under /api, so the matcher's negative lookahead below
// doesn't already exclude it).
const PUBLIC_PATHS = ["/sign-in", "/register", "/register/success", "/verify-email", "/complete-profile"];

/**
 * OAuth Guard: Discord/Google sign-ins never collect a display name
 * (nothing prompts for one), and pre-existing email/password accounts from
 * before this system predate the now-mandatory name too — this catches
 * both by redirecting anyone with an empty users.name to /complete-profile
 * before they reach the dashboard. Runs on Next's default Node.js runtime
 * (proxy.ts, unlike the old middleware.ts, no longer needs an edge-specific
 * data layer), so a direct DB read here is safe and always current — unlike
 * the JWT's own cached `name` claim, which only reflects sign-in time.
 */
export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))) {
    return NextResponse.next();
  }

  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  if (!token?.sub) {
    // No session — each page already does its own getServerSession +
    // redirect("/sign-in") check; this guard only needs to handle the
    // "signed in but incomplete" case.
    return NextResponse.next();
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, token.sub),
    columns: { name: true },
  });

  if (user && !user.name) {
    return NextResponse.redirect(new URL("/complete-profile", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
