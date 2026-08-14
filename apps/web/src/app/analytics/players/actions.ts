"use server";

import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getVisibleServers } from "@/lib/visibility";
import { getActiveSessions } from "@/lib/analytics";
import type { ActiveSession } from "@/lib/analytics";

/** Polled from the client every 10s by LivePlayersList — not a form action. */
export async function fetchActiveSessions(): Promise<ActiveSession[]> {
  const session = await getServerSession(authOptions);
  if (!session) return [];
  const visibleServers = await getVisibleServers(session.user.id, session.user.networks);
  return getActiveSessions(visibleServers);
}
