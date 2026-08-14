"use client";

import Link from "next/link";
import { FilterableList } from "@/components/filterable-list";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatIdentifier } from "@/lib/format";
import type { TardisSummary } from "@/lib/moderation";

export function TardisFleetList({ tardises }: { tardises: TardisSummary[] }) {
  return (
    <FilterableList
      items={tardises}
      searchPlaceholder="Search name or owner…"
      searchPredicate={(tardis, q) =>
        (tardis.name?.toLowerCase().includes(q) ?? false) || (tardis.owner?.toLowerCase().includes(q) ?? false)
      }
      keyFn={(tardis) => tardis.uuid}
      emptyTitle="No TARDISes yet"
      emptyMessage="Player TARDISes will show up here."
      renderItem={(tardis) => (
        <Link href={`/moderation/ait/fleet/${tardis.uuid}`}>
          <Card className="glass-panel transition-colors hover:bg-white/10">
            <CardContent className="flex items-center justify-between gap-3 p-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium">{tardis.name ?? "Unnamed TARDIS"}</span>
                  <Badge variant="outline">{tardis.serverName}</Badge>
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  {tardis.owner ?? "Unknown owner"}
                  {tardis.crewCount > 0 ? ` • ${tardis.crewCount} crew` : ""}
                </p>
              </div>
              <div className="shrink-0 text-right text-xs text-muted-foreground">
                {tardis.travelState && <p>{formatIdentifier(tardis.travelState)}</p>}
                {tardis.fuel !== null && tardis.maxFuel !== null && (
                  <p>
                    {Math.round(tardis.fuel)}/{Math.round(tardis.maxFuel)} fuel
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </Link>
      )}
    />
  );
}
