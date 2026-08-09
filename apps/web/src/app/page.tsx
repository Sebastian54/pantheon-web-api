import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { getServersForUser } from "@/lib/servers";
import { createNetwork } from "./actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SignOutButton } from "@/components/sign-out-button";
import { ServersList } from "@/components/servers-list";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/sign-in");
  }

  if (session.user.networks.length === 0) {
    return (
      <main className="flex min-h-screen items-center justify-center p-8">
        <Card className="glass-panel w-full max-w-sm text-center">
          <CardHeader>
            <CardTitle>Create your network</CardTitle>
            <CardDescription>
              You&rsquo;re not a member of any network yet. Create one to get started.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={createNetwork} className="flex flex-col gap-3">
              <input
                name="name"
                placeholder="Network name"
                required
                className="h-9 rounded-full border border-input bg-background px-3 text-sm text-foreground"
              />
              <Button type="submit" variant="glass" className="w-full">
                Create network
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    );
  }

  const canManageAccess = session.user.networks.some(
    (network) => network.role === "OWNER" || network.role === "ADMIN",
  );
  const servers = await getServersForUser(session.user.id, session.user.networks);

  return (
    <main className="mx-auto min-h-screen max-w-6xl space-y-8 p-8">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Welcome, {session.user.name}
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {session.user.networks.map((network) => (
              <Badge key={network.id} variant="outline">
                {network.name}: {network.role}
              </Badge>
            ))}
            <span className="text-sm text-muted-foreground">
              {servers.length} server{servers.length === 1 ? "" : "s"}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canManageAccess && (
            <Button asChild variant="glass">
              <Link href="/admin">Manage Access</Link>
            </Button>
          )}
          <SignOutButton />
        </div>
      </header>

      <section>
        <h2 className="mb-4 text-lg font-medium">Servers</h2>
        <ServersList servers={servers} />
      </section>
    </main>
  );
}
