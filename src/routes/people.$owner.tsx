import { createFileRoute, Link } from "@tanstack/react-router";
import { EventDetail } from "@/components/event-detail";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatBytes, formatDateTime, kindLabel, pathTone } from "@/lib/linewatch/format";
import { startOfDay } from "@/lib/linewatch/selectors";
import { useLinewatch } from "@/lib/linewatch/store";
import { CATEGORY_LABEL, PATH_LABEL } from "@/lib/linewatch/types";

export const Route = createFileRoute("/people/$owner")({ component: PersonPage });

function PersonPage() {
  const { owner } = Route.useParams();
  const allDevices = useLinewatch((s) => s.devices);
  const allEvents = useLinewatch((s) => s.events);
  const devices = allDevices.filter((d) => d.owner === owner);
  const events = allEvents.filter((e) => e.owner === owner);
  const now = useLinewatch((s) => s.now);
  const rules = useLinewatch((s) => s.rules);
  const toggleBlockDevice = useLinewatch((s) => s.toggleBlockDevice);
  const blockSiteForPerson = useLinewatch((s) => s.blockSiteForPerson);
  const unblockSiteForPerson = useLinewatch((s) => s.unblockSiteForPerson);
  const selectEvent = useLinewatch((s) => s.selectEvent);
  const setPersonFilter = useLinewatch((s) => s.setPersonFilter);

  const today = events.filter((e) => e.ts >= startOfDay(now || Date.now()));
  const locHits = events.filter((e) => e.locationHint).slice(-8).reverse();
  const blocks = rules.personBlocks[owner] ?? [];
  const sidewalk = today.filter((e) => e.path === "sidewalk").length;
  const wan = today.filter((e) => e.path === "wan").length;
  const amazon = today.filter((e) => e.path === "amazon").length;
  const adult = today.filter((e) => e.category === "adult").length;
  const recent = [...events].slice(-12).reverse();
  const role = devices[0]?.role ?? "shared";

  return (
    <div className="flex flex-col gap-6">
      <header>
        <p className="text-xs text-muted">
          <Link to="/people" className="hover:text-fg">
            People
          </Link>
          <span className="mx-1.5">/</span>
          {owner}
        </p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-medium tracking-tight md:text-3xl">{owner}</h1>
            <p className="mt-1 text-sm text-muted">
              {role} · {devices.length} device{devices.length === 1 ? "" : "s"}
            </p>
          </div>
          <Link
            to="/"
            onClick={() => setPersonFilter(owner)}
            className="inline-flex h-11 items-center rounded-sm px-4 text-sm shadow-[var(--shadow-border)]"
          >
            Watch live
          </Link>
        </div>
      </header>

      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg bg-border md:grid-cols-4">
        {[
          { k: "WAN today", v: String(wan) },
          { k: "Sidewalk today", v: String(sidewalk) },
          { k: "Amazon net", v: String(amazon) },
          { k: "Adult", v: String(adult), alert: adult > 0 },
        ].map((x) => (
          <div key={x.k} className="bg-surface px-4 py-4">
            <dt className="text-[11px] tracking-wide text-subtle uppercase">{x.k}</dt>
            <dd className={x.alert ? "mt-1 font-mono text-2xl text-danger tabular" : "mt-1 font-mono text-2xl tabular"}>
              {x.v}
            </dd>
          </div>
        ))}
      </dl>

      <section className="rounded-lg bg-surface p-4 shadow-[var(--shadow-border)]">
        <h2 className="text-sm font-medium">Devices</h2>
        <ul className="mt-3 divide-y divide-border">
          {devices.map((d) => (
            <li key={d.id} className="flex flex-col gap-2 py-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm">{d.name}</p>
                <p className="font-mono text-[11px] text-muted">
                  {d.ip} · {d.mac} · {kindLabel(d.kind)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={d.blocked ? "danger" : "ok"}>{d.blocked ? "Blocked" : "On"}</Badge>
                <Button size="sm" variant={d.blocked ? "outline" : "danger"} onClick={() => toggleBlockDevice(d.id)}>
                  {d.blocked ? "Unblock" : "Block internet"}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-lg bg-surface p-4 shadow-[var(--shadow-border)]">
        <h2 className="text-sm font-medium">Location</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          These logs never carry a GPS coordinate. When a destination is known to request location
          (Maps, Weather, Apple Location), it is flagged. Dest IP region is the server, not {owner}.
        </p>
        {locHits.length === 0 ? (
          <p className="mt-3 text-sm">No location-class destinations for {owner} in the buffer.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {locHits.map((e) => (
              <li key={e.id}>
                <button type="button" className="w-full py-3 text-left" onClick={() => selectEvent(e.id)}>
                  <p className="text-sm">{e.destLabel}</p>
                  <p className="text-xs text-muted">{e.locationHint}</p>
                  <p className="mt-1 font-mono text-[11px] text-muted">
                    {formatDateTime(e.ts)} · {e.destHost} · server {e.destRegion}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-lg bg-surface p-4 shadow-[var(--shadow-border)]">
        <h2 className="text-sm font-medium">Blocked for {owner}</h2>
        {blocks.length === 0 ? (
          <p className="mt-2 text-sm text-muted">No personal blocklist. House firewall still applies.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {blocks.map((h) => (
              <li key={h} className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs">{h}</span>
                <Button size="sm" variant="ghost" onClick={() => unblockSiteForPerson(owner, h)}>
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium">Recent</h2>
        <ul className="overflow-hidden rounded-lg bg-surface shadow-[var(--shadow-border)]">
          {recent.map((e) => (
            <li key={e.id} className="border-b border-border last:border-b-0">
              <button
                type="button"
                className="flex w-full flex-col gap-1 px-4 py-3 text-left hover:bg-elevated md:flex-row md:items-center md:justify-between"
                onClick={() => selectEvent(e.id)}
              >
                <span className="flex flex-wrap items-center gap-2 text-sm">
                  {e.destHost}
                  <Badge tone={pathTone(e.path)}>{PATH_LABEL[e.path]}</Badge>
                  <span className="text-xs text-muted">{CATEGORY_LABEL[e.category]}</span>
                </span>
                <span className="font-mono text-[11px] text-muted">
                  {formatDateTime(e.ts)} · {e.sourceIp} → {e.destIp} · {formatBytes(e.bytes)}
                </span>
              </button>
              <div className="px-4 pb-3">
                <Button size="sm" variant="ghost" onClick={() => blockSiteForPerson(owner, e.destHost)}>
                  Block {e.destHost} for {owner}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </section>
      <EventDetail />
    </div>
  );
}
