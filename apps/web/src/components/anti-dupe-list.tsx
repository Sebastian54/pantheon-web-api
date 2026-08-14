"use client";

import { FilterableList } from "@/components/filterable-list";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatRelativeTime } from "@/lib/format";
import type { AntiDupeFlag } from "@/lib/moderation";

export function AntiDupeList({ flags }: { flags: AntiDupeFlag[] }) {
  return (
    <FilterableList
      items={flags}
      searchPlaceholder="Search actor…"
      searchPredicate={(flag, q) => flag.actor.toLowerCase().includes(q)}
      filters={[
        { label: "All", predicate: () => true },
        { label: "Flagged", predicate: (flag) => flag.creative },
      ]}
      keyFn={(flag) => flag.tardisUuid}
      emptyTitle="No anti-dupe events yet"
      emptyMessage="TARDIS creative-mode flags will show up here."
      renderItem={(flag) => (
        <Card className="glass-panel">
          <CardContent className="flex items-center justify-between gap-3 p-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-sm">
                <span className="font-mono text-xs">{flag.tardisUuid.slice(0, 8)}</span>
                {flag.creative && <Badge variant="destructive">Creative</Badge>}
              </div>
              <p className="truncate text-xs text-muted-foreground">by {flag.actor}</p>
            </div>
            <span className="shrink-0 text-xs text-muted-foreground">{formatRelativeTime(flag.since)}</span>
          </CardContent>
        </Card>
      )}
    />
  );
}
