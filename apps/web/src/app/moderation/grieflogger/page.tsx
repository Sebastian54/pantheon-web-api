import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { getVisibleServers } from "@/lib/visibility";
import { getGriefLoggerEvents } from "@/lib/moderation";
import type { GriefLoggerKind } from "@/lib/moderation";
import { GriefLoggerList } from "@/components/grief-logger-list";

const KINDS: { value: GriefLoggerKind; label: string }[] = [
  { value: "blocks", label: "Blocks" },
  { value: "items", label: "Items" },
  { value: "containers", label: "Containers" },
  { value: "chats", label: "Chat" },
];

function isKind(value: string | undefined): value is GriefLoggerKind {
  return KINDS.some((kind) => kind.value === value);
}

export default async function GriefLoggerPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/sign-in");
  }

  const { kind: rawKind } = await searchParams;
  const kind: GriefLoggerKind = isKind(rawKind) ? rawKind : "blocks";

  const visibleServers = await getVisibleServers(session.user.id, session.user.networks);
  const entries = await getGriefLoggerEvents(visibleServers, kind);

  return (
    <main className="mx-auto min-h-screen max-w-3xl space-y-6 p-8">
      <div>
        <Link href="/moderation" className="text-sm text-muted-foreground hover:text-foreground">
          &larr; Moderation
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Grief Logger</h1>
      </div>
      <div className="flex flex-wrap gap-1">
        {KINDS.map((option) => (
          <Link
            key={option.value}
            href={`/moderation/grieflogger?kind=${option.value}`}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              kind === option.value
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
            }`}
          >
            {option.label}
          </Link>
        ))}
      </div>
      <GriefLoggerList entries={entries} kind={kind} />
    </main>
  );
}
