/**
 * Linewatch — household outbound watch
 * Copyright (c) 2026 Chris Decker
 *
 * Chris Decker: when the app opens, probe this Wi-Fi, guess the router (.1),
 * and autocomplete the collector so a parent does not have to type an address.
 */
export type LanProbe = {
  ips: string[];
  likelyGateway: string;
  subnet: string;
};

export type CollectorStatus = {
  ok: boolean;
  service?: string;
  lanIp?: string;
  gateway?: string | null;
  router?: { label: string; kind: string };
  syslogPort?: number;
  httpPort?: number;
  eventCount?: number;
  alwaysOn?: boolean;
  retentionDays?: number;
  error?: string;
};

export type CollectorEvent = {
  ts: number;
  sourceIp: string;
  host: string;
};

function isPrivateIp(ip: string): boolean {
  const p = ip.split(".").map(Number);
  if (p.length !== 4 || p.some((n) => Number.isNaN(n))) return false;
  if (p[0] === 10) return true;
  if (p[0] === 192 && p[1] === 168) return true;
  if (p[0] === 172 && (p[1] ?? 0) >= 16 && (p[1] ?? 0) <= 31) return true;
  return false;
}

function gatewayFromIp(ip: string): string {
  const parts = ip.split(".");
  parts[3] = "1";
  return parts.join(".");
}

function pageIsLoopback(): boolean {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  return host === "localhost" || host === "127.0.0.1";
}

export async function probeLan(): Promise<LanProbe> {
  const ips = new Set<string>();
  if (typeof RTCPeerConnection === "undefined") {
    return { ips: [], likelyGateway: "", subnet: "" };
  }
  const pc = new RTCPeerConnection({ iceServers: [] });
  try {
    pc.createDataChannel("lan");
    pc.onicecandidate = (ev) => {
      const c = ev.candidate?.candidate ?? "";
      const m = c.match(/(\d{1,3}(?:\.\d{1,3}){3})/);
      if (m?.[1] && isPrivateIp(m[1])) ips.add(m[1]);
    };
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await new Promise((r) => setTimeout(r, 650));
  } catch {
    /* WebRTC blocked */
  } finally {
    pc.close();
  }
  const list = [...ips];
  const primary = list[0] ?? "";
  return {
    ips: list,
    likelyGateway: primary ? gatewayFromIp(primary) : "",
    subnet: primary ? `${primary.split(".").slice(0, 3).join(".")}.0/24` : "",
  };
}

function normalizeCollectorUrl(raw: string): string {
  let u = raw.trim();
  if (!u) return "";
  if (!/^https?:\/\//i.test(u)) u = `http://${u}`;
  return u.replace(/\/+$/, "");
}

export async function fetchCollectorStatus(rawUrl: string, timeoutMs = 4000): Promise<CollectorStatus> {
  const url = normalizeCollectorUrl(rawUrl);
  if (!url) return { ok: false, error: "Enter the collector address from the computer on your Wi-Fi." };
  try {
    const res = await fetch(`${url}/status`, { signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) return { ok: false, error: `Collector answered HTTP ${res.status}` };
    const data = (await res.json()) as CollectorStatus;
    if (!data || data.ok === false) return { ok: false, error: "Collector is not Linewatch." };
    return { ...data, ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unreachable";
    return {
      ok: false,
      error:
        /Failed to fetch|NetworkError|Mixed Content/i.test(msg)
          ? "Could not reach that address. Keep the collector computer on this Wi-Fi."
          : msg,
    };
  }
}

export async function pullCollectorEvents(rawUrl: string, since: number): Promise<CollectorEvent[]> {
  const url = normalizeCollectorUrl(rawUrl);
  if (!url) return [];
  const res = await fetch(`${url}/events?since=${since}`, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as { events?: CollectorEvent[] };
  return Array.isArray(data.events) ? data.events : [];
}

export function normalizeCollectorUrlExport(raw: string): string {
  return normalizeCollectorUrl(raw);
}

export function collectorUrlSuggestions(probe: LanProbe, savedUrl = ""): string[] {
  const urls: string[] = [];
  const add = (u: string) => {
    if (u && !urls.includes(u)) urls.push(u);
  };
  if (savedUrl) add(normalizeCollectorUrl(savedUrl));
  const prefixes = new Set<string>();
  for (const ip of probe.ips) prefixes.add(ip.split(".").slice(0, 3).join("."));
  if (probe.likelyGateway) prefixes.add(probe.likelyGateway.split(".").slice(0, 3).join("."));
  // Chris Decker: Pi-hole and spare PCs usually live on .2 / .10; the router is .1
  const tails = [10, 2, 3, 4, 5, 8, 12, 15, 20, 24, 31, 50, 100];
  for (const p of prefixes) {
    add(`http://${p}.10:8787`);
    add(`http://${p}.2:8787`);
    if (probe.likelyGateway) add(`http://${probe.likelyGateway}:8787`);
    for (const t of tails) add(`http://${p}.${t}:8787`);
  }
  // Only the same computer as the browser — never the phone's loopback.
  if (pageIsLoopback()) {
    add("http://127.0.0.1:8787");
    add("http://localhost:8787");
  }
  return urls;
}

async function probeOne(
  url: string,
  timeout: number,
): Promise<{ url: string; status: CollectorStatus } | null> {
  const status = await fetchCollectorStatus(url, timeout);
  if (status.ok && status.service === "linewatch-collector") return { url, status };
  return null;
}

export async function discoverCollector(
  probe: LanProbe,
  savedUrl = "",
): Promise<{ url: string; status: CollectorStatus } | null> {
  const urls = collectorUrlSuggestions(probe, savedUrl);
  if (!urls.length) return null;
  const priority = urls.slice(0, Math.min(4, urls.length));
  const rest = urls.slice(priority.length);

  const first = await Promise.all(priority.map((u) => probeOne(u, savedUrl ? 2200 : 800)));
  const hit = first.find((x) => x);
  if (hit) return hit;

  for (let i = 0; i < rest.length; i += 8) {
    const batch = rest.slice(i, i + 8);
    const found = await Promise.all(batch.map((u) => probeOne(u, 400)));
    const next = found.find((x) => x);
    if (next) return next;
  }
  return null;
}
