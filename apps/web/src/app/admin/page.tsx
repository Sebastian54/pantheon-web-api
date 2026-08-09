import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getNetworkMembersWithAccess, getServersForNetwork, getUnclaimedServers } from "@/lib/access";
import { claimServer, grantServerAccess, revokeServerAccess } from "./actions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default async function AdminAccessPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/sign-in");
  }

  const managedNetworks = session.user.networks.filter(
    (network) => network.role === "OWNER" || network.role === "ADMIN",
  );
  if (managedNetworks.length === 0) {
    redirect("/");
  }

  const unclaimedServers = await getUnclaimedServers();

  const networksWithData = await Promise.all(
    managedNetworks.map(async (network) => {
      const [members, networkServers] = await Promise.all([
        getNetworkMembersWithAccess(network.id),
        getServersForNetwork(network.id),
      ]);
      return { ...network, members, networkServers };
    }),
  );

  return (
    <main className="mx-auto min-h-screen max-w-4xl space-y-12 p-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Manage Access</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Claim servers into your network and grant members access to specific servers.
        </p>
      </header>

      {networksWithData.map(({ members, networkServers, ...network }) => {
        return (
          <section key={network.id} className="space-y-4">
            <h2 className="text-lg font-medium">
              {network.name} <span className="text-sm text-muted-foreground">({network.role})</span>
            </h2>

            {unclaimedServers.length > 0 && (
              <Card className="glass-panel">
                <CardHeader>
                  <CardTitle>Unclaimed servers</CardTitle>
                  <CardDescription>
                    Registered via the handshake but not yet claimed into a network.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  {unclaimedServers.map((server) => (
                    <form key={server.id} action={claimServer.bind(null, network.id, server.id)}>
                      <Button type="submit" variant="secondary" size="sm">
                        Claim {server.name}
                      </Button>
                    </form>
                  ))}
                </CardContent>
              </Card>
            )}

            {members.length === 0 ? (
              <Card className="glass-panel">
                <CardHeader>
                  <CardTitle>No MODERATOR members yet</CardTitle>
                  <CardDescription>Members with the MODERATOR role appear here.</CardDescription>
                </CardHeader>
              </Card>
            ) : (
              <div className="space-y-4">
                {members.map((member) => {
                  const grantedIds = new Set(member.grantedServers.map((server) => server.id));
                  const availableServers = networkServers.filter((server) => !grantedIds.has(server.id));

                  return (
                    <Card key={member.id} className="glass-panel">
                      <CardHeader>
                        <CardTitle>{member.name ?? member.email}</CardTitle>
                        <CardDescription>{member.email}</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="flex flex-wrap gap-2">
                          {member.grantedServers.length === 0 ? (
                            <span className="text-sm text-muted-foreground">No servers granted</span>
                          ) : (
                            member.grantedServers.map((server) => {
                              const networkServer = networkServers.find((s) => s.id === server.id);
                              if (!networkServer) return null;
                              return (
                                <form
                                  key={server.id}
                                  action={revokeServerAccess.bind(
                                    null,
                                    network.id,
                                    member.id,
                                    networkServer.serverUuid,
                                  )}
                                >
                                  <button
                                    type="submit"
                                    aria-label={`Revoke access to ${server.name}`}
                                    className="group"
                                  >
                                    <Badge
                                      variant="secondary"
                                      className="cursor-pointer group-hover:bg-destructive/20 group-hover:text-destructive"
                                    >
                                      {server.name} &times;
                                    </Badge>
                                  </button>
                                </form>
                              );
                            })
                          )}
                        </div>

                        {availableServers.length > 0 && (
                          <form
                            action={grantServerAccess.bind(null, network.id, member.id)}
                            className="flex items-center gap-2"
                          >
                            <select
                              name="serverUuid"
                              required
                              defaultValue=""
                              className="h-9 rounded-full border border-input bg-background px-3 text-sm text-foreground"
                            >
                              <option value="" disabled>
                                Select a server&hellip;
                              </option>
                              {availableServers.map((server) => (
                                <option key={server.id} value={server.serverUuid}>
                                  {server.name}
                                </option>
                              ))}
                            </select>
                            <Button type="submit" variant="secondary" size="sm">
                              Grant access
                            </Button>
                          </form>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}
    </main>
  );
}
