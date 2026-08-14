import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { getServersForUser } from "@/lib/servers";
import { getVisibleServers } from "@/lib/visibility";
import { getPlaytimeLeaderboard, getPlayerDemographics } from "@/lib/analytics";
import type { LeaderboardEntry, CountryCount } from "@/lib/analytics";
import { isServerOnline, hasCapability, MOD_CAPABILITIES } from "@/lib/format";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SparkMetricsGrid } from "@/components/spark-metrics-grid";
import { HealthMetricsCard } from "@/components/health-metrics-card";
import { PlaytimeLeaderboard } from "@/components/playtime-leaderboard";
import { PlayerDemographics } from "@/components/player-demographics";

export default async function AnalyticsPage() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/sign-in");
  }

  const servers = await getServersForUser(session.user.id, session.user.networks);
  const onlineServers = servers.filter((server) => isServerOnline(server.lastSeenAt));
  const totalPlayers = onlineServers.reduce((sum, server) => sum + server.playerCount, 0);

  const sparkOnlineServers = onlineServers.filter(
    (server) => hasCapability(server.installedMods, MOD_CAPABILITIES.spark) && server.tps10s !== null,
  );
  const averageTps =
    sparkOnlineServers.length > 0
      ? sparkOnlineServers.reduce((sum, server) => sum + (server.tps10s ?? 0), 0) / sparkOnlineServers.length
      : null;

  // Health Report is never mod-gated — memory/disk reporting isn't tied to a specific mod's presence.
  const healthServers = onlineServers.filter(
    (server) => server.memoryUsedMb !== null || server.diskUsedGb !== null,
  );

  const hasPlanServer = servers.some((server) => hasCapability(server.installedMods, MOD_CAPABILITIES.plan));
  let leaderboard: LeaderboardEntry[] = [];
  let demographics: CountryCount[] = [];
  if (hasPlanServer) {
    const visibleServers = await getVisibleServers(session.user.id, session.user.networks);
    const serverUuids = visibleServers.map((server) => server.serverUuid);
    [leaderboard, demographics] = await Promise.all([
      getPlaytimeLeaderboard(serverUuids),
      getPlayerDemographics(serverUuids),
    ]);
  }

  return (
    <main className="mx-auto min-h-screen max-w-4xl space-y-8 p-8">
      <div>
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
          &larr; Servers
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Analytics</h1>
      </div>

      <Link href="/analytics/players">
        <Card className="glass-panel transition-colors hover:bg-white/15 dark:hover:bg-white/10">
          <CardHeader>
            <CardTitle>Live Players</CardTitle>
            <CardDescription>
              {totalPlayers} online across {onlineServers.length} server{onlineServers.length === 1 ? "" : "s"}
            </CardDescription>
          </CardHeader>
        </Card>
      </Link>

      {averageTps !== null && (
        <section className="space-y-3">
          <h2 className="text-lg font-medium">Average TPS</h2>
          <Card className="glass-panel">
            <CardHeader>
              <CardTitle className="text-3xl">{averageTps.toFixed(1)}</CardTitle>
              <CardDescription>
                Network-wide average across {sparkOnlineServers.length} Spark server
                {sparkOnlineServers.length === 1 ? "" : "s"}
              </CardDescription>
            </CardHeader>
          </Card>
          <div className="space-y-3">
            {sparkOnlineServers.map((server) => (
              <div key={server.id}>
                <p className="mb-2 text-sm font-medium">{server.name}</p>
                <SparkMetricsGrid
                  metrics={{
                    tps10s: server.tps10s,
                    mspt10s: server.mspt10s,
                    cpuProcess10s: server.cpuProcess10s,
                    cpuSystem10s: server.cpuSystem10s,
                  }}
                />
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Health Report</h2>
        {healthServers.length === 0 ? (
          <Card className="glass-panel">
            <CardHeader>
              <CardTitle>No health data yet</CardTitle>
              <CardDescription>Servers reporting memory/disk usage will show up here.</CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {healthServers.map((server) => (
              <HealthMetricsCard
                key={server.id}
                name={server.name}
                memoryUsedMb={server.memoryUsedMb}
                memoryTotalMb={server.memoryTotalMb}
                diskUsedGb={server.diskUsedGb}
                diskTotalGb={server.diskTotalGb}
              />
            ))}
          </div>
        )}
      </section>

      {hasPlanServer && (
        <>
          <section className="space-y-3">
            <h2 className="text-lg font-medium">Playtime Leaderboard</h2>
            <PlaytimeLeaderboard entries={leaderboard} />
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-medium">Top Regions</h2>
            <PlayerDemographics entries={demographics} />
          </section>
        </>
      )}
    </main>
  );
}
