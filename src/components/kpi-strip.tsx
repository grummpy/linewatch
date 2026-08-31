import { formatBytes } from "@/lib/linewatch/format";
import { startOfDay } from "@/lib/linewatch/selectors";
import { useLinewatch } from "@/lib/linewatch/store";

export function KpiStrip() {
  const events = useLinewatch((s) => s.events);
  const now = useLinewatch((s) => s.now);
  const eventsPerMin = useLinewatch((s) => s.eventsPerMin);
  const running = useLinewatch((s) => s.running);

  const today = events.filter((e) => e.ts >= startOfDay(now || Date.now()));
  const adultToday = today.filter((e) => e.category === "adult").length;
  const sidewalk = today.filter((e) => e.path === "sidewalk").length;
  const wan = today.filter((e) => e.path === "wan").length;
  const loc = today.filter((e) => e.locationHint).length;
  const bytesToday = today.reduce((s, e) => s + e.bytes, 0);

  const items: { label: string; value: string; alert?: boolean }[] = [
    { label: "Events / min", value: running ? String(eventsPerMin) : "0" },
    { label: "Adult today", value: String(adultToday), alert: adultToday > 0 },
    { label: "Sidewalk", value: String(sidewalk) },
    { label: "WAN data", value: String(wan) },
    { label: "Location hits", value: String(loc) },
    { label: "Egress today", value: formatBytes(bytesToday) },
  ];

  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg bg-border md:grid-cols-3 lg:grid-cols-6">
      {items.map((item) => (
        <div key={item.label} className="bg-surface px-4 py-4">
          <dt className="text-[11px] tracking-wide text-subtle uppercase">{item.label}</dt>
          <dd
            className={
              item.alert
                ? "mt-1 font-mono text-2xl tracking-tight text-danger tabular"
                : "mt-1 font-mono text-2xl tracking-tight tabular"
            }
          >
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
