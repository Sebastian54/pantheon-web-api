"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth/next";
import { and, eq } from "drizzle-orm";
import { db, userServers } from "@pantheon/db";
import { authOptions } from "@/lib/auth";

// Server Actions are reachable via direct POST regardless of which page
// rendered the form, so auth is re-checked here rather than trusted from
// the page-level redirect.
async function requireOwner() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "OWNER") {
    throw new Error("Unauthorized");
  }
  return session;
}

export async function grantServerAccess(userId: string, formData: FormData) {
  await requireOwner();

  const serverId = formData.get("serverId");
  if (typeof serverId !== "string" || !serverId) {
    throw new Error("A server must be selected");
  }

  await db.insert(userServers).values({ userId, serverId }).onConflictDoNothing();

  revalidatePath("/admin");
}

export async function revokeServerAccess(userId: string, serverId: string) {
  await requireOwner();

  await db
    .delete(userServers)
    .where(and(eq(userServers.userId, userId), eq(userServers.serverId, serverId)));

  revalidatePath("/admin");
}
