import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { countryFlagEmoji } from "@/lib/format";
import type { CountryCount } from "@/lib/analytics";

export function PlayerDemographics({ entries }: { entries: CountryCount[] }) {
  if (entries.length === 0) {
    return (
      <Card className="glass-panel">
        <CardHeader>
          <CardTitle>No location data yet</CardTitle>
          <CardDescription>Player sessions with a resolved location will show up here.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const max = entries[0].count || 1;

  return (
    <div className="space-y-2">
      {entries.map((entry) => {
        const flag = countryFlagEmoji(entry.country);
        const percent = (entry.count / max) * 100;
        return (
          <Card key={entry.country} className="glass-panel">
            <CardContent className="space-y-2 p-4">
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="flex items-center gap-2">
                  <span aria-hidden>{flag ?? "🌐"}</span>
                  <span className="font-medium">{entry.country}</span>
                </span>
                <span className="text-muted-foreground">{entry.count}</span>
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
