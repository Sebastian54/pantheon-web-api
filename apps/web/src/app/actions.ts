"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth/next";
import { db, networks, networkMembers } from "@pantheon/db";
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
