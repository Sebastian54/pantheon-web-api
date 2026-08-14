import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { getVisibleServers } from "@/lib/visibility";
import { getActiveSessions } from "@/lib/analytics";
import { LivePlayersList } from "@/components/live-players-list";

export default async function LivePlayersPage() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/sign-in");
  }

  const visibleServers = await getVisibleServers(session.user.id, session.user.networks);
  const sessions = await getActiveSessions(visibleServers);

  return (
    <main className="mx-auto min-h-screen max-w-3xl space-y-6 p-8">
      <Link href="/analytics" className="text-sm text-muted-foreground hover:text-foreground">
        &larr; Analytics
      </Link>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Connected Now</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {sessions.length} player{sessions.length === 1 ? "" : "s"} online &bull; refreshes every 10s
        </p>
      </div>
      <LivePlayersList initialSessions={sessions} />
    </main>
  );
}
