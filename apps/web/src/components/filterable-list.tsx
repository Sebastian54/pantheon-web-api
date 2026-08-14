"use client";

import { useMemo, useState } from "react";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export type FilterOption<T> = { label: string; predicate: (item: T) => boolean };

/**
 * Shared client-side search + segmented-filter list, matching the iOS app's
 * consistent pattern across every moderation/log screen: fetch once
 * server-side (capped), then filter/search entirely in the browser over
 * that page. Every screen follows the same empty-state shape: nothing at
 * all vs. "no matches" for a search/filter that excluded everything.
 */
export function FilterableList<T>({
  items,
  searchPlaceholder,
  searchPredicate,
  filters,
  renderItem,
  emptyTitle,
  emptyMessage,
  keyFn,
}: {
  items: T[];
  searchPlaceholder?: string;
  searchPredicate?: (item: T, query: string) => boolean;
  filters?: FilterOption<T>[];
  renderItem: (item: T) => React.ReactNode;
  emptyTitle: string;
  emptyMessage: string;
  keyFn: (item: T) => string;
}) {
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState(0);

  const filtered = useMemo(() => {
    let result = items;
    if (filters && filters[activeFilter] && activeFilter !== 0) {
      result = result.filter(filters[activeFilter].predicate);
    }
    if (query.trim() && searchPredicate) {
      const normalized = query.trim().toLowerCase();
      result = result.filter((item) => searchPredicate(item, normalized));
    }
    return result;
  }, [items, query, activeFilter, filters, searchPredicate]);

  if (items.length === 0) {
    return (
      <Card className="glass-panel">
        <CardHeader>
          <CardTitle>{emptyTitle}</CardTitle>
          <CardDescription>{emptyMessage}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {(searchPredicate || (filters && filters.length > 0)) && (
        <div className="flex flex-wrap items-center gap-2">
          {searchPredicate && (
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={searchPlaceholder ?? "Search…"}
              className="h-9 min-w-[200px] flex-1 rounded-full border border-input bg-background px-3 text-sm text-foreground"
            />
          )}
          {filters && filters.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {filters.map((filter, index) => (
                <button
                  key={filter.label}
                  type="button"
                  onClick={() => setActiveFilter(index)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    activeFilter === index
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {filtered.length === 0 ? (
        <Card className="glass-panel">
          <CardHeader>
            <CardTitle>No matches</CardTitle>
            <CardDescription>Try a different search or filter.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((item) => (
            <div key={keyFn(item)}>{renderItem(item)}</div>
          ))}
        </div>
      )}
    </div>
  );
}
