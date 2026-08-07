import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getAdminUsersWithAccess, getAllServers } from "@/lib/access";
import { grantServerAccess, revokeServerAccess } from "./actions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default async function AdminAccessPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/sign-in");
  }
  if (session.user.role !== "OWNER") {
    redirect("/");
  }

  const [adminUsers, allServers] = await Promise.all([
    getAdminUsersWithAccess(),
    getAllServers(),
  ]);

  return (
    <main className="mx-auto min-h-screen max-w-4xl space-y-8 p-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Manage Access</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Grant ADMIN users access to specific servers.
        </p>
      </header>

      {adminUsers.length === 0 ? (
        <Card className="glass-panel">
          <CardHeader>
            <CardTitle>No ADMIN users yet</CardTitle>
            <CardDescription>Users appear here once they sign in with Discord.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="space-y-4">
          {adminUsers.map((user) => {
            const grantedIds = new Set(user.grantedServers.map((server) => server.id));
            const availableServers = allServers.filter((server) => !grantedIds.has(server.id));

            return (
              <Card key={user.id} className="glass-panel">
                <CardHeader>
                  <CardTitle>{user.name ?? user.email}</CardTitle>
                  <CardDescription>{user.email}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    {user.grantedServers.length === 0 ? (
                      <span className="text-sm text-muted-foreground">No servers granted</span>
                    ) : (
                      user.grantedServers.map((server) => (
                        <form
                          key={server.id}
                          action={revokeServerAccess.bind(null, user.id, server.id)}
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
                      ))
                    )}
                  </div>

                  {availableServers.length > 0 && (
                    <form
                      action={grantServerAccess.bind(null, user.id)}
                      className="flex items-center gap-2"
                    >
                      <select
                        name="serverId"
                        required
                        defaultValue=""
                        className="h-9 rounded-full border border-input bg-background px-3 text-sm text-foreground"
                      >
                        <option value="" disabled>
                          Select a server&hellip;
                        </option>
                        {availableServers.map((server) => (
                          <option key={server.id} value={server.id}>
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
    </main>
  );
}
