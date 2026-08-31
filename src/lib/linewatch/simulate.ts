import { DESTINATIONS, HOUSEHOLD } from "./catalog";
import {
  classifyHost,
  destRegionFor,
  ipForHost,
  isEventBlocked,
  pathFor,
  riskFor,
} from "./classify";
import { newId } from "./format";
import type { Category, Device, Destination, Protocol, Rules, TrafficEvent } from "./types";

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rng: () => number, items: T[]): T {
  return items[Math.floor(rng() * items.length)] as T;
}

function weighted<T>(rng: () => number, items: { item: T; w: number }[]): T {
  const total = items.reduce((s, x) => s + x.w, 0);
  let r = rng() * total;
  for (const row of items) {
    r -= row.w;
    if (r <= 0) return row.item;
  }
  return items[items.length - 1]!.item;
}

const BY_CAT = DESTINATIONS.reduce(
  (acc, d) => {
    (acc[d.category] ??= []).push(d);
    return acc;
  },
  {} as Record<Category, Destination[]>,
);

const SIDEWALK = DESTINATIONS.filter((d) => d.path === "sidewalk");
const LOCATION = DESTINATIONS.filter((d) => d.locationHint);

function categoryForDevice(device: Device, hour: number, rng: () => number): Category {
  const night = hour >= 21 || hour < 6;
  if (device.kind === "iot") return "cloud";
  if (device.kind === "tv") {
    return weighted(rng, [
      { item: "streaming", w: 70 },
      { item: "ads", w: 10 },
      { item: "cloud", w: 20 },
    ]);
  }
  if (device.kind === "console") {
    return weighted(rng, [
      { item: "gaming", w: 62 },
      { item: "streaming", w: 18 },
      { item: "social", w: 8 },
      { item: "cloud", w: 12 },
      { item: "adult", w: night ? 2.2 : 0.8 },
    ]);
  }
  if (device.role === "child") {
    return weighted(rng, [
      { item: "social", w: night ? 28 : 22 },
      { item: "streaming", w: 18 },
      { item: "gaming", w: 14 },
      { item: "search", w: 6 },
      { item: "education", w: night ? 2 : 8 },
      { item: "cloud", w: 12 },
      { item: "system", w: 8 },
      { item: "ads", w: 6 },
      { item: "messaging", w: 4 },
      { item: "adult", w: night ? 2.4 : 0.7 },
    ]);
  }
  return weighted(rng, [
    { item: "cloud", w: 22 },
    { item: "system", w: 16 },
    { item: "news", w: 10 },
    { item: "shopping", w: 8 },
    { item: "search", w: 10 },
    { item: "streaming", w: 8 },
    { item: "messaging", w: 8 },
    { item: "ads", w: 8 },
    { item: "social", w: 10 },
  ]);
}

function bytesFor(category: Category, rng: () => number): number {
  const base =
    category === "streaming" || category === "gaming"
      ? 80_000 + rng() * 1_800_000
      : category === "ads"
        ? 800 + rng() * 12_000
        : 1_200 + rng() * 90_000;
  return Math.round(base);
}

function protocolFor(category: Category, rng: () => number): { protocol: Protocol; port: number } {
  if (rng() < 0.06) return { protocol: "dns", port: 53 };
  if (category === "streaming" && rng() < 0.45) return { protocol: "quic", port: 443 };
  if (rng() < 0.03) return { protocol: "http", port: 80 };
  return { protocol: "https", port: 443 };
}

function pickDest(device: Device, category: Category, rng: () => number): Destination {
  if (device.kind === "iot" && SIDEWALK.length && rng() < 0.72) {
    return pick(rng, SIDEWALK);
  }
  if ((device.kind === "phone" || device.kind === "tablet") && LOCATION.length && rng() < 0.08) {
    return pick(rng, LOCATION);
  }
  const dests = BY_CAT[category] ?? BY_CAT.unknown ?? DESTINATIONS;
  return pick(rng, dests);
}

