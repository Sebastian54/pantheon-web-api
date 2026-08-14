import { getServerSession } from "next-auth/next";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { getVisibleServers } from "@/lib/visibility";
import { getTardisDetail } from "@/lib/moderation";
import { formatIdentifier } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function TardisDetailPage({ params }: { params: Promise<{ uuid: string }> }) {
  const { uuid } = await params;
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/sign-in");
  }

  const visibleServers = await getVisibleServers(session.user.id, session.user.networks);
  const tardis = await getTardisDetail(uuid, visibleServers);
  if (!tardis) {
    notFound();
  }

  const fuelPercent =
    tardis.fuel !== null && tardis.maxFuel !== null && tardis.maxFuel > 0
      ? Math.min(100, Math.max(0, (tardis.fuel / tardis.maxFuel) * 100))
      : null;

  return (
    <main className="mx-auto min-h-screen max-w-3xl space-y-6 p-8">
      <Link href="/moderation/ait/fleet" className="text-sm text-muted-foreground hover:text-foreground">
        &larr; TARDIS Fleet
      </Link>

      <Card className="glass-panel">
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="truncate">{tardis.name ?? "Unnamed TARDIS"}</CardTitle>
            <Badge variant="outline">{tardis.serverName}</Badge>
          </div>
          <CardDescription>{tardis.owner ?? "Unknown owner"}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {tardis.powered !== null && (
              <Badge variant={tardis.powered ? "success" : "secondary"}>{tardis.powered ? "Powered" : "Unpowered"}</Badge>
            )}
            {tardis.locked !== null && <Badge variant={tardis.locked ? "destructive" : "secondary"}>{tardis.locked ? "Locked" : "Unlocked"}</Badge>}
            {tardis.travelState && <Badge variant="outline">{formatIdentifier(tardis.travelState)}</Badge>}
            {tardis.doorState && <Badge variant="outline">{formatIdentifier(tardis.doorState)} Door</Badge>}
          </div>

          {fuelPercent !== null && (
            <div>
              <p className="mb-1 text-xs text-muted-foreground">
                Fuel: {Math.round(tardis.fuel!)}/{Math.round(tardis.maxFuel!)}
              </p>
              <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                <div className="h-full rounded-full bg-primary" style={{ width: `${fuelPercent}%` }} />
              </div>
            </div>
          )}

          {(tardis.dimension || tardis.x !== null) && (
            <p className="text-xs text-muted-foreground">
              {tardis.dimension ? formatIdentifier(tardis.dimension) : "Unknown dimension"}
              {tardis.x !== null && tardis.y !== null && tardis.z !== null
                ? ` (${tardis.x}, ${tardis.y}, ${tardis.z})`
                : ""}
            </p>
          )}
        </CardContent>
      </Card>

      {tardis.crew.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-medium">Crew</h2>
          <div className="space-y-2">
            {tardis.crew.map((member, index) => (
              <Card key={member.uuid || index} className="glass-panel">
                <CardContent className="p-4 text-sm">
                  {member.name ?? (member.uuid ? `Player ${member.uuid.slice(0, 8)}` : "Unknown crew member")}
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {tardis.subsystems.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-medium">Subsystems</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {tardis.subsystems.map((subsystem) => (
              <Card key={subsystem.name} className="glass-panel">
                <CardContent className="flex items-center justify-between p-4 text-sm">
                  <span>{formatIdentifier(subsystem.name)}</span>
                  <Badge variant={subsystem.enabled ? "success" : "secondary"}>
                    {!subsystem.fitted ? "Not Fitted" : subsystem.enabled ? "Enabled" : "Disabled"}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
