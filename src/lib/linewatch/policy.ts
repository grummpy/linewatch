/**
 * Linewatch — household outbound watch
 * Copyright (c) 2026 Chris Decker
 *
 * Browser copy of collector/lib/policy.mjs so the desk and demo match house DNS.
 */
import { DESTINATIONS } from "./catalog";
import type { Category, Device, DnsAction, InsightReport, Rules } from "./types";
import { SYSTEM_HOSTS } from "./types";

export type DnsDecision = {
  action: DnsAction;
  reason: string;
  category: Category;
  rewriteHost?: string;
  rewriteIp?: string;
  entropy: number;
  dga: boolean;
  vpn: boolean;
};

const ADULT = DESTINATIONS.filter((d) => d.category === "adult").map((d) => d.host);
const SOCIAL = DESTINATIONS.filter((d) => d.category === "social").map((d) => d.host);
const GAMING = DESTINATIONS.filter((d) => d.category === "gaming").map((d) => d.host);
const VPN = DESTINATIONS.filter((d) => d.category === "vpn").map((d) => d.host);

const SAFE_SEARCH: Record<string, { host: string; ip: string }> = {
  "google.com": { host: "forcesafesearch.google.com", ip: "216.239.38.120" },
  "bing.com": { host: "strict.bing.com", ip: "204.79.197.200" },
  "duckduckgo.com": { host: "safe.duckduckgo.com", ip: "52.250.42.157" },
  "youtube.com": { host: "restrict.youtube.com", ip: "216.239.38.119" },
};

export function normalizeHost(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/\.$/, "")
    .replace(/:\d+$/, "")
    .replace(/^www\./, "");
}

export function hostOnList(host: string, list: string[]): boolean {
  const h = normalizeHost(host);
  return list.some((entry) => {
    const e = normalizeHost(entry);
    return h === e || h.endsWith(`.${e}`);
  });
}

export function shannonEntropy(s: string): number {
  if (!s) return 0;
  const freq = new Map<string, number>();
  for (const ch of s) freq.set(ch, (freq.get(ch) ?? 0) + 1);
  let h = 0;
  for (const n of freq.values()) {
    const p = n / s.length;
    h -= p * Math.log2(p);
  }
  return h;
}

export function dgaScore(host: string): { entropy: number; flagged: boolean } {
  const h = normalizeHost(host);
  const parts = h.split(".").filter(Boolean);
  const label = parts.length >= 2 ? parts[parts.length - 2]! : parts[0] || "";
  const entropy = shannonEntropy(label);
  const digits = (label.match(/\d/g) || []).length;
  const vowels = (label.match(/[aeiou]/g) || []).length;
  const known = hostOnList(h, [...ADULT, ...SOCIAL, ...GAMING, ...VPN, ...SYSTEM_HOSTS]);
  const hexish = /^[0-9a-f]{12,}$/i.test(label);
  const longRandom = label.length >= 10 && entropy >= 3.5;
  const fewVowels = label.length >= 10 && vowels <= 1 && entropy >= 3.2;
  const flagged = !known && (hexish || longRandom || fewVowels || (digits >= 4 && label.length >= 10 && entropy >= 3.3));
  return { entropy: Number(entropy.toFixed(3)), flagged };
}

export function inHourWindow(hour: number, start: number, end: number): boolean {
  if (start === end) return false;
  if (start > end) return hour >= start || hour < end;
  return hour >= start && hour < end;
}

function classifyFromLists(host: string, fallback: Category): Category {
  if (hostOnList(host, ADULT)) return "adult";
  if (hostOnList(host, VPN)) return "vpn";
  if (hostOnList(host, SOCIAL)) return "social";
  if (hostOnList(host, GAMING)) return "gaming";
  return fallback;
}

export function autoQuarantineOn(rules: Rules, owner: string, role: Device["role"]): boolean {
  if (owner in rules.profileQuarantine) return Boolean(rules.profileQuarantine[owner]);
  if (role === "child") return rules.autoQuarantine;
  return false;
}

