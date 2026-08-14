"use client";

import { useMemo, useState } from "react";
import { FilterableList } from "@/components/filterable-list";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatIdentifier, formatRelativeTime } from "@/lib/format";
import type { LedgerEntry } from "@/lib/moderation";

const BREAK_REMOVE_ACTIONS = new Set(["break", "remove"]);
const PLACE_ADD_ACTIONS = new Set(["place", "add"]);

export function LedgerList({ entries }: { entries: LedgerEntry[] }) {
  const [rolledBackOnly, setRolledBackOnly] = useState(false);
  const distinctActions = useMemo(() => [...new Set(entries.map((entry) => entry.action))].sort(), [entries]);
  const [selectedAction, setSelectedAction] = useState<string | null>(null);

  let scoped = entries;
  if (rolledBackOnly) scoped = scoped.filter((entry) => entry.rolledBack);
  if (selectedAction) scoped = scoped.filter((entry) => entry.action === selectedAction);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setRolledBackOnly((value) => !value)}
          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
            rolledBackOnly
              ? "bg-destructive text-destructive-foreground"
              : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
          }`}
        >
          Rolled Back Only
        </button>
      </div>
      {distinctActions.length > 1 && (
        <div className="flex flex-wrap gap-1">
          <button
            type="button"
            onClick={() => setSelectedAction(null)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              !selectedAction ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
            }`}
          >
            All actions
          </button>
          {distinctActions.map((action) => (
            <button
              key={action}
              type="button"
              onClick={() => setSelectedAction(action)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                selectedAction === action
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
              }`}
            >
              {formatIdentifier(action)}
            </button>
          ))}
        </div>
      )}
      <FilterableList
        items={scoped}
        searchPlaceholder="Search object, player, or world…"
        searchPredicate={(entry, q) =>
          entry.object.toLowerCase().includes(q) ||
          entry.world.toLowerCase().includes(q) ||
          (entry.playerName?.toLowerCase().includes(q) ?? false)
        }
        keyFn={(entry) => entry.id}
        emptyTitle="No ledger events yet"
        emptyMessage="Block and grief changes will show up here."
        renderItem={(entry) => {
          const actor = entry.playerName ?? formatIdentifier(entry.source);
          const actionColor = BREAK_REMOVE_ACTIONS.has(entry.action.toLowerCase())
            ? "text-red-400"
            : PLACE_ADD_ACTIONS.has(entry.action.toLowerCase())
              ? "text-emerald-400"
              : "text-muted-foreground";
          return (
            <Card className="glass-panel">
              <CardContent className="space-y-1 p-4">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="flex items-center gap-2">
                    <span className="font-medium">{actor}</span>
                    {entry.rolledBack && <Badge variant="destructive">Rolled Back</Badge>}
                  </span>
                  <span className="text-xs text-muted-foreground">{formatRelativeTime(entry.occurredAt)}</span>
                </div>
                <p className="text-xs">
                  <span className={actionColor}>{formatIdentifier(entry.action)}</span>{" "}
                  <span className="text-muted-foreground">{formatIdentifier(entry.object)}</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {entry.world} ({entry.x}, {entry.y}, {entry.z}) &bull; {entry.serverName}
                </p>
              </CardContent>
            </Card>
          );
        }}
      />
    </div>
  );
}
