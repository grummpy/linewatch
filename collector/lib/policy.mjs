/**
 * Linewatch DNS policy
 * Copyright (c) 2026 Chris Decker
 *
 * Domain-level inspection only. Decide allow / block / safe-search rewrite.
 * Tables: logs, blocklist_global, blocklist_profile (adult / gaming / social).
 */
export const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export const ADULT = [
  "pornhub.com",
  "xvideos.com",
  "xnxx.com",
  "xhamster.com",
  "onlyfans.com",
  "chaturbate.com",
  "spankbang.com",
  "redtube.com",
  "youporn.com",
  "nhentai.net",
  "rule34.xxx",
  "pornhd.com",
  "brazzers.com",
  "xhamsterlive.com",
  "pornhubpremium.com",
  "xvideos.es",
  "missav.com",
  "javdb.com",
];

export const SOCIAL = [
  "instagram.com",
  "cdninstagram.com",
  "tiktok.com",
  "tiktokv.com",
  "snapchat.com",
  "discord.com",
  "discord.gg",
  "reddit.com",
  "twitter.com",
  "x.com",
  "facebook.com",
  "threads.net",
];

export const GAMING = [
  "xboxlive.com",
  "xbox.com",
  "playstation.com",
  "steampowered.com",
  "steamcommunity.com",
  "epicgames.com",
  "roblox.com",
  "minecraft.net",
  "twitch.tv",
  "riotgames.com",
  "ea.com",
  "activision.com",
];

export const VPN = [
  "dns.google",
  "cloudflare-dns.com",
  "dns.quad9.net",
  "mozilla.cloudflare-dns.com",
  "nordvpn.com",
  "expressvpn.com",
  "protonvpn.com",
  "proton.me",
  "surfshark.com",
  "mullvad.net",
  "windscribe.com",
  "privateinternetaccess.com",
  "hotspotshield.com",
  "cyberghostvpn.com",
  "tunnelbear.com",
  "doh.opendns.com",
  "dns.adguard.com",
  "mask.icloud.com",
  "mask-h2.icloud.com",
  "one.one.one.one",
  "dns.nextdns.io",
  "doh.dns.apple.com",
];

export const SYSTEM = [
  "apple.com",
  "icloud.com",
  "icloud-content.com",
  "mzstatic.com",
  "google.com",
  "googleapis.com",
  "gstatic.com",
  "windowsupdate.com",
  "microsoft.com",
  "live.com",
  "cloudflare.com",
];

const SAFE_SEARCH = {
  "google.com": { host: "forcesafesearch.google.com", ip: "216.239.38.120" },
  "www.google.com": { host: "forcesafesearch.google.com", ip: "216.239.38.120" },
  "google.com.hk": { host: "forcesafesearch.google.com", ip: "216.239.38.120" },
  "bing.com": { host: "strict.bing.com", ip: "204.79.197.200" },
  "www.bing.com": { host: "strict.bing.com", ip: "204.79.197.200" },
  "duckduckgo.com": { host: "safe.duckduckgo.com", ip: "52.250.42.157" },
  "www.duckduckgo.com": { host: "safe.duckduckgo.com", ip: "52.250.42.157" },
  "youtube.com": { host: "restrict.youtube.com", ip: "216.239.38.119" },
  "www.youtube.com": { host: "restrict.youtube.com", ip: "216.239.38.119" },
  "m.youtube.com": { host: "restrict.youtube.com", ip: "216.239.38.119" },
  "youtu.be": { host: "restrict.youtube.com", ip: "216.239.38.119" },
};

export function normalizeHost(raw) {
  return String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/\.$/, "")
    .replace(/:\d+$/, "")
    .replace(/^www\./, "");
}

export function hostMatch(host, list) {
  const h = normalizeHost(host);
  return list.some((entry) => {
    const e = normalizeHost(entry);
    return h === e || h.endsWith(`.${e}`);
  });
}

export function classifyDomain(host) {
  const h = normalizeHost(host);
  if (hostMatch(h, ADULT)) return "adult";
  if (hostMatch(h, VPN)) return "vpn";
  if (hostMatch(h, SOCIAL)) return "social";
  if (hostMatch(h, GAMING)) return "gaming";
  if (hostMatch(h, SYSTEM)) return "system";
  if (h.includes("youtube") || h.includes("netflix") || h.includes("spotify")) return "streaming";
  if (h.includes("google") || h.includes("bing") || h.includes("duckduckgo")) return "search";
  return "unknown";
}

