/**
 * Linewatch — household outbound watch
 * Copyright (c) 2026 Chris Decker
 */
import { createFileRoute } from "@tanstack/react-router";
import { Ban, Check } from "lucide-react";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { EventDetail } from "@/components/event-detail";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatBytes, formatRelative, kindLabel } from "@/lib/linewatch/format";
import { deviceStats, startOfDay } from "@/lib/linewatch/selectors";
import { useLinewatch } from "@/lib/linewatch/store";

export const Route = createFileRoute("/devices")({ component: DevicesPage });

function DevicesPage() {
  const devices = useLinewatch((s) => s.devices);
  const events = useLinewatch((s) => s.events);
  const now = useLinewatch((s) => s.now);
  const toggleBlockDevice = useLinewatch((s) => s.toggleBlockDevice);
  const renameDevice = useLinewatch((s) => s.renameDevice);
  const selectEvent = useLinewatch((s) => s.selectEvent);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const today = events.filter((e) => e.ts >= startOfDay(now || Date.now()));
  const stats = deviceStats(today.length ? today : events, devices);

  return (
    <AppShell>
      <div className="flex flex-col gap-5">
        <header>
          <h1 className="text-2xl font-medium tracking-tight md:text-3xl">Devices</h1>
          <p className="mt-1 max-w-xl text-sm text-muted">
            Every address on the LAN. Block a kid’s device instantly when an adult hit lands.
          </p>
        </header>

        <ul className="grid gap-3 md:grid-cols-2">
          {stats.map(({ device, count, adult, last }) => {
            const online = now - device.lastSeen < 90_000;
            const isEdit = editing === device.id;
            return (
              <li key={device.id} className="rounded-lg bg-surface p-4 shadow-[var(--shadow-border)]">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    {isEdit ? (
                      <form
                        className="flex gap-2"
                        onSubmit={(e) => {
                          e.preventDefault();
                          renameDevice(device.id, draft);
                          setEditing(null);
                        }}
                      >
                        <input
                          value={draft}
                          onChange={(e) => setDraft(e.target.value)}
                          className="h-11 w-full rounded-sm bg-elevated px-3 text-sm shadow-[var(--shadow-border)]"
                          autoFocus
                        />
                        <Button size="icon" type="submit" aria-label="Save name">
                          <Check />
                        </Button>
                      </form>
                    ) : (
                      <button
                        type="button"
                        className="text-left text-base font-medium tracking-tight"
                        onClick={() => {
                          setEditing(device.id);
                          setDraft(device.name);
                        }}
                      >
                        {device.name}
                      </button>
                    )}
                    <p className="mt-1 font-mono text-xs text-muted">
                      {device.ip} · {device.mac}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge tone={device.blocked ? "danger" : online ? "ok" : "muted"}>
                      {device.blocked ? "Blocked" : online ? "Live" : "Idle"}
                    </Badge>
                    <Badge tone={device.role === "child" ? "accent" : "muted"}>{device.role}</Badge>
                  </div>
                </div>

                <dl className="mt-4 grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <dt className="text-subtle">Kind</dt>
                    <dd className="mt-0.5">{kindLabel(device.kind)}</dd>
                  </div>
                  <div>
                    <dt className="text-subtle">Today</dt>
                    <dd className="mt-0.5 font-mono tabular">{count} hits</dd>
                  </div>
                  <div>
                    <dt className="text-subtle">Adult</dt>
                    <dd className={adult ? "mt-0.5 font-mono text-danger tabular" : "mt-0.5 font-mono tabular"}>
                      {adult}
                    </dd>
                  </div>
                </dl>

                {last ? (
                  <button
                    type="button"
                    className="mt-3 w-full truncate rounded-sm bg-elevated px-3 py-2 text-left text-xs text-muted"
                    onClick={() => selectEvent(last.id)}
                  >
                    Last · {last.destHost} · {formatBytes(last.bytes)} · {formatRelative(last.ts, now)}
                  </button>
                ) : null}

                <Button
                  className="mt-3 w-full"
                  variant={device.blocked ? "outline" : "danger"}
                  size="sm"
                  onClick={() => toggleBlockDevice(device.id)}
                >
                  <Ban />
                  {device.blocked ? "Unblock" : "Block internet"}
                </Button>
              </li>
            );
          })}
        </ul>
        <EventDetail />
      </div>
    </AppShell>
  );
}
