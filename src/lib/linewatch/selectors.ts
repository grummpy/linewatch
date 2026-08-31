import { CATEGORY_LABEL, type Alert, type ArchiveRow, type Category, type Device, type FeedFilter, type PathKind, type TrafficEvent } from "./types";

export function deviceById(devices: Device[], id: string): Device | undefined {
  return devices.find((d) => d.id === id);
}

export function owners(devices: Device[]): string[] {
  const seen: string[] = [];
  for (const d of devices) {
    if (!seen.includes(d.owner)) seen.push(d.owner);
  }
  return seen;
}

export function visibleEvents(
  events: TrafficEvent[],
  devices: Device[],
  filter: FeedFilter,
  person: string,
): TrafficEvent[] {
  const kids = new Set(devices.filter((d) => d.role === "child").map((d) => d.id));
  return events.filter((e) => {
    if (person !== "all" && e.owner !== person) return false;
    if (filter === "adult") return e.category === "adult";
    if (filter === "kids") return kids.has(e.deviceId);
    if (filter === "blocked") return e.blocked;
    if (filter === "sidewalk") return e.path === "sidewalk";
    if (filter === "wan") return e.path === "wan";
    if (filter === "location") return Boolean(e.locationHint);
    return true;
  });
}

export function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function categoryCounts(events: TrafficEvent[]): { category: Category; count: number; bytes: number }[] {
  const map = new Map<Category, { count: number; bytes: number }>();
  for (const e of events) {
    const cur = map.get(e.category) ?? { count: 0, bytes: 0 };
    cur.count += 1;
    cur.bytes += e.bytes;
    map.set(e.category, cur);
  }
  return [...map.entries()]
    .map(([category, v]) => ({ category, ...v }))
    .sort((a, b) => b.count - a.count);
}

export function hourlyBuckets(events: TrafficEvent[], now: number): { hour: string; count: number; adult: number }[] {
  const buckets = Array.from({ length: 24 }, (_, i) => {
    const t = new Date(now);
    t.setMinutes(0, 0, 0);
    t.setHours(t.getHours() - (23 - i));
    return {
      key: t.getTime(),
      hour: t.toLocaleTimeString(undefined, { hour: "numeric" }),
      count: 0,
      adult: 0,
    };
  });
  for (const e of events) {
    const b = buckets.find((x) => e.ts >= x.key && e.ts < x.key + 3_600_000);
    if (!b) continue;
    b.count += 1;
    if (e.category === "adult") b.adult += 1;
  }
  return buckets.map(({ hour, count, adult }) => ({ hour, count, adult }));
}

export function deviceStats(events: TrafficEvent[], devices: Device[]) {
  return devices
    .map((d) => {
      const mine = events.filter((e) => e.deviceId === d.id);
      return {
        device: d,
        count: mine.length,
        bytes: mine.reduce((s, e) => s + e.bytes, 0),
        adult: mine.filter((e) => e.category === "adult").length,
        sidewalk: mine.filter((e) => e.path === "sidewalk").length,
        location: mine.filter((e) => e.locationHint).length,
        last: mine.length ? mine[mine.length - 1] : undefined,
      };
    })
    .sort((a, b) => b.count - a.count);
}

export function personStats(events: TrafficEvent[], devices: Device[]) {
  return owners(devices).map((owner) => {
    const mineDev = devices.filter((d) => d.owner === owner);
    const mine = events.filter((e) => e.owner === owner);
    const role = mineDev[0]?.role ?? "shared";
    return {
      owner,
      role,
      devices: mineDev,
      count: mine.length,
      bytes: mine.reduce((s, e) => s + e.bytes, 0),
      adult: mine.filter((e) => e.category === "adult").length,
      sidewalk: mine.filter((e) => e.path === "sidewalk").length,
      wan: mine.filter((e) => e.path === "wan").length,
      location: mine.filter((e) => e.locationHint).length,
      last: mine.length ? mine[mine.length - 1] : undefined,
    };
  });
}

export type SiteRow = {
  host: string;
  label: string;
  category: Category;
  path: PathKind;
  locationHint: string | null;
  count: number;
  bytes: number;
  people: string[];
  lastTs: number;
};

export function siteLog(events: TrafficEvent[]): SiteRow[] {
  const map = new Map<string, SiteRow>();
  for (const e of events) {
    const cur = map.get(e.destHost) ?? {
      host: e.destHost,
      label: e.destLabel,
      category: e.category,
      path: e.path,
      locationHint: e.locationHint,
      count: 0,
      bytes: 0,
      people: [],
      lastTs: 0,
    };
    cur.count += 1;
    cur.bytes += e.bytes;
    if (!cur.people.includes(e.owner)) cur.people.push(e.owner);
    if (e.ts > cur.lastTs) cur.lastTs = e.ts;
    map.set(e.destHost, cur);
  }
  return [...map.values()].sort((a, b) => b.count - a.count);
}

export function unacked(alerts: Alert[]): Alert[] {
  return alerts.filter((a) => !a.acknowledged);
}

export function archiveToCsv(rows: ArchiveRow[]): string {
  const header = [
    "Time",
    "Owner",
    "Device",
    "Source IP",
    "Host",
    "Dest IP",
    "Server region",
    "Genre",
    "Path",
    "Location",
    "Bytes",
    "Blocked",
  ];
  const lines = rows.map((r) =>
    [
      new Date(r.ts).toISOString(),
      r.owner,
      r.device,
      r.sourceIp,
      r.destHost,
      r.destIp,
      r.destRegion,
      r.genre,
      r.path,
      r.locationHint ?? "",
      r.bytes,
      r.blocked ? "yes" : "no",
    ]
      .map((v) => {
        const s = String(v);
        return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
      })
      .join(","),
  );
  return [header.join(","), ...lines].join("\n");
}

export function eventsToArchiveRows(events: TrafficEvent[], devices: Device[]): ArchiveRow[] {
  return events.map((e) => ({
    ts: e.ts,
    owner: e.owner,
    device: deviceById(devices, e.deviceId)?.name ?? e.deviceId,
    sourceIp: e.sourceIp,
    destHost: e.destHost,
    destIp: e.destIp,
    destRegion: e.destRegion,
    genre: CATEGORY_LABEL[e.category],
    path: e.path,
    locationHint: e.locationHint,
    bytes: e.bytes,
    blocked: e.blocked,
  }));
}
