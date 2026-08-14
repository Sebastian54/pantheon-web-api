"use client";

import { FilterableList } from "@/components/filterable-list";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatIdentifier, formatRelativeTime } from "@/lib/format";
import type { GriefLoggerEntry, GriefLoggerKind } from "@/lib/moderation";

const KIND_LABELS: Record<GriefLoggerKind, string> = {
  blocks: "Blocks",
  items: "Items",
  containers: "Containers",
  chats: "Chat",
};

export function GriefLoggerList({ entries, kind }: { entries: GriefLoggerEntry[]; kind: GriefLoggerKind }) {
  return (
    <FilterableList
      items={entries}
      searchPlaceholder={`Search ${KIND_LABELS[kind].toLowerCase()}…`}
      searchPredicate={(entry, q) =>
        (entry.playerName?.toLowerCase().includes(q) ?? false) ||
        (entry.type?.toLowerCase().includes(q) ?? false) ||
        (entry.message?.toLowerCase().includes(q) ?? false)
      }
      keyFn={(entry) => entry.id}
      emptyTitle={`No ${KIND_LABELS[kind].toLowerCase()} events yet`}
      emptyMessage="Grief Logger events will show up here."
      renderItem={(entry) => (
        <Card className="glass-panel">
          <CardContent className="space-y-1 p-4">
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="flex items-center gap-2">
                <span className="font-medium">{entry.playerName ?? "Unknown"}</span>
                <Badge variant="outline">{entry.serverName}</Badge>
              </span>
              <span className="text-xs text-muted-foreground">{formatRelativeTime(entry.occurredAt)}</span>
            </div>
            {kind === "chats" ? (
              <p className="truncate text-xs text-muted-foreground">{entry.message}</p>
            ) : (
              <p className="truncate text-xs text-muted-foreground">
                {entry.action ? `${formatIdentifier(entry.action)} ` : ""}
                {entry.type ? formatIdentifier(entry.type) : ""}
                {entry.amount ? ` x${entry.amount}` : ""}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              {entry.world} ({entry.x}, {entry.y}, {entry.z})
            </p>
          </CardContent>
        </Card>
      )}
    />
  );
}
