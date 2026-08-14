"use client";

import { useMemo, useState } from "react";
import { FilterableList } from "@/components/filterable-list";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatRelativeTime } from "@/lib/format";
import type { CommandSpyEntry } from "@/lib/moderation";

export function CommandSpyList({ entries }: { entries: CommandSpyEntry[] }) {
  const serverNames = useMemo(() => [...new Set(entries.map((entry) => entry.serverName))], [entries]);
  const [selectedServer, setSelectedServer] = useState<string | null>(null);

  const scoped = selectedServer ? entries.filter((entry) => entry.serverName === selectedServer) : entries;

  return (
    <div className="space-y-3">
      {serverNames.length > 1 && (
        <div className="flex flex-wrap gap-1">
          <button
            type="button"
            onClick={() => setSelectedServer(null)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              !selectedServer ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
            }`}
          >
            All servers
          </button>
          {serverNames.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => setSelectedServer(name)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                selectedServer === name
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
              }`}
            >
              {name}
            </button>
          ))}
        </div>
      )}
      <FilterableList
        items={scoped}
        searchPlaceholder="Search executor or command…"
        searchPredicate={(entry, q) =>
          entry.executor.toLowerCase().includes(q) || entry.command.toLowerCase().includes(q)
        }
        filters={[
          { label: "All", predicate: () => true },
          { label: "Players", predicate: (entry) => entry.executorUuid !== null },
          { label: "Console", predicate: (entry) => entry.executorUuid === null },
        ]}
        keyFn={(entry) => entry.id}
        emptyTitle="No commands logged yet"
        emptyMessage="Executed commands will show up here."
        renderItem={(entry) => (
          <Card className="glass-panel">
            <CardContent className="flex items-center justify-between gap-3 p-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium">{entry.executor}</span>
                  <Badge variant="outline">{entry.serverName}</Badge>
                </div>
                <p className="truncate font-mono text-xs text-muted-foreground">{entry.command}</p>
              </div>
              <span className="shrink-0 text-xs text-muted-foreground">{formatRelativeTime(entry.occurredAt)}</span>
            </CardContent>
          </Card>
        )}
      />
    </div>
  );
}