export function makeEvent(opts: {
  device: Device;
  dest: Destination;
  ts: number;
  rules: Rules;
  rng?: () => number;
}): TrafficEvent {
  const rng = opts.rng ?? Math.random;
  const { protocol, port } = protocolFor(opts.dest.category, rng);
  const destIp = ipForHost(opts.dest.host);
  const blocked = isEventBlocked({ host: opts.dest.host, device: opts.device, rules: opts.rules });
  const risk = blocked
    ? "ok"
    : riskFor({
        category: opts.dest.category,
        role: opts.device.role,
        ts: opts.ts,
        rules: opts.rules,
      });
  return {
    id: newId("ev"),
    ts: opts.ts,
    deviceId: opts.device.id,
    owner: opts.device.owner,
    sourceIp: opts.device.ip,
    destIp,
    destHost: opts.dest.host,
    destLabel: opts.dest.label,
    destPort: port,
    destRegion: destRegionFor(destIp),
    protocol,
    category: opts.dest.category,
    path: pathFor(opts.dest),
    locationHint: opts.dest.locationHint ?? null,
    bytes: bytesFor(opts.dest.category, rng),
    risk: blocked ? "ok" : risk,
    blocked,
  };
}

export function randomEvent(devices: Device[], rules: Rules, ts: number, rng = Math.random): TrafficEvent {
  const live = devices.filter((d) => !d.blocked || rng() < 0.15);
  const pool = live.length ? live : devices;
  const device = pick(rng, pool);
  const hour = new Date(ts).getHours();
  const category = categoryForDevice(device, hour, rng);
  const dest = pickDest(device, category, rng);
  return makeEvent({ device, dest, ts, rules, rng });
}

export function generateHistory(devices: Device[], rules: Rules, now: number): TrafficEvent[] {
  const rng = mulberry32(now % 1_000_000_007);
  const events: TrafficEvent[] = [];
  const hours = 24;
  for (let h = hours; h >= 0; h--) {
    const hourStart = now - h * 3_600_000;
    const hour = new Date(hourStart).getHours();
    const evening = hour >= 18 && hour <= 23;
    const count = evening ? 28 + Math.floor(rng() * 18) : 10 + Math.floor(rng() * 12);
    for (let i = 0; i < count; i++) {
      const ts = hourStart + Math.floor(rng() * 3_600_000);
      events.push(randomEvent(devices, rules, ts, rng));
    }
  }
  const kids = devices.filter((d) => d.role === "child");
  const adultDests = BY_CAT.adult ?? [];
  if (kids.length && adultDests.length) {
    for (let i = 0; i < 4; i++) {
      const ts = now - (40 + i * 110) * 60_000 - Math.floor(rng() * 20 * 60_000);
      events.push(
        makeEvent({
          device: pick(rng, kids),
          dest: pick(rng, adultDests),
          ts,
          rules,
          rng,
        }),
      );
    }
  }
  events.sort((a, b) => a.ts - b.ts);
  return events.slice(-700);
}

export function adultSample(devices: Device[], rules: Rules, ts: number): TrafficEvent | null {
  const kids = devices.filter((d) => d.role === "child" && !d.blocked);
  const dests = BY_CAT.adult ?? [];
  if (!kids.length || !dests.length) return null;
  const device = kids[Math.floor(Math.random() * kids.length)]!;
  const dest = dests[Math.floor(Math.random() * dests.length)]!;
  return makeEvent({ device, dest, ts, rules });
}

export function eventFromLog(opts: {
  host: string;
  sourceIp: string;
  ts: number;
  devices: Device[];
  rules: Rules;
}): TrafficEvent {
  const dest = classifyHost(opts.host);
  const device =
    opts.devices.find((d) => d.ip === opts.sourceIp) ??
    ({
      id: `dev-unknown-${opts.sourceIp}`,
      name: `Unknown · ${opts.sourceIp}`,
      owner: "Unknown",
      role: "shared" as const,
      ip: opts.sourceIp,
      mac: "—",
      kind: "iot" as const,
      blocked: false,
      lastSeen: opts.ts,
    } satisfies Device);
  return makeEvent({ device, dest, ts: opts.ts, rules: opts.rules });
}

export { HOUSEHOLD };
