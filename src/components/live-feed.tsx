import { CategoryBadge } from "@/components/category-badge";
import { Badge } from "@/components/ui/badge";
import { formatBytes, formatTime, pathTone } from "@/lib/linewatch/format";
import { deviceById, owners, visibleEvents } from "@/lib/linewatch/selectors";
import { useLinewatch } from "@/lib/linewatch/store";
import { PATH_LABEL, type FeedFilter } from "@/lib/linewatch/types";
import { cn } from "@/lib/utils";

const FILTERS: { id: FeedFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "kids", label: "Kids" },
  { id: "adult", label: "Adult" },
  { id: "sidewalk", label: "Sidewalk" },
  { id: "wan", label: "WAN" },
  { id: "location", label: "Location" },
  { id: "blocked", label: "Blocked" },
];

export function LiveFeed() {
  const events = useLinewatch((s) => s.events);
  const devices = useLinewatch((s) => s.devices);
  const filter = useLinewatch((s) => s.filter);
  const personFilter = useLinewatch((s) => s.personFilter);
  const setFilter = useLinewatch((s) => s.setFilter);
  const setPersonFilter = useLinewatch((s) => s.setPersonFilter);
  const selectEvent = useLinewatch((s) => s.selectEvent);
  const running = useLinewatch((s) => s.running);
  const people = ["all", ...owners(devices)];

  const rows = visibleEvents(events, devices, filter, personFilter).slice(-90).reverse();

  return (
    <section>
      <div className="mb-3 flex flex-col gap-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-sm font-medium">Outbound</h2>
            <p className="text-xs text-muted">Pick a person, then Sidewalk vs WAN data.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-1">
          {people.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPersonFilter(p)}
              className={cn(
                "h-9 rounded-full px-3 text-xs",
                personFilter === p ? "bg-fg text-bg" : "text-muted hover:bg-elevated hover:text-fg",
              )}
            >
              {p === "all" ? "Everyone" : p}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={cn(
                "h-9 rounded-full px-3 text-xs",
                filter === f.id ? "bg-accent text-accent-fg" : "text-muted hover:bg-elevated hover:text-fg",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-lg bg-surface shadow-[var(--shadow-border)]">
        <div className="hidden grid-cols-[6.5rem_1fr_7rem_5.5rem_5.5rem_4.5rem] gap-3 border-b border-border px-4 py-2 text-[11px] tracking-wide text-subtle uppercase md:grid">
          <span>Time</span>
          <span>Person / destination</span>
          <span>Dest IP</span>
          <span>Path</span>
          <span>Genre</span>
          <span className="text-right">Size</span>
        </div>
        <ul className="max-h-[28rem] divide-y divide-border overflow-y-auto md:max-h-[36rem]">
          {rows.length === 0 ? (
            <li className="px-4 py-10 text-center text-sm text-muted">Listening on the line…</li>
          ) : (
            rows.map((e, i) => {
              const device = deviceById(devices, e.deviceId);
              return (
                <li key={e.id}>
                  <button
                    type="button"
                    onClick={() => selectEvent(e.id)}
                    className={cn(
                      "grid w-full grid-cols-1 gap-1 px-4 py-3 text-left hover:bg-elevated md:grid-cols-[6.5rem_1fr_7rem_5.5rem_5.5rem_4.5rem] md:items-center md:gap-3",
                      i === 0 && running ? "feed-row-enter" : "",
                      e.category === "adult" && !e.blocked ? "bg-danger/[0.07]" : "",
                    )}
                  >
                    <span className="font-mono text-xs text-muted tabular">{formatTime(e.ts)}</span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm">
                        {e.owner}
                        <span className="text-muted"> · {device?.name ?? e.sourceIp}</span>
                        {e.blocked ? <span className="ml-2 text-xs text-warn">blocked</span> : null}
                        {e.locationHint ? <span className="ml-2 text-xs text-accent">loc</span> : null}
                      </span>
                      <span className="block truncate font-mono text-[11px] text-muted">
                        {e.sourceIp} → {e.destHost}
                      </span>
                    </span>
                    <span className="hidden font-mono text-[11px] text-muted tabular md:block">{e.destIp}</span>
                    <span className="hidden md:block">
                      <Badge tone={pathTone(e.path)}>{PATH_LABEL[e.path]}</Badge>
                    </span>
                    <span className="hidden md:block">
                      <CategoryBadge category={e.category} risk={e.risk} />
                    </span>
                    <span className="flex items-center justify-between gap-2 md:justify-end">
                      <span className="flex gap-1 md:hidden">
                        <Badge tone={pathTone(e.path)}>{PATH_LABEL[e.path]}</Badge>
                        <CategoryBadge category={e.category} risk={e.risk} />
                      </span>
                      <span className="font-mono text-[11px] text-muted tabular">{formatBytes(e.bytes)}</span>
                    </span>
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </div>
    </section>
  );
}
