import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { getServersForUser } from "@/lib/servers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SignOutButton } from "@/components/sign-out-button";
import { ServersList } from "@/components/servers-list";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/sign-in");
  }

  const servers = await getServersForUser(session.user.id, session.user.role);

  return (
    <main className="mx-auto min-h-screen max-w-6xl space-y-8 p-8">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Welcome, {session.user.name}
          </h1>
          <div className="mt-1 flex items-center gap-2">
            <Badge variant="outline">{session.user.role}</Badge>
            <span className="text-sm text-muted-foreground">
              {servers.length} server{servers.length === 1 ? "" : "s"}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {session.user.role === "OWNER" && (
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
