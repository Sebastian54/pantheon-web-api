"use client";

import { FilterableList } from "@/components/filterable-list";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatIdentifier, formatRelativeTime } from "@/lib/format";
import type { AitLogEntry } from "@/lib/moderation";

export function AitLogList({ entries }: { entries: AitLogEntry[] }) {
  return (
    <FilterableList
      items={entries}
      searchPlaceholder="Search player or action…"
      searchPredicate={(entry, q) =>
        entry.playerName.toLowerCase().includes(q) ||
        entry.action.toLowerCase().includes(q) ||
        entry.category.toLowerCase().includes(q)
      }
      keyFn={(entry) => entry.id}
      emptyTitle="No AIT events yet"
      emptyMessage="TARDIS console log events will show up here."
      renderItem={(entry) => (
        <Card className="glass-panel">
          <CardContent className="space-y-1 p-4">
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="flex items-center gap-2">
                <span className="font-medium">{entry.playerName}</span>
                <Badge variant="outline">{entry.serverName}</Badge>
              </span>
              <span className="text-xs text-muted-foreground">{formatRelativeTime(entry.occurredAt)}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {formatIdentifier(entry.category)} &bull; {formatIdentifier(entry.action)}
              {entry.result ? ` (${entry.result})` : ""}
            </p>
            {(entry.fromDim || entry.toDim) && (
              <p className="text-xs text-muted-foreground">
                {entry.fromDim ? formatIdentifier(entry.fromDim) : "?"} &rarr; {entry.toDim ? formatIdentifier(entry.toDim) : "?"}
              </p>
            )}
          </CardContent>
        </Card>
      )}
    />
  );
}
