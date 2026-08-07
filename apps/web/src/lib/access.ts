import { db, servers, users } from "@pantheon/db";
import { eq } from "drizzle-orm";

export type AdminUserWithAccess = {
  id: string;
  name: string | null;
  email: string;
  grantedServers: { id: string; name: string }[];
};

/** OWNER-only view: every ADMIN user and which servers they've been granted. */
export async function getAdminUsersWithAccess(): Promise<AdminUserWithAccess[]> {
  const rows = await db.query.users.findMany({
    where: eq(users.role, "ADMIN"),
    orderBy: users.email,
    with: {
      userServers: {
        with: { server: { columns: { id: true, name: true } } },
      },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    grantedServers: row.userServers.map((userServer) => userServer.server),
  }));
}

export async function getAllServers() {
  return db.query.servers.findMany({
    columns: { id: true, name: true },
    orderBy: servers.name,
  });
}
