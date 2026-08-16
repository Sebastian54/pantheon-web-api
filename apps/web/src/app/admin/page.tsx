import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getNetworkMembersWithAccess, getServersForNetwork, getUnclaimedServers } from "@/lib/access";
import { formatAccountId } from "@/lib/account-id-format";
import { claimServer, addNetworkMember } from "./actions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EditPermissionsModal } from "@/components/edit-permissions-modal";

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
          Claim servers into your network, add members by Account ID, and grant them access to specific servers.
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

            <Card className="glass-panel">
              <CardHeader>
                <CardTitle>Add member</CardTitle>
                <CardDescription>Add someone to this network by their 8-digit Account ID.</CardDescription>
              </CardHeader>
              <CardContent>
                <form action={addNetworkMember.bind(null, network.id)} className="flex items-center gap-2">
                  <Input name="accountId" placeholder="1234-5678" required className="max-w-[160px]" />
                  <Button type="submit" variant="secondary" size="sm">
                    Add
                  </Button>
                </form>
              </CardContent>
            </Card>

            <div className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground">Members</h3>
              {members.length === 0 ? (
                <Card className="glass-panel">
                  <CardHeader>
                    <CardTitle>No members yet</CardTitle>
                    <CardDescription>Members added to this network appear here.</CardDescription>
                  </CardHeader>
                </Card>
              ) : (
                <div className="space-y-2">
                  {members.map((member) => (
                    <Card key={member.id} className="glass-panel">
                      <CardContent className="flex items-center justify-between gap-3 p-4">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{member.name ?? member.email}</span>
                            <Badge variant="outline">{member.role}</Badge>
                          </div>
                          <p className="font-mono text-xs text-muted-foreground">
                            {formatAccountId(member.accountId)}
                          </p>
                        </div>
                        {member.role === "MODERATOR" && (
                          <EditPermissionsModal
                            networkId={network.id}
                            userId={member.id}
                            memberName={member.name ?? member.email}
                            networkServers={networkServers}
                            grantedServerUuids={member.grantedServers.map((server) => server.serverUuid)}
                          />
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </section>
        );
      })}
    </main>
  );
}
