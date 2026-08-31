/**
 * Linewatch — household outbound watch
 * Copyright (c) 2026 Chris Decker
 */
import { DESTINATIONS } from "./catalog";
import { decideDns } from "./policy";
import type { Category, Destination, Device, PathKind, Risk, Rules } from "./types";

const SORTED = [...DESTINATIONS].sort((a, b) => b.host.length - a.host.length);

const REGIONS = [
  "Ashburn, VA (server)",
  "Columbus, OH (server)",
  "Boardman, OR (server)",
  "Council Bluffs, IA (server)",
  "Dublin, IE (server)",
  "Frankfurt, DE (server)",
  "Singapore (server)",
  "Dallas, TX (server)",
];

export function normalizeHost(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/:\d+$/, "")
    .replace(/^www\./, "");
}

export function classifyHost(host: string): Destination {
  const h = normalizeHost(host);
  for (const dest of SORTED) {
    if (h === dest.host || h.endsWith(`.${dest.host}`)) return dest;
  }
  return { host: h || "unknown", category: "unknown", label: h || "Unknown", path: "wan" };
}

export function pathFor(dest: Destination): PathKind {
  return dest.path ?? "wan";
}

export function ipForHost(host: string): string {
  const known: Record<string, string> = {
    "google.com": "142.250.72.110",
    "googleapis.com": "142.250.72.74",
    "youtube.com": "142.250.72.46",
    "icloud.com": "17.248.148.10",
    "apple.com": "17.253.144.10",
    "cloudflare.com": "104.16.132.229",
    "netflix.com": "52.41.18.88",
    "pornhub.com": "66.254.114.41",
    "xvideos.com": "185.88.181.2",
    "onlyfans.com": "104.18.32.47",
    "instagram.com": "157.240.22.174",
    "tiktok.com": "23.205.68.27",
    "xboxlive.com": "13.107.42.14",
    "discord.com": "162.159.136.232",
    "sidewalk.amazonaws.com": "52.94.133.17",
    "ring.com": "52.46.146.81",
    "alexa.amazon.com": "52.94.232.41",
    "location.apple.com": "17.248.192.60",
    "maps.googleapis.com": "142.250.72.202",
  };
  const h = normalizeHost(host);
  for (const [suffix, ip] of Object.entries(known)) {
    if (h === suffix || h.endsWith(`.${suffix}`)) return ip;
  }
  let hash = 2166136261;
  for (let i = 0; i < h.length; i++) {
    hash ^= h.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const a = 20 + (hash >>> 24) % 200;
  const b = (hash >>> 16) & 255;
  const c = (hash >>> 8) & 255;
  const d = 4 + (hash & 247);
  return `${a}.${b}.${c}.${d}`;
}

export function destRegionFor(ip: string): string {
  let hash = 0;
  for (let i = 0; i < ip.length; i++) hash = (hash * 33 + ip.charCodeAt(i)) >>> 0;
  return REGIONS[hash % REGIONS.length]!;
}

export function isQuietHour(ts: number, rules: Rules): boolean {
  const hour = new Date(ts).getHours();
  const { quietStartHour, quietEndHour } = rules;
  if (quietStartHour === quietEndHour) return false;
  if (quietStartHour > quietEndHour) {
    return hour >= quietStartHour || hour < quietEndHour;
  }
  return hour >= quietStartHour && hour < quietEndHour;
}

export function riskFor(opts: {
  category: Category;
  role: "parent" | "child" | "shared" | "iot";
  ts: number;
  rules: Rules;
  reason?: string;
  blocked?: boolean;
}): Risk {
  const { category, role, ts, rules, reason, blocked } = opts;
  if (category === "adult" && rules.alertAdult && (role === "child" || role === "shared")) return "alert";
  if (category === "vpn" && role === "child") return "alert";
  if (reason === "dga-entropy" || reason === "quarantine") return "alert";
  if (blocked && (reason === "homework" || reason === "bedtime")) return "watch";
  if (
    category === "social" &&
    role === "child" &&
    rules.alertAfterHoursSocial &&
    isQuietHour(ts, rules)
  ) {
    return "watch";
  }
  return "ok";
}

export function hostOnBlocklist(host: string, blocklist: string[]): boolean {
  const h = normalizeHost(host);
  return blocklist.some((entry) => {
    const e = normalizeHost(entry);
    return h === e || h.endsWith(`.${e}`);
  });
}

export function isEventBlocked(opts: { host: string; device: Device; rules: Rules; ts?: number; category?: Category }): boolean {
  const dest = classifyHost(opts.host);
  const decision = decideDns({
    host: opts.host,
    device: opts.device,
    rules: opts.rules,
    ts: opts.ts ?? Date.now(),
    category: opts.category ?? dest.category,
  });
  return decision.action === "blocked";
}

const DNS_QUERY =
  /(?:query\[A(?:AAA)?\]\s+)?([a-z0-9.-]+\.[a-z]{2,})\s+from\s+((?:\d{1,3}\.){3}\d{1,3})/i;
const CSV_LINE = /^([^,]+),((?:\d{1,3}\.){3}\d{1,3}),([a-z0-9.-]+\.[a-z]{2,})\s*$/i;
const SIMPLE = /((?:\d{1,3}\.){3}\d{1,3})\s+([a-z0-9.-]+\.[a-z]{2,})/i;

export type ParsedLogLine = {
  host: string;
  sourceIp: string;
  ts?: number;
};

export function parseLogLine(line: string): ParsedLogLine | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return null;
  const csv = trimmed.match(CSV_LINE);
  if (csv) {
    const ts = Date.parse(csv[1] ?? "");
    return {
      host: csv[3] ?? "",
      sourceIp: csv[2] ?? "",
      ts: Number.isFinite(ts) ? ts : undefined,
    };
  }
  const dns = trimmed.match(DNS_QUERY);
  if (dns && dns[1] && dns[2]) {
    return { host: dns[1], sourceIp: dns[2] };
  }
  const simple = trimmed.match(SIMPLE);
  if (simple && simple[1] && simple[2]) {
    return { host: simple[2], sourceIp: simple[1] };
  }
  return null;
}
