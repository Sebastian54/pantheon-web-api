export type SparkMetrics = {
  tps10s: number | null;
  mspt10s: number | null;
  cpuProcess10s: number | null;
  cpuSystem10s: number | null;
};

export function hasAnySparkMetric(metrics: SparkMetrics): boolean {
  return (
    metrics.tps10s !== null ||
    metrics.mspt10s !== null ||
    metrics.cpuProcess10s !== null ||
    metrics.cpuSystem10s !== null
  );
}

/** Each tile hides itself when its field is null rather than showing a fake 0 — matches the
 * sparse-field convention used consistently across every Spark/Carpet/Health metric in the app. */
export function SparkMetricsGrid({ metrics }: { metrics: SparkMetrics }) {
  const tiles = [
    { label: "TPS", value: metrics.tps10s, format: (v: number) => v.toFixed(1) },
    { label: "MSPT", value: metrics.mspt10s, format: (v: number) => `${v.toFixed(1)}ms` },
    { label: "Process CPU", value: metrics.cpuProcess10s, format: (v: number) => `${v.toFixed(0)}%` },
    { label: "System CPU", value: metrics.cpuSystem10s, format: (v: number) => `${v.toFixed(0)}%` },
  ].filter((tile): tile is { label: string; value: number; format: (v: number) => string } => tile.value !== null);

  if (tiles.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-3">
      {tiles.map((tile) => (
        <div key={tile.label} className="glass-panel rounded-xl p-3">
          <p className="text-xs text-muted-foreground">{tile.label}</p>
          <p className="text-lg font-semibold">{tile.format(tile.value)}</p>
        </div>
      ))}
    </div>
  );
}