/** Shannon entropy of a label. Chris Decker: DGA-looking names look random. */
export function shannonEntropy(s) {
  if (!s) return 0;
  const freq = new Map();
  for (const ch of s) freq.set(ch, (freq.get(ch) || 0) + 1);
  let h = 0;
  for (const n of freq.values()) {
    const p = n / s.length;
    h -= p * Math.log2(p);
  }
  return h;
}

const COMMON = /^(the|and|for|app|cdn|api|img|static|media|news|mail|shop|play|live|home|game|video|cloud|secure|login|account|update|windows|google|apple|amazon|microsoft|facebook|instagram|youtube)$/;

export function dgaScore(host) {
  const h = normalizeHost(host);
  const parts = h.split(".").filter(Boolean);
  const label = parts.length >= 2 ? parts[parts.length - 2] : parts[0] || "";
  const entropy = shannonEntropy(label);
  const digits = (label.match(/\d/g) || []).length;
  const vowels = (label.match(/[aeiou]/g) || []).length;
  const hexish = /^[0-9a-f]{12,}$/i.test(label);
  const longRandom = label.length >= 10 && entropy >= 3.5 && !COMMON.test(label);
  const fewVowels = label.length >= 10 && vowels <= 1 && entropy >= 3.2;
  const flagged = !hostMatch(h, [...ADULT, ...SOCIAL, ...GAMING, ...VPN, ...SYSTEM]) && (hexish || longRandom || fewVowels || (digits >= 4 && label.length >= 10 && entropy >= 3.3));
  return { entropy: Number(entropy.toFixed(3)), flagged, label, digits };
}

export function inWindow(hour, start, end) {
  if (start === end) return false;
  if (start > end) return hour >= start || hour < end;
  return hour >= start && hour < end;
}

export function defaultPolicy() {
  return {
    firewallMode: "blacklist",
    safeSearch: true,
    bedtimeOn: true,
    bedtimeStart: 21,
    bedtimeEnd: 7,
    bedtimeBlock: ["social", "gaming", "streaming"],
    homeworkOn: false,
    homeworkStart: 16,
    homeworkEnd: 18,
    homeworkBlock: ["gaming", "social"],
    blockAdult: true,
    blockGaming: false,
    blockSocial: false,
    autoQuarantine: true,
    keepSystemUpdates: true,
    blocklistGlobal: [...ADULT],
    allowlist: [...SYSTEM],
    profiles: {},
    devices: [],
    quarantine: {},
  };
}

export function mergePolicy(saved) {
  const base = defaultPolicy();
  if (!saved || typeof saved !== "object") return base;
  return {
    ...base,
    ...saved,
    bedtimeBlock: saved.bedtimeBlock ?? base.bedtimeBlock,
    homeworkBlock: saved.homeworkBlock ?? base.homeworkBlock,
    blocklistGlobal: Array.isArray(saved.blocklistGlobal) ? saved.blocklistGlobal : base.blocklistGlobal,
    allowlist: Array.isArray(saved.allowlist) ? saved.allowlist : base.allowlist,
    profiles: saved.profiles && typeof saved.profiles === "object" ? saved.profiles : {},
    devices: Array.isArray(saved.devices) ? saved.devices : [],
    quarantine: saved.quarantine && typeof saved.quarantine === "object" ? saved.quarantine : {},
  };
}

function profileOf(policy, owner) {
  const p = policy.profiles?.[owner] || {};
  const role = p.role || "child";
  const auto =
    typeof p.autoQuarantine === "boolean" ? p.autoQuarantine : role === "child" ? policy.autoQuarantine !== false : false;
  return {
    role,
    autoQuarantine: auto,
    blocks: Array.isArray(p.blocks) ? p.blocks : [],
    blockAdult: p.blockAdult ?? policy.blockAdult,
    blockGaming: p.blockGaming ?? policy.blockGaming,
    blockSocial: p.blockSocial ?? policy.blockSocial,
  };
}

export function findDevice(policy, sourceIp, mac) {
  const devices = policy.devices || [];
  if (mac) {
    const m = devices.find((d) => (d.mac || "").toLowerCase() === mac.toLowerCase());
    if (m) return m;
  }
  return devices.find((d) => d.ip === sourceIp) || null;
}

/**
 * @returns {{ action: "allowed"|"blocked"|"rewritten", reason: string, category: string, rewriteHost?: string, rewriteIp?: string, entropy: number, dga: boolean, vpn: boolean, owner: string, mac: string, role: string }}
 */
