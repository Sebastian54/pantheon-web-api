import { getServerSession } from "next-auth/next";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { getServerForUser } from "@/lib/servers";
import { isServerOnline, hasCapability, MOD_CAPABILITIES } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RenameServerForm } from "@/components/rename-server-form";
import { SparkMetricsGrid, hasAnySparkMetric } from "@/components/spark-metrics-grid";

function capitalize(value: string) {
  return value.charAt(0) + value.slice(1).toLowerCase();
}

export default async function ServerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/sign-in");
  }

  const server = await getServerForUser(id, session.user.id, session.user.networks);
  if (!server) {
    notFound();
  }

  const online = isServerOnline(server.lastSeenAt);
  const hasSpark = hasCapability(server.installedMods, MOD_CAPABILITIES.spark);
  const hasCarpet = hasCapability(server.installedMods, MOD_CAPABILITIES.carpet);
  const canManage =
    server.networkId != null &&
    session.user.networks.some(
      (network) => network.id === server.networkId && (network.role === "OWNER" || network.role === "ADMIN"),
    );

  const sparkMetrics = {
    tps10s: server.tps10s,
    mspt10s: server.mspt10s,
    cpuProcess10s: server.cpuProcess10s,
    cpuSystem10s: server.cpuSystem10s,
  };

  return (
    <main className="mx-auto min-h-screen max-w-3xl space-y-6 p-8">
      <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
        &larr; Servers
      </Link>

      <Card className="glass-panel">
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="truncate">{server.name}</CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant={online ? "success" : "secondary"}>{online ? "Online" : "Offline"}</Badge>
              {canManage && (
                <RenameServerForm serverId={server.id} networkId={server.networkId!} currentName={server.name} />
              )}
            </div>
          </div>
          <CardDescription>
            {capitalize(server.loaderType)} &middot; {server.mcVersion}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {online ? (
            <p className="text-sm text-muted-foreground">
              Players: {server.playerCount}/{server.maxPlayers} &bull; TPS: {server.tps.toFixed(1)}
            </p>
          ) : (
            <p className="text-sm font-semibold text-destructive">Offline</p>
          )}
        </CardContent>
      </Card>

      {hasSpark && hasAnySparkMetric(sparkMetrics) && (
        <section className="space-y-3">
          <h2 className="text-lg font-medium">Spark</h2>
          <SparkMetricsGrid metrics={sparkMetrics} />
        </section>
      )}

      {hasCarpet && server.hostileMobcapOverworld !== null && (
        <section className="space-y-3">
          <h2 className="text-lg font-medium">Carpet</h2>
          <div className="glass-panel w-fit rounded-xl p-3">
            <p className="text-xs text-muted-foreground">Hostile Mobcap (Overworld)</p>
            <p className="text-lg font-semibold">{server.hostileMobcapOverworld}</p>
          </div>
        </section>
      )}
    </main>
  );
}
