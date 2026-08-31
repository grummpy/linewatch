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
    await new Promise((r) => setTimeout(r, 900));
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

export async function fetchCollectorStatus(rawUrl: string): Promise<CollectorStatus> {
  const url = normalizeCollectorUrl(rawUrl);
  if (!url) return { ok: false, error: "Enter the collector address from the computer on your Wi-Fi." };
  try {
    const res = await fetch(`${url}/status`, { signal: AbortSignal.timeout(4000) });
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
          ? "Could not reach that address. Run the collector on a computer on this Wi-Fi. If Linewatch is https, open Setup on that same computer, or paste /export.txt."
          : msg,
    };
  }
}

export async function pullCollectorEvents(rawUrl: string, since: number): Promise<CollectorEvent[]> {
  const url = normalizeCollectorUrl(rawUrl);
  if (!url) return [];
  const res = await fetch(`${url}/events?since=${since}`, { signal: AbortSignal.timeout(4000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as { events?: CollectorEvent[] };
  return Array.isArray(data.events) ? data.events : [];
}

export function normalizeCollectorUrlExport(raw: string): string {
  return normalizeCollectorUrl(raw);
}
