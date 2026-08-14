import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatPlaytime } from "@/lib/format";
import type { LeaderboardEntry } from "@/lib/analytics";

const RANK_COLORS = ["text-yellow-400", "text-zinc-300", "text-amber-600"];

export function PlaytimeLeaderboard({ entries }: { entries: LeaderboardEntry[] }) {
  if (entries.length === 0) {
    return (
      <Card className="glass-panel">
        <CardHeader>
          <CardTitle>No playtime yet</CardTitle>
          <CardDescription>Player sessions will build this leaderboard over time.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const max = entries[0].totalPlaytimeSeconds || 1;

  return (
    <div className="space-y-2">
      {entries.map((entry, index) => {
        const percent = (entry.totalPlaytimeSeconds / max) * 100;
        return (
          <Card key={entry.uuid} className="glass-panel">
            <CardContent className="space-y-2 p-4">
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="flex items-center gap-2">
                  <span className={`w-6 text-right font-semibold ${RANK_COLORS[index] ?? "text-muted-foreground"}`}>
                    {index + 1}
                  </span>
                  <span className="font-medium">{entry.username}</span>
                </span>
                <span className="text-muted-foreground">{formatPlaytime(entry.totalPlaytimeSeconds)}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${percent}%` }} />
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
