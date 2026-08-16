import { db, servers, networkMembers } from "@pantheon/db";
import { desc, eq, isNull } from "drizzle-orm";

export type NetworkMemberWithAccess = {
  id: string;
  name: string | null;
  email: string;
  accountId: string;
  role: "OWNER" | "ADMIN" | "MODERATOR";
  grantedServers: { id: string; name: string; serverUuid: string }[];
};

export type UnclaimedServer = {
  id: string;
  name: string;
  serverUuid: string;
  loaderType: string;
  mcVersion: string;
};

/**
 * Every member of a network, plus which of that network's servers they've
 * been granted — grants only actually matter for MODERATOR role (OWNER/ADMIN
 * already get unconditional full server visibility elsewhere, regardless of
 * server_access_grants), so grantedServers is only meaningful to *show* for
 * MODERATOR members, but returned for everyone for a uniform shape.
 */
export async function getNetworkMembersWithAccess(networkId: string): Promise<NetworkMemberWithAccess[]> {
  const members = await db.query.networkMembers.findMany({
    where: eq(networkMembers.networkId, networkId),
    with: {
      user: {
        with: {
          serverAccessGrants: {
            with: { server: { columns: { id: true, name: true, serverUuid: true, networkId: true } } },
          },
        },
      },
    },
  });

  return members.map((member) => ({
    id: member.user.id,
    name: member.user.name,
    email: member.user.email,
    accountId: member.user.accountId,
    role: member.role,
    grantedServers: member.user.serverAccessGrants
      .filter((grant) => grant.server.networkId === networkId)
      .map((grant) => ({ id: grant.server.id, name: grant.server.name, serverUuid: grant.server.serverUuid })),
  }));
}

export async function getServersForNetwork(networkId: string) {
  return db.query.servers.findMany({
    where: eq(servers.networkId, networkId),
    columns: { id: true, name: true, serverUuid: true },
    orderBy: servers.name,
  });
}

/** Servers that registered via the public handshake but haven't been claimed into a network yet. */
export async function getUnclaimedServers(): Promise<UnclaimedServer[]> {
  return db.query.servers.findMany({
    where: isNull(servers.networkId),
    columns: { id: true, name: true, serverUuid: true, loaderType: true, mcVersion: true },
    orderBy: desc(servers.createdAt),
  });
}
