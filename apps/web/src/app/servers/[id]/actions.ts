"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth/next";
import { eq } from "drizzle-orm";
import { db, servers } from "@pantheon/db";
import { authOptions } from "@/lib/auth";

export async function renameServer(serverId: string, networkId: string, formData: FormData) {
  const session = await getServerSession(authOptions);
  const membership = session?.user.networks.find((network) => network.id === networkId);
  if (!membership || (membership.role !== "OWNER" && membership.role !== "ADMIN")) {
    throw new Error("Unauthorized");
  }

  const name = formData.get("name");
  if (typeof name !== "string" || !name.trim()) {
    throw new Error("A server name is required");
  }

  await db
    .update(servers)
    .set({ name: name.trim() })
    .where(eq(servers.id, serverId));

  revalidatePath(`/servers/${serverId}`);
  revalidatePath("/");
}