export function decideDns(opts: { host: string; device: Device; rules: Rules; ts: number; category: Category }): DnsDecision {
  const { host, device, rules, ts } = opts;
  const h = normalizeHost(host);
  const dga = dgaScore(h);
  const category = classifyFromLists(h, opts.category);
  const vpn = category === "vpn";
  const hour = new Date(ts).getHours();
  const child = device.role === "child" || device.role === "shared";

  const out = (action: DnsAction, reason: string, extra: Partial<DnsDecision> = {}): DnsDecision => ({
    action,
    reason,
    category: vpn ? "vpn" : category,
    entropy: dga.entropy,
    dga: dga.flagged,
    vpn,
    ...extra,
  });

  if (device.blocked || device.quarantined) return out("blocked", device.quarantined ? "quarantine" : "device-disabled");
  if (child && vpn) return out("blocked", "vpn-doh");

  const allow = [...rules.houseAllowlist, ...(rules.keepSystemUpdates ? SYSTEM_HOSTS : [])];
  if (hostOnList(h, allow)) {
    const safe = child && rules.safeSearch ? SAFE_SEARCH[h] : undefined;
    if (safe) return out("rewritten", "safe-search", { rewriteHost: safe.host, rewriteIp: safe.ip, category: "search" });
    return out("allowed", "allowlist");
  }

  const person = rules.personBlocks[device.owner] ?? [];
  if (hostOnList(h, person)) return out("blocked", "profile-blocklist");
  if (hostOnList(h, rules.blocklist) || hostOnList(h, ADULT) && rules.blockAdult && child) {
    if (hostOnList(h, ADULT) && rules.blockAdult && child) return out("blocked", "category-adult");
    if (hostOnList(h, rules.blocklist)) return out("blocked", "global-blocklist");
  }

  if (child) {
    if (vpn) return out("blocked", "vpn-doh");
    if (dga.flagged) return out("blocked", "dga-entropy");
    if (category === "adult" && rules.blockAdult) return out("blocked", "category-adult");
    if (category === "gaming" && rules.blockGaming) return out("blocked", "category-gaming");
    if (category === "social" && rules.blockSocial) return out("blocked", "category-social");
    if (rules.bedtimeOn && inHourWindow(hour, rules.quietStartHour, rules.quietEndHour) && ["social", "gaming", "streaming"].includes(category)) {
      return out("blocked", "bedtime");
    }
    if (rules.homeworkOn && inHourWindow(hour, rules.homeworkStartHour, rules.homeworkEndHour) && ["gaming", "social"].includes(category)) {
      return out("blocked", "homework");
    }
  }

  if (rules.firewallMode === "whitelist") return out("blocked", "whitelist");

  const safe = child && rules.safeSearch ? SAFE_SEARCH[h] : undefined;
  if (safe) return out("rewritten", "safe-search", { rewriteHost: safe.host, rewriteIp: safe.ip, category: "search" });
  return out("allowed", "ok");
}

export function sentenceForEvent(opts: {
  owner: string;
  host: string;
  category: Category;
  reason?: string;
  count?: number;
  mins?: number;
  deviceName?: string;
}): string {
  const who = opts.deviceName || opts.owner;
  const n = opts.count ?? 1;
  const mins = opts.mins ?? 10;
  if (opts.reason === "quarantine") return `${who} is in digital quarantine until you review it.`;
  if (opts.category === "adult" && n > 1) return `${who} tried ${opts.host} ${n} times in ${mins} minutes. Linewatch blocked it.`;
  if (opts.category === "adult") return `${who} asked for ${opts.host}. Linewatch blocked adult content.`;
  if (opts.reason === "vpn-doh" || opts.category === "vpn") return `${who} tried a VPN or private DNS (${opts.host}). That is a bypass — blocked.`;
  if (opts.reason === "dga-entropy") return `${who} hit a high-randomness name (${opts.host}). Looks like malware or a bypass.`;
  if (opts.reason === "homework") return `${who} hit ${opts.host} during homework time. Blocked.`;
  if (opts.reason === "bedtime") return `${who} hit ${opts.host} after bedtime. Blocked.`;
  if (opts.reason === "scan") return opts.host;
  return `${who} · ${opts.host}`;
}

