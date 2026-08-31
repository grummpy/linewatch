import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { EventDetail } from "@/components/event-detail";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/linewatch/format";
import { deviceById } from "@/lib/linewatch/selectors";
import { useLinewatch } from "@/lib/linewatch/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/alerts")({ component: AlertsPage });

function AlertsPage() {
  const alerts = useLinewatch((s) => s.alerts);
  const devices = useLinewatch((s) => s.devices);
  const acknowledge = useLinewatch((s) => s.acknowledge);
  const acknowledgeAll = useLinewatch((s) => s.acknowledgeAll);
  const selectEvent = useLinewatch((s) => s.selectEvent);
  const unacked = alerts.filter((a) => !a.acknowledged).length;

  return (
    <AppShell>
      <div className="flex flex-col gap-5">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-medium tracking-tight md:text-3xl">Alerts</h1>
            <p className="mt-1 max-w-xl text-sm text-muted">
              Adult hits and after-hours social on kids’ devices. Time, source IP, destination IP.
            </p>
          </div>
          {unacked > 0 ? (
            <Button variant="outline" size="sm" onClick={acknowledgeAll}>
              Acknowledge all ({unacked})
            </Button>
          ) : null}
        </header>

        {alerts.length === 0 ? (
          <p className="rounded-lg bg-surface px-4 py-10 text-center text-sm text-muted shadow-[var(--shadow-border)]">
            Quiet. No alerts in this session.
          </p>
        ) : (
          <ul className="overflow-hidden rounded-lg bg-surface shadow-[var(--shadow-border)]">
            {alerts.map((a) => {
              const device = deviceById(devices, a.deviceId);
              const high = a.severity === "high";
              return (
                <li
                  key={a.id}
                  className={cn(
                    "flex flex-col gap-3 border-b border-border px-4 py-4 last:border-b-0 md:flex-row md:items-center",
                    !a.acknowledged && high ? "bg-danger/[0.06]" : "",
                  )}
                >
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    onClick={() => selectEvent(a.eventId)}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={high ? "danger" : "warn"}>{high ? "Adult" : "Watch"}</Badge>
                      {!a.acknowledged ? <Badge tone="solid">Open</Badge> : null}
                      <span className="text-sm font-medium">{device?.name ?? a.sourceIp}</span>
                    </div>
                    <p className="mt-1 text-sm">
                      {a.label} · {a.host}
                    </p>
                    <p className="mt-1 font-mono text-[11px] text-muted">
                      {formatDateTime(a.ts)} · {a.sourceIp} → {a.destIp}
                    </p>
                  </button>
                  {!a.acknowledged ? (
                    <Button size="sm" variant={high ? "danger" : "outline"} onClick={() => acknowledge(a.id)}>
                      Acknowledge
                    </Button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
        <EventDetail />
      </div>
    </AppShell>
  );
}
