/**
 * Linewatch — household outbound watch
 * Copyright (c) 2026 Chris Decker
 */
import { createFileRoute } from "@tanstack/react-router";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AppShell } from "@/components/app-shell";
import { EventDetail } from "@/components/event-detail";
import { Badge } from "@/components/ui/badge";
import { formatBytes, formatDateTime } from "@/lib/linewatch/format";
import { categoryCounts, deviceStats, hourlyBuckets, startOfDay } from "@/lib/linewatch/selectors";
import { useLinewatch } from "@/lib/linewatch/store";
import { CATEGORY_LABEL } from "@/lib/linewatch/types";

export const Route = createFileRoute("/analytics")({ component: AnalyticsPage });

const tooltipStyle = {
  background: "var(--color-elevated)",
  border: "1px solid var(--color-border-strong)",
  borderRadius: 8,
  color: "var(--color-fg)",
};

function AnalyticsPage() {
  const events = useLinewatch((s) => s.events);
  const devices = useLinewatch((s) => s.devices);
  const now = useLinewatch((s) => s.now) || Date.now();
  const selectEvent = useLinewatch((s) => s.selectEvent);

  const today = events.filter((e) => e.ts >= startOfDay(now));
  const mix = categoryCounts(today.length ? today : events)
    .slice(0, 8)
    .map((row) => ({ ...row, name: CATEGORY_LABEL[row.category] }));
  const hours = hourlyBuckets(events, now);
  const perDevice = deviceStats(today.length ? today : events, devices);
  const adultHits = events.filter((e) => e.category === "adult").slice(-12).reverse();
  const adultToday = today.filter((e) => e.category === "adult");

  const topKid = perDevice.find((d) => d.device.role === "child" && d.adult > 0);
  const lastAdult = adultHits[0];

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <header>
          <h1 className="text-2xl font-medium tracking-tight md:text-3xl">Analytics</h1>
          <p className="mt-1 max-w-xl text-sm text-muted">
            Who went where, by hour and by device. Adult events are isolated at the bottom.
          </p>
        </header>

        <section className="rounded-lg bg-surface p-4 shadow-[var(--shadow-border)] md:p-5">
          <h2 className="text-sm font-medium">Today’s digest</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
            {adultToday.length === 0
              ? `No adult destinations so far today. ${today.length} outbound events classified across ${devices.length} devices.`
              : `${adultToday.length} adult hit${adultToday.length === 1 ? "" : "s"} today. ${
                  topKid
                    ? `${topKid.device.name} (${topKid.device.ip}) accounts for ${topKid.adult}.`
                    : ""
                } ${
                  lastAdult
                    ? `Latest: ${formatDateTime(lastAdult.ts)} · ${lastAdult.sourceIp} → ${lastAdult.destIp} (${lastAdult.destHost}).`
                    : ""
                }`}
          </p>
        </section>

        <section className="grid gap-4 lg:grid-cols-5">
          <div className="rounded-lg bg-surface p-4 shadow-[var(--shadow-border)] lg:col-span-3">
            <h2 className="mb-3 text-sm font-medium">Volume · last 24 hours</h2>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={hours} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="var(--color-border)" vertical={false} />
                  <XAxis
                    dataKey="hour"
                    tick={{ fill: "var(--color-muted)", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    interval={3}
                    minTickGap={28}
                  />
                  <YAxis
                    tick={{ fill: "var(--color-muted)", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    width={36}
                  />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Area
                    type="monotone"
                    dataKey="count"
                    name="Events"
                    stroke="var(--color-accent)"
                    fill="var(--color-accent)"
                    fillOpacity={0.18}
                  />
                  <Area
                    type="monotone"
                    dataKey="adult"
                    name="Adult"
                    stroke="var(--color-danger)"
                    fill="var(--color-danger)"
                    fillOpacity={0.35}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="rounded-lg bg-surface p-4 shadow-[var(--shadow-border)] lg:col-span-2">
            <h2 className="mb-3 text-sm font-medium">Genre mix</h2>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={mix} layout="vertical" margin={{ top: 0, right: 16, left: 4, bottom: 0 }}>
                  <XAxis type="number" hide />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={96}
                    tick={{ fill: "var(--color-muted)", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    interval={0}
                  />
                  <Bar dataKey="count" fill="var(--color-accent)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>

        <section className="rounded-lg bg-surface p-4 shadow-[var(--shadow-border)]">
          <h2 className="mb-3 text-sm font-medium">By device</h2>
          <ul className="divide-y divide-border">
            {perDevice.map(({ device, count, bytes, adult }) => (
              <li key={device.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm">{device.name}</p>
                  <p className="font-mono text-[11px] text-muted">{device.ip}</p>
                </div>
                <div className="flex items-center gap-3 text-right">
                  {adult > 0 ? <Badge tone="danger">{adult} adult</Badge> : null}
                  <span className="font-mono text-xs text-muted tabular">
                    {count} · {formatBytes(bytes)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-medium">Adult incidents</h2>
          {adultHits.length === 0 ? (
            <p className="text-sm text-muted">None in the current buffer.</p>
          ) : (
            <ul className="overflow-hidden rounded-lg bg-surface shadow-[var(--shadow-border)]">
              {adultHits.map((e) => {
                const device = devices.find((d) => d.id === e.deviceId);
                return (
                  <li key={e.id}>
                    <button
                      type="button"
                      className="flex w-full flex-col gap-1 px-4 py-3 text-left hover:bg-elevated md:flex-row md:items-center md:justify-between"
                      onClick={() => selectEvent(e.id)}
                    >
                      <span className="text-sm">
                        {device?.name ?? e.sourceIp} · {e.destLabel}
                      </span>
                      <span className="font-mono text-[11px] text-muted">
                        {formatDateTime(e.ts)} · {e.sourceIp} → {e.destIp}
                      </span>
                    </button>
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
