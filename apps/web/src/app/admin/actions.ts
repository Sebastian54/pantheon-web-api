"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth/next";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { db, servers, serverAccessGrants, networkMembers, users } from "@pantheon/db";
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

export async function addNetworkMember(networkId: string, formData: FormData) {
  await requireNetworkManager(networkId);

  const rawAccountId = formData.get("accountId");
  if (typeof rawAccountId !== "string") {
    throw new Error("An Account ID is required");
  }
  // Accepts either the bare 8 digits or the "1234-5678" display format.
  const accountId = rawAccountId.replace(/[^0-9]/g, "");
  if (accountId.length !== 8) {
    throw new Error("Account ID must be 8 digits");
  }

  const targetUser = await db.query.users.findFirst({ where: eq(users.accountId, accountId) });
  if (!targetUser) {
    throw new Error("No account with that Account ID");
  }

  const existingMembership = await db.query.networkMembers.findFirst({
    where: and(eq(networkMembers.userId, targetUser.id), eq(networkMembers.networkId, networkId)),
  });
  if (existingMembership) {
    throw new Error("That user is already a member of this network");
  }

  // New members always land as MODERATOR — inviting straight in as
  // ADMIN/OWNER is a role-change operation, not something this form does.
  await db.insert(networkMembers).values({ userId: targetUser.id, networkId, role: "MODERATOR" });

  revalidatePath("/admin");
}

/**
 * Bulk-replaces a member's server_access_grants scoped to this network's
 * servers — matching apps/api's PUT .../members/:userId/grants semantics
 * exactly (delete this network's grants for the user, insert the given
 * set), not an incremental add/remove.
 */
export async function updateMemberGrants(networkId: string, userId: string, formData: FormData) {
  await requireNetworkManager(networkId);

  const membership = await db.query.networkMembers.findFirst({
    where: and(eq(networkMembers.userId, userId), eq(networkMembers.networkId, networkId)),
  });
  if (!membership) {
    throw new Error("That user is not a member of this network");
  }

  const networkServers = await db.query.servers.findMany({
    where: eq(servers.networkId, networkId),
    columns: { serverUuid: true },
  });
  const networkServerUuids = networkServers.map((server) => server.serverUuid);
  const networkServerUuidSet = new Set(networkServerUuids);

  const serverUuids = formData.getAll("serverUuid").filter((value): value is string => typeof value === "string");
  const invalidUuid = serverUuids.find((serverUuid) => !networkServerUuidSet.has(serverUuid));
  if (invalidUuid) {
    throw new Error("One of the selected servers is not in this network");
  }

  await db.transaction(async (tx) => {
    if (networkServerUuids.length > 0) {
      await tx
        .delete(serverAccessGrants)
        .where(and(eq(serverAccessGrants.userId, userId), inArray(serverAccessGrants.serverUuid, networkServerUuids)));
    }
    if (serverUuids.length > 0) {
      await tx
        .insert(serverAccessGrants)
        .values(serverUuids.map((serverUuid) => ({ userId, serverUuid })))
        .onConflictDoNothing();
    }
  });

  revalidatePath("/admin");
}
