/**
 * Linewatch — household outbound watch
 * Copyright (c) 2026 Chris Decker
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { EventDetail } from "@/components/event-detail";
import { InsightsCard } from "@/components/insights-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { archiveToCsv } from "@/lib/linewatch/selectors";
import { downloadText, formatDateTime } from "@/lib/linewatch/format";
import { deviceById } from "@/lib/linewatch/selectors";
import { useLinewatch } from "@/lib/linewatch/store";

export const Route = createFileRoute("/logs")({ component: LogsPage });

function LogsPage() {
  const archives = useLinewatch((s) => s.archives);
  const alerts = useLinewatch((s) => s.alerts);
  const devices = useLinewatch((s) => s.devices);
  const flushArchive = useLinewatch((s) => s.flushArchive);
  const acknowledge = useLinewatch((s) => s.acknowledge);
  const acknowledgeAll = useLinewatch((s) => s.acknowledgeAll);
  const selectEvent = useLinewatch((s) => s.selectEvent);
  const unacked = alerts.filter((a) => !a.acknowledged).length;

  return (
    <AppShell>
      <div className="flex flex-col gap-8">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-medium tracking-tight md:text-3xl">Logs</h1>
            <p className="mt-1 max-w-xl text-sm text-muted">
              Live buffer auto-archives into a repository. Rows older than 7 days are overwritten.
              Insights are sentences, not a dump. Download any roll as CSV.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={flushArchive}>
              Archive now
            </Button>
            <Button size="sm" variant="ghost" asChild>
              <Link to="/analytics">Analytics</Link>
            </Button>
          </div>
        </header>

        <InsightsCard />

        <section>
          <h2 className="mb-3 text-sm font-medium">Repository</h2>
          {archives.length === 0 ? (
            <p className="rounded-lg bg-surface px-4 py-8 text-center text-sm text-muted shadow-[var(--shadow-border)]">
              Waiting on the first roll. The collector archives every fifty events, and every few
              minutes if traffic is light.
            </p>
          ) : (
            <ul className="overflow-hidden rounded-lg bg-surface shadow-[var(--shadow-border)]">
              {archives.map((a) => (
                <li
                  key={a.id}
                  className="flex flex-col gap-3 border-b border-border px-4 py-4 last:border-b-0 md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <p className="text-sm font-medium">{formatDateTime(a.createdAt)}</p>
                    <p className="mt-1 font-mono text-[11px] text-muted">
                      {a.eventCount} events · {a.adultCount} adult · {a.sidewalkCount} sidewalk ·{" "}
                      {a.locationCount} location · {a.people.join(", ")}
                    </p>
                    <p className="mt-1 font-mono text-[11px] text-subtle">
                      {formatDateTime(a.from)} → {formatDateTime(a.to)}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      downloadText(
                        `linewatch-${new Date(a.createdAt).toISOString().slice(0, 16)}.csv`,
                        archiveToCsv(a.rows),
                      )
                    }
                  >
                    Download CSV
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-sm font-medium">Alerts</h2>
            {unacked > 0 ? (
              <Button size="sm" variant="outline" onClick={acknowledgeAll}>
                Acknowledge all ({unacked})
              </Button>
            ) : null}
          </div>
          {alerts.length === 0 ? (
            <p className="text-sm text-muted">Quiet.</p>
          ) : (
            <ul className="overflow-hidden rounded-lg bg-surface shadow-[var(--shadow-border)]">
              {alerts.slice(0, 40).map((a) => {
                const device = deviceById(devices, a.deviceId);
                const high = a.severity === "high";
                return (
                  <li
                    key={a.id}
                    className="flex flex-col gap-3 border-b border-border px-4 py-4 last:border-b-0 md:flex-row md:items-center"
                  >
                    <button type="button" className="min-w-0 flex-1 text-left" onClick={() => selectEvent(a.eventId)}>
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
        </section>
        <EventDetail />
      </div>
    </AppShell>
  );
}