export function decide(policy, host, sourceIp, ts = Date.now(), mac = "") {
  const p = mergePolicy(policy);
  const h = normalizeHost(host);
  const category = classifyDomain(h);
  const dga = dgaScore(h);
  const vpn = category === "vpn" || hostMatch(h, VPN);
  const device = findDevice(p, sourceIp, mac);
  const owner = device?.owner || "Unknown";
  const prof = profileOf(p, owner);
  const role = device?.role || prof.role || "shared";
  const deviceMac = (mac || device?.mac || "").toLowerCase();
  const hour = new Date(ts).getHours();

  const result = (action, reason, extra = {}) => ({
    action,
    reason,
    category: vpn ? "vpn" : dga.flagged && category === "unknown" ? "unknown" : category,
    entropy: dga.entropy,
    dga: dga.flagged,
    vpn,
    owner,
    mac: deviceMac,
    role,
    rewriteHost: extra.rewriteHost,
    rewriteIp: extra.rewriteIp,
  });

  if (device?.blocked) return result("blocked", "device-disabled");
  if (deviceMac && p.quarantine[deviceMac]) return result("blocked", "quarantine");

  if ((role === "child" || role === "shared") && vpn) return result("blocked", "vpn-doh");

  const systemOk = p.keepSystemUpdates && hostMatch(h, SYSTEM);
  if (hostMatch(h, p.allowlist) || systemOk) {
    if (p.safeSearch && role === "child" && SAFE_SEARCH[h]) {
      const s = SAFE_SEARCH[h];
      return result("rewritten", "safe-search", { rewriteHost: s.host, rewriteIp: s.ip });
    }
    return result("allowed", "allowlist");
  }

  if (hostMatch(h, prof.blocks)) return result("blocked", "profile-blocklist");
  if (hostMatch(h, p.blocklistGlobal)) return result("blocked", category === "adult" ? "global-adult" : "global-blocklist");

  if (role === "child" || role === "shared") {
    if (vpn) return result("blocked", "vpn-doh");
    if (dga.flagged) return result("blocked", "dga-entropy");
    if (category === "adult" && prof.blockAdult !== false) return result("blocked", "category-adult");
    if (category === "gaming" && prof.blockGaming) return result("blocked", "category-gaming");
    if (category === "social" && prof.blockSocial) return result("blocked", "category-social");
    if (p.bedtimeOn && inWindow(hour, p.bedtimeStart, p.bedtimeEnd) && p.bedtimeBlock.includes(category)) {
      return result("blocked", "bedtime");
    }
    if (p.homeworkOn && inWindow(hour, p.homeworkStart, p.homeworkEnd) && p.homeworkBlock.includes(category)) {
      return result("blocked", "homework");
    }
  }

  if (p.firewallMode === "whitelist") return result("blocked", "whitelist");

  if (p.safeSearch && role === "child" && SAFE_SEARCH[h]) {
    const s = SAFE_SEARCH[h];
    return result("rewritten", "safe-search", { rewriteHost: s.host, rewriteIp: s.ip });
  }

  return result("allowed", "ok");
}

export function shouldAlert(decision, role) {
  if (decision.reason === "quarantine") return { yes: true, severity: "high", kind: "quarantine" };
  if (decision.category === "adult" && (role === "child" || role === "shared")) {
    return { yes: true, severity: "high", kind: "adult" };
  }
  if (decision.reason === "vpn-doh") return { yes: true, severity: "high", kind: "vpn" };
  if (decision.reason === "dga-entropy") return { yes: true, severity: "high", kind: "dga" };
  if (decision.reason === "bedtime" || decision.reason === "homework") {
    return { yes: true, severity: "medium", kind: decision.reason };
  }
  return { yes: false, severity: "medium", kind: "watch" };
}

