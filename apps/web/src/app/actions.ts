"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth/next";
import { and, eq, gt } from "drizzle-orm";
import { db, networks, networkMembers, servers, serverAccessGrants } from "@pantheon/db";
import { authOptions } from "@/lib/auth";

export async function createNetwork(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session) {
    throw new Error("Unauthorized");
  }

  const name = formData.get("name");
  if (typeof name !== "string" || !name.trim()) {
    throw new Error("A network name is required");
  }

  await db.transaction(async (tx) => {
    const [network] = await tx
      .insert(networks)
      .values({ name: name.trim(), ownerId: session.user.id })
      .returning();
    await tx.insert(networkMembers).values({
      userId: session.user.id,
      networkId: network.id,
      role: "OWNER",
    });
  });

  revalidatePath("/");
}

// Inserts the missing hyphen if given the bare 8 characters (e.g.
// "C8R2WGQE" -> "C8R2-WGQE") — same normalization as
// apps/api/src/lib/crypto.ts's normalizeLinkCode, duplicated here since web
// never calls the API, it talks to the database directly.
function normalizeLinkCode(code: string): string {
  return /^[A-Z0-9]{8}$/.test(code) ? `${code.slice(0, 4)}-${code.slice(4)}` : code;
}

export async function linkServer(networkId: string, formData: FormData) {
  const session = await getServerSession(authOptions);
  const membership = session?.user.networks.find((network) => network.id === networkId);
  if (!membership || (membership.role !== "OWNER" && membership.role !== "ADMIN")) {
    throw new Error("Unauthorized");
  }

  const rawCode = formData.get("linkCode");
  if (typeof rawCode !== "string" || !rawCode.trim()) {
    throw new Error("A link code is required");
  }
  const linkCode = normalizeLinkCode(rawCode.trim().toUpperCase());

  // Conditioning the UPDATE itself on linkCode + expiry (rather than a
  // separate SELECT then UPDATE) makes this atomic, matching
  // apps/api/src/routes/v1/networks.ts's /servers/link route.
  const claimed = await db.transaction(async (tx) => {
    const [server] = await tx
      .update(servers)
      .set({ networkId, linkCode: null, linkCodeExpiresAt: null })
      .where(and(eq(servers.linkCode, linkCode), gt(servers.linkCodeExpiresAt, new Date())))
      .returning();

    if (!server) return null;

    await tx
      .insert(serverAccessGrants)
      .values({ userId: session!.user.id, serverUuid: server.serverUuid })
      .onConflictDoNothing();

    return server;
  });

  if (!claimed) {
    throw new Error("Invalid or expired link code");
  }

  revalidatePath("/");
}

export async function deleteNetwork(networkId: string) {
  const session = await getServerSession(authOptions);
  const membership = session?.user.networks.find((network) => network.id === networkId);
  if (!membership || membership.role !== "OWNER") {
    throw new Error("Unauthorized");
  }

  // servers.network_id is ON DELETE SET NULL and network_members.network_id
  // is ON DELETE CASCADE — deleting the network row alone orphans its
  // servers back to unclaimed and drops membership rows, same as the API's
  // DELETE /networks/:id route.
  await db.delete(networks).where(eq(networks.id, networkId));

  revalidatePath("/");
}
