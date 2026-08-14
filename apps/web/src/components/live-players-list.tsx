"use client";

import { useEffect, useState, useTransition } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { countryFlagEmoji } from "@/lib/format";
import { fetchActiveSessions } from "@/app/analytics/players/actions";
import type { ActiveSession } from "@/lib/analytics";

/** Self-updating elapsed-time display, zero backend involvement per tick. */
function LiveDuration({ since }: { since: Date }) {
  const [, forceTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => forceTick((tick) => tick + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const totalSeconds = Math.max(0, Math.floor((Date.now() - since.getTime()) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const display =
    hours > 0
      ? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
      : `${minutes}:${String(seconds).padStart(2, "0")}`;

  return <span className="font-mono text-xs text-muted-foreground">{display}</span>;
}

/** Polls every 10s while mounted, matching the iOS app's Connected Now screen. */
export function LivePlayersList({ initialSessions }: { initialSessions: ActiveSession[] }) {
  const [sessions, setSessions] = useState(initialSessions);
  const [, startTransition] = useTransition();

  useEffect(() => {
    const interval = setInterval(() => {
      startTransition(() => {
        fetchActiveSessions().then(setSessions);
      });
    }, 10_000);
    return () => clearInterval(interval);
  }, []);

  if (sessions.length === 0) {
    return (
      <Card className="glass-panel">
        <CardHeader>
          <CardTitle>No one online</CardTitle>
          <CardDescription>Connected players will show up here.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {sessions.map((activeSession) => {
        const flag = countryFlagEmoji(activeSession.geolocationCountry);
        return (
          <Card key={activeSession.id} className="glass-panel">
            <CardContent className="flex items-center justify-between gap-3 p-4">
              <div className="flex items-center gap-3">
                <span aria-hidden className="text-lg">
                  {flag ?? "👤"}
                </span>
                <div>
                  <p className="text-sm font-medium">
                    {activeSession.username ?? `Player ${activeSession.playerUuid.slice(0, 8)}`}
                  </p>
                  <p className="text-xs text-muted-foreground">{activeSession.serverName}</p>
                </div>
              </div>
              <LiveDuration since={activeSession.startedAt} />
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
