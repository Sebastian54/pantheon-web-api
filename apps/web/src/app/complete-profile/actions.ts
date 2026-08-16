"use server";

import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { eq } from "drizzle-orm";
import { db, users } from "@pantheon/db";
import { authOptions } from "@/lib/auth";

export async function completeProfile(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session) {
    throw new Error("Unauthorized");
  }

  const name = formData.get("name");
  if (typeof name !== "string" || !name.trim()) {
    throw new Error("A display name is required");
  }

  await db.update(users).set({ name: name.trim() }).where(eq(users.id, session.user.id));

  redirect("/");
}