export function buildInsights(
  events: { ts: number; destHost: string; owner: string; category: Category; blocked: boolean; reason?: string; sourceIp: string }[],
  now: number,
): InsightReport {
  const day = now - 24 * 60 * 60 * 1000;
  const rows = events.filter((e) => e.ts >= day);
  const blocked = rows.filter((r) => r.blocked);
  const adult = blocked.filter((r) => r.category === "adult");
  const vpn = blocked.filter((r) => r.category === "vpn" || r.reason === "vpn-doh");
  const dga = blocked.filter((r) => r.reason === "dga-entropy");
  const bedtime = blocked.filter((r) => r.reason === "bedtime");
  const homework = blocked.filter((r) => r.reason === "homework");
  const byHost = new Map<string, { host: string; count: number; people: Set<string> }>();
  for (const r of blocked) {
    const cur = byHost.get(r.destHost) ?? { host: r.destHost, count: 0, people: new Set<string>() };
    cur.count += 1;
    cur.people.add(r.owner);
    byHost.set(r.destHost, cur);
  }
  const topBlocked = [...byHost.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)
    .map((x) => ({ host: x.host, count: x.count, people: [...x.people] }));
  const keyHits = new Map<string, number[]>();
  for (const r of blocked) {
    const k = `${r.owner}|${r.destHost}`;
    const arr = keyHits.get(k) ?? [];
    arr.push(r.ts);
    keyHits.set(k, arr);
  }
  const repeatOffenders: InsightReport["repeatOffenders"] = [];
  for (const [k, times] of keyHits) {
    const sorted = times.sort((a, b) => a - b);
    for (let i = 0; i < sorted.length; i++) {
      const window = sorted.filter((t) => t >= sorted[i]! && t <= sorted[i]! + 10 * 60_000);
      if (window.length >= 3) {
        const [owner, host] = k.split("|") as [string, string];
        repeatOffenders.push({
          owner,
          host,
          count: window.length,
          sentence: sentenceForEvent({ owner, host, category: "adult", count: window.length, mins: 10 }),
        });
        break;
      }
    }
  }
  const sentences: string[] = [];
  if (adult.length) sentences.push(`${adult.length} adult ${adult.length === 1 ? "ask" : "asks"} blocked in the last day.`);
  if (repeatOffenders.length) sentences.push(`${repeatOffenders.length} device${repeatOffenders.length === 1 ? "" : "s"} hammered a blocked name.`);
  if (vpn.length) sentences.push(`${vpn.length} VPN / private-DNS bypass ${vpn.length === 1 ? "try" : "tries"}.`);
  if (dga.length) sentences.push(`${dga.length} high-randomness name${dga.length === 1 ? "" : "s"} (possible malware).`);
  if (homework.length) sentences.push(`${homework.length} homework-time block${homework.length === 1 ? "" : "s"}.`);
  if (bedtime.length) sentences.push(`${bedtime.length} after bedtime.`);
  if (!sentences.length) sentences.push("Quiet day. No repeated blocks.");
  return {
    date: new Date(now).toISOString().slice(0, 10),
    queries: rows.length,
    blocked: blocked.length,
    adultAttempts: adult.length,
    vpnAttempts: vpn.length,
    dgaFlags: dga.length,
    bedtimeHits: bedtime.length,
    homeworkHits: homework.length,
    topBlocked,
    repeatOffenders: repeatOffenders.slice(0, 8),
    sentences,
  };
}

export function rulesToCollectorPolicy(rules: Rules, devices: Device[]) {
  const profiles: Record<string, { role: string; autoQuarantine: boolean; blocks: string[] }> = {};
  for (const d of devices) {
    if (!profiles[d.owner]) {
      profiles[d.owner] = {
        role: d.role,
        autoQuarantine: autoQuarantineOn(rules, d.owner, d.role),
        blocks: rules.personBlocks[d.owner] ?? [],
      };
    }
  }
  const quarantine: Record<string, { since: number; reason: string; untilReview: boolean }> = {};
  for (const d of devices) {
    if (d.quarantined) {
      quarantine[d.mac.toLowerCase()] = {
        since: Date.now(),
        reason: d.quarantineReason || "isolated",
        untilReview: true,
      };
    }
  }
  return {
    firewallMode: rules.firewallMode,
    safeSearch: rules.safeSearch,
    bedtimeOn: rules.bedtimeOn,
    bedtimeStart: rules.quietStartHour,
    bedtimeEnd: rules.quietEndHour,
    homeworkOn: rules.homeworkOn,
    homeworkStart: rules.homeworkStartHour,
    homeworkEnd: rules.homeworkEndHour,
    blockAdult: rules.blockAdult,
    blockGaming: rules.blockGaming,
    blockSocial: rules.blockSocial,
    autoQuarantine: rules.autoQuarantine,
    keepSystemUpdates: rules.keepSystemUpdates,
    blocklistGlobal: [...new Set([...rules.blocklist, ...(rules.blockAdult ? ADULT : [])])],
    allowlist: rules.houseAllowlist,
    profiles,
    devices: devices.map((d) => ({ ip: d.ip, mac: d.mac, name: d.name, owner: d.owner, role: d.role, blocked: d.blocked })),
    quarantine,
  };
}
