import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { getVisibleServers } from "@/lib/visibility";
import { getLedgerLogs } from "@/lib/moderation";
import { LedgerList } from "@/components/ledger-list";

export default async function LedgerPage() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/sign-in");
  }

  const visibleServers = await getVisibleServers(session.user.id, session.user.networks);
  const entries = await getLedgerLogs(visibleServers);

  return (
    <main className="mx-auto min-h-screen max-w-3xl space-y-6 p-8">
      <div>
        <Link href="/moderation" className="text-sm text-muted-foreground hover:text-foreground">
          &larr; Moderation
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Ledger</h1>
      </div>
      <LedgerList entries={entries} />
    </main>
  );
}
