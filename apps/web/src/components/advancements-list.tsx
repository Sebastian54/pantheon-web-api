"use client";

import { FilterableList } from "@/components/filterable-list";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatIdentifier, formatRelativeTime } from "@/lib/format";
import type { AdvancementEntry } from "@/lib/moderation";

export function AdvancementsList({ entries }: { entries: AdvancementEntry[] }) {
  return (
    <FilterableList
      items={entries}
      searchPlaceholder="Search player or advancement…"
      searchPredicate={(entry, q) =>
        entry.playerName.toLowerCase().includes(q) ||
        entry.advancement.toLowerCase().includes(q) ||
        (entry.title?.toLowerCase().includes(q) ?? false)
      }
      keyFn={(entry) => entry.id}
      emptyTitle="No advancements yet"
      emptyMessage="Player advancements will show up here."
      renderItem={(entry) => (
        <Card className="glass-panel">
          <CardContent className="flex items-center justify-between gap-3 p-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-sm">
                <span className="font-medium">{entry.playerName}</span>
                <Badge variant="outline">{entry.serverName}</Badge>
              </div>
              <p className="truncate text-xs text-muted-foreground">
                {entry.title ?? formatIdentifier(entry.advancement)}
              </p>
            </div>
            <span className="shrink-0 text-xs text-muted-foreground">{formatRelativeTime(entry.occurredAt)}</span>
          </CardContent>
        </Card>
      )}
    />
  );
}
