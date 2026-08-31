import { createFileRoute, Link } from "@tanstack/react-router";
import { EventDetail } from "@/components/event-detail";
import { Badge } from "@/components/ui/badge";
import { formatBytes, formatRelative, kindLabel } from "@/lib/linewatch/format";
import { personStats, startOfDay } from "@/lib/linewatch/selectors";
import { useLinewatch } from "@/lib/linewatch/store";

export const Route = createFileRoute("/people/")({ component: PeoplePage });

function PeoplePage() {
  const devices = useLinewatch((s) => s.devices);
  const events = useLinewatch((s) => s.events);
  const now = useLinewatch((s) => s.now);
  const setPersonFilter = useLinewatch((s) => s.setPersonFilter);
  const today = events.filter((e) => e.ts >= startOfDay(now || Date.now()));
  const stats = personStats(today.length ? today : events, devices);

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-2xl font-medium tracking-tight md:text-3xl">People</h1>
        <p className="mt-1 max-w-xl text-sm text-muted">
          One profile per person. Open anyone to see devices, Sidewalk vs WAN, and whether location
          left the house.
        </p>
      </header>
      <ul className="grid gap-3 md:grid-cols-2">
        {stats.map((p) => (
          <li key={p.owner} className="rounded-lg bg-surface p-4 shadow-[var(--shadow-border)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <Link
                  to="/people/$owner"
                  params={{ owner: p.owner }}
                  className="text-base font-medium tracking-tight"
                  onClick={() => setPersonFilter(p.owner)}
                >
                  {p.owner}
                </Link>
                <p className="mt-1 text-xs text-muted">
                  {p.devices.length} device{p.devices.length === 1 ? "" : "s"} · {p.role}
                </p>
              </div>
              <Badge tone={p.role === "child" ? "accent" : "muted"}>{p.role}</Badge>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
              <div>
                <dt className="text-subtle">Hits</dt>
                <dd className="mt-0.5 font-mono tabular">{p.count}</dd>
              </div>
              <div>
                <dt className="text-subtle">Adult</dt>
                <dd className={p.adult ? "mt-0.5 font-mono text-danger tabular" : "mt-0.5 font-mono tabular"}>
                  {p.adult}
                </dd>
              </div>
              <div>
                <dt className="text-subtle">Sidewalk</dt>
                <dd className="mt-0.5 font-mono tabular">{p.sidewalk}</dd>
              </div>
              <div>
                <dt className="text-subtle">Location</dt>
                <dd className="mt-0.5 font-mono tabular">{p.location}</dd>
              </div>
            </dl>
            <ul className="mt-3 space-y-1">
              {p.devices.map((d) => (
                <li key={d.id} className="flex justify-between gap-2 font-mono text-[11px] text-muted">
                  <span>
                    {d.name} · {kindLabel(d.kind)}
                  </span>
                  <span>{d.ip}</span>
                </li>
              ))}
            </ul>
            {p.last ? (
              <p className="mt-3 truncate text-xs text-muted">
                Last · {p.last.destHost} · {formatBytes(p.last.bytes)} · {formatRelative(p.last.ts, now)}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
      <EventDetail />
    </div>
  );
}
