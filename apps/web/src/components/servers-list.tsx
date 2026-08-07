import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ServerSummary } from "@/lib/servers";

function formatLastSeen(lastSeenAt: Date | null) {
  if (!lastSeenAt) return "Never";

  const minutes = Math.floor((Date.now() - lastSeenAt.getTime()) / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
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
      {servers.map((server) => (
        <Card key={server.id} className="glass-panel">
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="truncate">{server.name}</CardTitle>
              <Badge variant={server.isActive ? "success" : "secondary"}>
                {server.isActive ? "Active" : "Inactive"}
              </Badge>
            </div>
            <CardDescription>
              {server.loaderType} &middot; {server.mcVersion}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-1 text-sm text-muted-foreground">
            <p>Last seen: {formatLastSeen(server.lastSeenAt)}</p>
            <p className="truncate font-mono text-xs">{server.serverUuid}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
