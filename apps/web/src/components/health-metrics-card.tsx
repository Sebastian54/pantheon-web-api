import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function MetricBar({ label, used, total, unit }: { label: string; used: number; total: number; unit: string }) {
  const percent = total > 0 ? Math.min(100, (used / total) * 100) : 0;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <span>
          {used.toFixed(0)}/{total.toFixed(0)} {unit} ({percent.toFixed(0)}%)
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-secondary">
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

export function HealthMetricsCard({
  name,
  memoryUsedMb,
  memoryTotalMb,
  diskUsedGb,
  diskTotalGb,
}: {
  name: string;
  memoryUsedMb: number | null;
  memoryTotalMb: number | null;
  diskUsedGb: number | null;
  diskTotalGb: number | null;
}) {
  return (
    <Card className="glass-panel">
      <CardHeader>
        <CardTitle className="text-base">{name}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {memoryUsedMb !== null && memoryTotalMb !== null && (
          <MetricBar label="Memory" used={memoryUsedMb} total={memoryTotalMb} unit="MB" />
        )}
        {diskUsedGb !== null && diskTotalGb !== null && (
          <MetricBar label="Disk" used={diskUsedGb} total={diskTotalGb} unit="GB" />
        )}
      </CardContent>
    </Card>
  );
}