export function sentenceFor(row, extras = {}) {
  const who = extras.name || row.owner || row.sourceIp;
  const host = row.host || row.domain || "";
  const n = extras.count || 1;
  const mins = extras.mins || 10;
  if (row.reason === "quarantine") return `${who} is in digital quarantine until you review it.`;
  if (row.category === "adult" && n > 1) {
    return `${who} tried ${host} ${n} times in ${mins} minutes. Linewatch blocked it.`;
  }
  if (row.category === "adult") return `${who} asked for ${host}. Linewatch blocked adult content.`;
  if (row.reason === "vpn-doh") return `${who} tried a VPN or private DNS (${host}). That is a bypass — blocked.`;
  if (row.reason === "dga-entropy") return `${who} hit a high-randomness name (${host}). Looks like malware or a bypass.`;
  if (row.reason === "homework") return `${who} hit ${host} during homework time. Blocked.`;
  if (row.reason === "bedtime") return `${who} hit ${host} after bedtime. Blocked.`;
  if (row.reason === "category-gaming") return `${who} hit a game destination (${host}). House profile blocked gaming.`;
  if (row.reason === "category-social") return `${who} hit social (${host}). House profile blocked social.`;
  if (extras.kind === "scan") return `${who} has an exposed service. Review the scan.`;
  return `${who} · ${host}`;
}

export function buildInsights(logs, devices = [], now = Date.now()) {
  const day = now - 24 * 60 * 60 * 1000;
  const rows = logs.filter((l) => (l.ts || 0) >= day);
  const blocked = rows.filter((r) => r.action === "blocked");
  const adult = blocked.filter((r) => r.category === "adult");
  const vpn = blocked.filter((r) => r.reason === "vpn-doh" || r.category === "vpn");
  const dga = blocked.filter((r) => r.reason === "dga-entropy");
  const bedtime = blocked.filter((r) => r.reason === "bedtime");
  const homework = blocked.filter((r) => r.reason === "homework");

  const byHost = new Map();
  for (const r of blocked) {
    const k = r.host || r.domain;
    const cur = byHost.get(k) || { host: k, count: 0, people: new Set() };
    cur.count += 1;
    cur.people.add(r.owner || r.sourceIp);
    byHost.set(k, cur);
  }
  const topBlocked = [...byHost.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)
    .map((x) => ({ host: x.host, count: x.count, people: [...x.people] }));

  const repeats = [];
  const keyHits = new Map();
  for (const r of blocked) {
    const k = `${r.owner || r.sourceIp}|${r.host || r.domain}`;
    const arr = keyHits.get(k) || [];
    arr.push(r.ts);
    keyHits.set(k, arr);
  }
  for (const [k, times] of keyHits) {
    const sorted = times.filter(Boolean).sort((a, b) => a - b);
    for (let i = 0; i < sorted.length; i++) {
      const window = sorted.filter((t) => t >= sorted[i] && t <= sorted[i] + 10 * 60_000);
      if (window.length >= 3) {
        const [owner, host] = k.split("|");
        repeats.push({
          owner,
          host,
          count: window.length,
          ts: window[window.length - 1],
          sentence: sentenceFor({ owner, host, category: "adult", reason: "global-adult" }, { count: window.length, mins: 10 }),
        });
        break;
      }
    }
  }

  const sentences = [];
  if (adult.length) sentences.push(`${adult.length} adult ${adult.length === 1 ? "ask" : "asks"} blocked in the last day.`);
  if (repeats.length) sentences.push(`${repeats.length} device${repeats.length === 1 ? "" : "s"} hammered a blocked name.`);
  if (vpn.length) sentences.push(`${vpn.length} VPN / private-DNS bypass ${vpn.length === 1 ? "try" : "tries"}.`);
  if (dga.length) sentences.push(`${dga.length} high-randomness name${dga.length === 1 ? "" : "s"} (possible malware).`);
  if (homework.length) sentences.push(`${homework.length} homework-time block${homework.length === 1 ? "" : "s"}.`);
  if (bedtime.length) sentences.push(`${bedtime.length} after bedtime.`);
  if (!sentences.length) sentences.push("Quiet day. No repeated blocks.");

  const nameOf = (ip) => devices.find((d) => d.ip === ip)?.name;

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
    repeatOffenders: repeats.slice(0, 8),
    sentences,
    people: [...new Set(rows.map((r) => r.owner).filter(Boolean))],
  };
}

export const QUARANTINE_WINDOW_MS = 15 * 60 * 1000;
export const QUARANTINE_HITS = 3;

export function shouldQuarantine(logs, mac, now, enabled) {
  if (!enabled || !mac) return false;
  const cut = now - QUARANTINE_WINDOW_MS;
  const high = logs.filter(
    (l) =>
      (l.mac || "").toLowerCase() === mac.toLowerCase() &&
      l.ts >= cut &&
      l.action === "blocked" &&
      (l.category === "adult" || l.reason === "vpn-doh" || l.reason === "dga-entropy"),
  );
  return high.length >= QUARANTINE_HITS;
}
