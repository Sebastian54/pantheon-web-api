"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth/next";
import { and, eq, isNull } from "drizzle-orm";
import { db, servers, serverAccessGrants } from "@pantheon/db";
import { authOptions } from "@/lib/auth";

// Server Actions are reachable via direct POST regardless of which page
// rendered the form, so auth is re-checked here rather than trusted from
// the page-level redirect.
async function requireNetworkManager(networkId: string) {
  const session = await getServerSession(authOptions);
  const membership = session?.user.networks.find((network) => network.id === networkId);
  if (!membership || (membership.role !== "OWNER" && membership.role !== "ADMIN")) {
    throw new Error("Unauthorized");
  }
  return session!;
}

export async function claimServer(networkId: string, serverId: string) {
  await requireNetworkManager(networkId);

  // Only claims a still-unclaimed server — prevents a manager of one network
  // from reassigning a server another network already claimed.
  await db
    .update(servers)
    .set({ networkId })
    .where(and(eq(servers.id, serverId), isNull(servers.networkId)));

  revalidatePath("/admin");
}

export async function grantServerAccess(networkId: string, userId: string, formData: FormData) {
  await requireNetworkManager(networkId);

  const serverUuid = formData.get("serverUuid");
  if (typeof serverUuid !== "string" || !serverUuid) {
    throw new Error("A server must be selected");
  }

  const server = await db.query.servers.findFirst({ where: eq(servers.serverUuid, serverUuid) });
  if (!server || server.networkId !== networkId) {
    throw new Error("Server not found in this network");
  }

  await db.insert(serverAccessGrants).values({ userId, serverUuid }).onConflictDoNothing();

  revalidatePath("/admin");
}

export async function revokeServerAccess(networkId: string, userId: string, serverUuid: string) {
  await requireNetworkManager(networkId);

  await db
    .delete(serverAccessGrants)
    .where(and(eq(serverAccessGrants.userId, userId), eq(serverAccessGrants.serverUuid, serverUuid)));

  revalidatePath("/admin");
}
