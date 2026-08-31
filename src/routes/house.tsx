/**
 * Linewatch — household outbound watch
 * Copyright (c) 2026 Chris Decker
 */
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { EventDetail } from "@/components/event-detail";
import { HourRange } from "@/components/hour-range";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { formatBytes, formatRelative, pathTone } from "@/lib/linewatch/format";
import { owners, siteLog } from "@/lib/linewatch/selectors";
import { useLinewatch } from "@/lib/linewatch/store";
import { CATEGORY_LABEL, PATH_LABEL, type FirewallMode } from "@/lib/linewatch/types";

export const Route = createFileRoute("/house")({ component: HousePage });

const MODES: { id: FirewallMode; label: string; blurb: string }[] = [
  { id: "monitor", label: "Monitor", blurb: "Log everything. House and person lists still mark blocked." },
  { id: "blacklist", label: "Blacklist", blurb: "Deny listed sites. Everything else leaves the house." },
  { id: "whitelist", label: "Whitelist", blurb: "Only allowlisted sites leave. Everything else is cut." },
];

function HousePage() {
  const events = useLinewatch((s) => s.events);
  const devices = useLinewatch((s) => s.devices);
  const now = useLinewatch((s) => s.now);
  const rules = useLinewatch((s) => s.rules);
  const setRules = useLinewatch((s) => s.setRules);
  const addToBlocklist = useLinewatch((s) => s.addToBlocklist);
  const removeFromBlocklist = useLinewatch((s) => s.removeFromBlocklist);
  const addToAllowlist = useLinewatch((s) => s.addToAllowlist);
  const removeFromAllowlist = useLinewatch((s) => s.removeFromAllowlist);
  const blockSiteForPerson = useLinewatch((s) => s.blockSiteForPerson);
  const [q, setQ] = useState("");
  const [host, setHost] = useState("");
  const [visibleSites, setVisibleSites] = useState(20);
  const people = owners(devices);
  const sites = useMemo(() => {
    const all = siteLog(events);
    const s = q.trim().toLowerCase();
    if (!s) return all;
    return all.filter((x) => x.host.includes(s) || x.label.toLowerCase().includes(s) || x.people.some((p) => p.toLowerCase().includes(s)));
  }, [events, q]);

  useEffect(() => {
    setVisibleSites(20);
  }, [q]);

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <header>
          <h1 className="text-2xl font-medium tracking-tight md:text-3xl">House firewall</h1>
          <p className="mt-1 max-w-xl text-sm text-muted">
            House profile. Sliders for bedtime and homework. Adult / gaming / social as switches. Then
            approve or block a site.
          </p>
        </header>

        <section className="grid gap-4 md:grid-cols-2">
          <HourRange
            title="Bedtime"
            description="Kids lose social, games, and streaming in this window."
            enabled={rules.bedtimeOn}
            onEnabled={(v) => setRules({ bedtimeOn: v })}
            start={rules.quietStartHour}
            end={rules.quietEndHour}
            onStart={(h) => setRules({ quietStartHour: h })}
            onEnd={(h) => setRules({ quietEndHour: h })}
          />
          <HourRange
            title="Homework time"
            description="Kids lose games and social while this is on."
            enabled={rules.homeworkOn}
            onEnabled={(v) => setRules({ homeworkOn: v })}
            start={rules.homeworkStartHour}
            end={rules.homeworkEndHour}
            onStart={(h) => setRules({ homeworkStartHour: h })}
            onEnd={(h) => setRules({ homeworkEndHour: h })}
          />
        </section>

        <section className="rounded-lg bg-surface p-4 shadow-[var(--shadow-border)]">
          <h2 className="text-sm font-medium">House categories</h2>
          <div className="mt-3 divide-y divide-border">
            <Switch
              checked={rules.blockAdult}
              onCheckedChange={(v) => setRules({ blockAdult: v })}
              label="Block adult"
              description="Kids never resolve those names. Parents still can."
            />
            <Switch
              checked={rules.blockSocial}
              onCheckedChange={(v) => setRules({ blockSocial: v })}
              label="Block social"
              description="TikTok, Instagram, Discord, and the rest — kids only."
            />
            <Switch
              checked={rules.blockGaming}
              onCheckedChange={(v) => setRules({ blockGaming: v })}
              label="Block gaming"
              description="Roblox, Xbox, Steam, Minecraft — kids only."
            />
            <Switch
              checked={rules.safeSearch}
              onCheckedChange={(v) => setRules({ safeSearch: v })}
              label="Safe search"
              description="Google, Bing, YouTube, DuckDuckGo rewritten to their locked-safe names."
            />
            <Switch
              checked={rules.autoQuarantine}
              onCheckedChange={(v) => setRules({ autoQuarantine: v })}
              label="Auto-isolate kids"
              description="Three high-severity hits in fifteen minutes put that device in digital quarantine. Turn off per person under People."
            />
          </div>
        </section>

        <section className="rounded-lg bg-surface p-4 shadow-[var(--shadow-border)]">
          <h2 className="text-sm font-medium">Mode</h2>
          <div className="mt-3 grid gap-2 md:grid-cols-3">
            {MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setRules({ firewallMode: m.id })}
                className={
                  rules.firewallMode === m.id
                    ? "rounded-md bg-elevated p-4 text-left shadow-[var(--shadow-border-hover)]"
                    : "rounded-md p-4 text-left shadow-[var(--shadow-border)]"
                }
              >
                <p className="text-sm font-medium">{m.label}</p>
                <p className="mt-1 text-xs text-muted">{m.blurb}</p>
              </button>
            ))}
          </div>
          <label className="mt-4 flex min-h-11 items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={rules.keepSystemUpdates}
              onChange={(e) => setRules({ keepSystemUpdates: e.target.checked })}
              className="size-4"
            />
            Keep Apple / Google / Microsoft updates on the allowlist
          </label>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg bg-surface p-4 shadow-[var(--shadow-border)]">
            <h2 className="text-sm font-medium">House blacklist</h2>
            <form
              className="mt-3 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                addToBlocklist(host);
                setHost("");
              }}
            >
              <input
                value={host}
                onChange={(e) => setHost(e.target.value)}
                placeholder="host to deny"
                className="h-11 min-w-0 flex-1 rounded-sm bg-elevated px-3 font-mono text-sm shadow-[var(--shadow-border)]"
              />
              <Button type="submit" size="sm" className="h-11">
                Deny
              </Button>
            </form>
            <ul className="mt-3 space-y-1">
              {rules.blocklist.map((h) => (
                <li key={h} className="flex items-center justify-between gap-2 text-sm">
                  <span className="font-mono text-xs">{h}</span>
                  <button type="button" className="h-11 px-2 text-xs text-muted hover:text-fg" onClick={() => removeFromBlocklist(h)}>
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-lg bg-surface p-4 shadow-[var(--shadow-border)]">
            <h2 className="text-sm font-medium">House whitelist</h2>
            <p className="mt-1 text-xs text-muted">Used when mode is Whitelist.</p>
            <ul className="mt-3 space-y-1">
              {rules.houseAllowlist.map((h) => (
                <li key={h} className="flex items-center justify-between gap-2 text-sm">
                  <span className="font-mono text-xs">{h}</span>
                  <button type="button" className="h-11 px-2 text-xs text-muted hover:text-fg" onClick={() => removeFromAllowlist(h)}>
                    Remove
                  </button>
                </li>
              ))}
            </ul>
            <form
              className="mt-3 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                addToAllowlist(host);
                setHost("");
              }}
            >
              <input
                value={host}
                onChange={(e) => setHost(e.target.value)}
                placeholder="host to allow"
                className="h-11 min-w-0 flex-1 rounded-sm bg-elevated px-3 font-mono text-sm shadow-[var(--shadow-border)]"
              />
              <Button type="submit" size="sm" variant="outline" className="h-11">
                Allow
              </Button>
            </form>
          </div>
        </section>

        <section>
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-sm font-medium">Site log</h2>
              <p className="text-xs text-muted">Filter hosts, then deny for the house or a person.</p>
            </div>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Filter sites or people"
              className="h-11 w-full max-w-xs rounded-sm bg-elevated px-3 text-sm shadow-[var(--shadow-border)] md:w-64"
            />
          </div>
          <ul className="overflow-hidden rounded-lg bg-surface shadow-[var(--shadow-border)]">
            {sites.slice(0, visibleSites).map((s) => (
              <li key={s.host} className="border-b border-border px-4 py-3 last:border-b-0">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-sm">
                      {s.label} <span className="font-mono text-xs text-muted">{s.host}</span>
                    </p>
                    <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                      <Badge tone={pathTone(s.path)}>{PATH_LABEL[s.path]}</Badge>
                      <span>{CATEGORY_LABEL[s.category]}</span>
                      <span>
                        {s.count} · {formatBytes(s.bytes)} · {formatRelative(s.lastTs, now)}
                      </span>
                      {s.locationHint ? <Badge tone="accent">Location</Badge> : null}
                    </p>
                    <p className="mt-1 text-xs text-muted">{s.people.join(", ")}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="danger" onClick={() => addToBlocklist(s.host)}>
                      House deny
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => addToAllowlist(s.host)}>
                      Approve
                    </Button>
                    {people
                      .filter((p) => p !== "House")
                      .map((p) => (
                        <Button key={p} size="sm" variant="outline" onClick={() => blockSiteForPerson(p, s.host)}>
                          {p}
                        </Button>
                      ))}
                  </div>
                </div>
              </li>
            ))}
          </ul>
          {sites.length > visibleSites ? (
            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="text-xs text-muted">
                Showing {visibleSites} of {sites.length} sites
              </p>
              <Button size="sm" variant="outline" onClick={() => setVisibleSites((n) => Math.min(n + 20, sites.length))}>
                Show 20 more
              </Button>
            </div>
          ) : null}
        </section>
        <EventDetail />
      </div>
    </AppShell>
  );
}
