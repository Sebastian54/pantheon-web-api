import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { isServerOnline } from "@/lib/format";
import type { ServerSummary } from "@/lib/servers";

function capitalize(value: string) {
  return value.charAt(0) + value.slice(1).toLowerCase();
}

export function ServersList({ servers }: { servers: ServerSummary[] }) {
  if (servers.length === 0) {
    return (
      <Card className="glass-panel">
        <CardHeader>
          <CardTitle>No servers yet</CardTitle>
          <CardDescription>
            Register a Minecraft server via the API to see it here.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {servers.map((server) => {
        const online = isServerOnline(server.lastSeenAt);
        return (
          <Link key={server.id} href={`/servers/${server.id}`}>
            <Card className="glass-panel h-full transition-colors hover:bg-white/15 dark:hover:bg-white/10">
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="truncate">{server.name}</CardTitle>
                  <Badge variant={online ? "success" : "secondary"}>
                    {online ? "Online" : "Offline"}
                  </Badge>
                </div>
                <CardDescription>
                  {capitalize(server.loaderType)} &middot; {server.mcVersion}
                </CardDescription>
              </CardHeader>
              <CardContent className="text-sm">
                {online ? (
                  <p className="text-muted-foreground">
                    Players: {server.playerCount}/{server.maxPlayers} &bull; TPS:{" "}
                    {server.tps.toFixed(1)}
                  </p>
                ) : (
                  <p className="font-semibold text-destructive">Offline</p>
                )}
              </CardContent>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
