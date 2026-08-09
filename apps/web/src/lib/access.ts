import { db, servers, networkMembers } from "@pantheon/db";
import { and, desc, eq, isNull } from "drizzle-orm";

export type NetworkMemberWithAccess = {
  id: string;
  name: string | null;
  email: string;
  grantedServers: { id: string; name: string }[];
};

export type UnclaimedServer = {
  id: string;
  name: string;
  serverUuid: string;
  loaderType: string;
  mcVersion: string;
};

/** MODERATOR members of a network and which of that network's servers they've been granted. */
export async function getNetworkMembersWithAccess(networkId: string): Promise<NetworkMemberWithAccess[]> {
  const members = await db.query.networkMembers.findMany({
    where: and(eq(networkMembers.networkId, networkId), eq(networkMembers.role, "MODERATOR")),
    with: {
      user: {
        with: {
          serverAccessGrants: {
            with: { server: { columns: { id: true, name: true, networkId: true } } },
          },
        },
      },
    },
  });

  return members.map((member) => ({
    id: member.user.id,
    name: member.user.name,
    email: member.user.email,
    grantedServers: member.user.serverAccessGrants
      .filter((grant) => grant.server.networkId === networkId)
      .map((grant) => ({ id: grant.server.id, name: grant.server.name })),
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
