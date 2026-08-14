import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { getServersForUser } from "@/lib/servers";
import { hasCapability, MOD_CAPABILITIES } from "@/lib/format";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function HubLink({ href, title, description }: { href: string; title: string; description: string }) {
  return (
    <Link href={href}>
      <Card className="glass-panel transition-colors hover:bg-white/15 dark:hover:bg-white/10">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
      </Card>
    </Link>
  );
}

export default async function ModerationPage() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/sign-in");
  }

  const servers = await getServersForUser(session.user.id, session.user.networks);
  const hasLedger = servers.some((server) => hasCapability(server.installedMods, MOD_CAPABILITIES.ledger));
  const hasAit = servers.some((server) => hasCapability(server.installedMods, MOD_CAPABILITIES.ait));
  const hasAitLog = servers.some((server) => hasCapability(server.installedMods, MOD_CAPABILITIES.aitLog));
  const hasAntidupe = servers.some((server) => hasCapability(server.installedMods, MOD_CAPABILITIES.antidupe));
  const hasAitSection = hasAit || hasAitLog || hasAntidupe;

  return (
    <main className="mx-auto min-h-screen max-w-3xl space-y-8 p-8">
      <div>
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
          &larr; Servers
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Moderation</h1>
      </div>

      <section className="space-y-3">
        <div className="grid gap-4 sm:grid-cols-2">
          <HubLink href="/moderation/command-spy" title="Command Spy" description="Executed commands across your servers" />
          {hasLedger && (
            <HubLink href="/moderation/ledger" title="Ledger" description="Block and grief changes, with rollbacks" />
          )}
          <HubLink href="/moderation/advancements" title="Advancements" description="Player advancements as they unlock" />
          <HubLink href="/moderation/grieflogger" title="Grief Logger" description="Blocks, items, containers, and chat" />
        </div>
      </section>

      {hasAitSection && (
        <section className="space-y-3">
          <h2 className="text-lg font-medium">Adventures in Time</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {hasAit && (
              <HubLink href="/moderation/ait/fleet" title="TARDIS Fleet" description="Every TARDIS across your servers" />
            )}
            {hasAitLog && (
              <HubLink href="/moderation/ait/log" title="Console Log" description="TARDIS console activity" />
            )}
            {hasAntidupe && (
              <HubLink href="/moderation/ait/antidupe" title="Anti-Dupe" description="Flagged creative-mode TARDISes" />
            )}
          </div>
        </section>
      )}
    </main>
  );
}
