#!/usr/bin/env node
/**
 * Linewatch house collector.
 *
 * Run this on a Mac, PC, or Raspberry Pi that stays on the home Wi-Fi.
 * It finds the default gateway (the router), listens for DNS/syslog the
 * router forwards here, and exposes those queries for the Linewatch app.
 *
 *   node collector/linewatch-collector.mjs
 *
 * Then: router syslog/DNS → this machine. Linewatch Setup → collector URL.
 */

import dgram from "node:dgram";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import { createInterface } from "node:readline";

const HTTP_PORT = Number(process.env.LINEWATCH_PORT || 8787);
const SYSLOG_PORT = Number(process.env.LINEWATCH_SYSLOG || 5514);
const DNS_LOG = process.env.LINEWATCH_DNS_LOG || "";
const MAX = 2000;

/** @typedef {{ ts: number, sourceIp: string, host: string, raw: string }} Event */

/** @type {Event[]} */
const events = [];
/** @type {string[]} */
const logLines = [];

function note(line) {
  const row = `${new Date().toISOString()} ${line}`;
  logLines.push(row);
  if (logLines.length > 80) logLines.shift();
  console.log(line);
}

function isPrivateIp(ip) {
  const p = ip.split(".").map(Number);
  if (p.length !== 4 || p.some((n) => Number.isNaN(n))) return false;
  if (p[0] === 10) return true;
  if (p[0] === 192 && p[1] === 168) return true;
  if (p[0] === 172 && p[1] >= 16 && p[1] <= 31) return true;
  return false;
}

function lanAddresses() {
  const out = [];
  for (const rows of Object.values(os.networkInterfaces())) {
    for (const r of rows || []) {
      if (r.internal || r.family === "IPv6" || r.family === 6) continue;
      if (typeof r.address === "string" && isPrivateIp(r.address)) {
        out.push({ ip: r.address, mac: r.mac, netmask: r.netmask, iface: r.iface || "" });
      }
    }
  }
  return out;
}

function parseHexIpv4(hex) {
  const n = Number.parseInt(hex, 16);
  if (!Number.isFinite(n)) return null;
  return `${n & 255}.${(n >> 8) & 255}.${(n >> 16) & 255}.${(n >> 24) & 255}`;
}

function gatewayFromProc() {
  try {
    const text = fs.readFileSync("/proc/net/route", "utf8");
    for (const line of text.split("\n").slice(1)) {
      const cols = line.trim().split(/\s+/);
      if (cols[1] === "00000000" && cols[2] && cols[2] !== "00000000") {
        return parseHexIpv4(cols[2]);
      }
    }
  } catch {
    /* not linux */
  }
  return null;
}

function guessGateway(lans) {
  const fromProc = gatewayFromProc();
  if (fromProc && isPrivateIp(fromProc)) return fromProc;
  const first = lans[0]?.ip;
  if (!first) return null;
  const parts = first.split(".");
  parts[3] = "1";
  return parts.join(".");
}

function parseQuery(text) {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const dns = trimmed.match(
    /(?:query\[A(?:AAA)?\]\s+)?([a-z0-9._-]+\.[a-z]{2,})\s+from\s+((?:\d{1,3}\.){3}\d{1,3})/i,
  );
  if (dns?.[1] && dns[2]) return { host: dns[1].toLowerCase(), sourceIp: dns[2] };
  const csv = trimmed.match(/^([^,]+),((?:\d{1,3}\.){3}\d{1,3}),([a-z0-9._-]+\.[a-z]{2,})/i);
  if (csv?.[2] && csv[3]) {
    const ts = Date.parse(csv[1] ?? "");
    return { host: csv[3].toLowerCase(), sourceIp: csv[2], ts: Number.isFinite(ts) ? ts : undefined };
  }
  const simple = trimmed.match(/((?:\d{1,3}\.){3}\d{1,3})\s+([a-z0-9._-]+\.[a-z]{2,})/i);
  if (simple?.[1] && simple[2]) return { host: simple[2].toLowerCase(), sourceIp: simple[1] };
  return null;
}

function pushEvent(partial, raw) {
  const host = (partial.host || "").replace(/\.$/, "");
  if (!host || host.length < 4) return;
  const ev = {
    ts: partial.ts || Date.now(),
    sourceIp: partial.sourceIp,
    host,
    raw: String(raw).slice(0, 300),
  };
  events.push(ev);
  if (events.length > MAX) events.splice(0, events.length - MAX);
}

function probeHttp(ip, port, timeoutMs = 1200) {
  return new Promise((resolve) => {
    const req = http.get(
      {
        host: ip,
        port,
        path: "/",
        timeout: timeoutMs,
        headers: { "user-agent": "Linewatch-collector/1.0" },
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => {
          if (chunks.join("").length < 4000) chunks.push(c.toString("utf8"));
        });
        res.on("end", () => {
          resolve({
            ok: true,
            status: res.statusCode || 0,
            server: String(res.headers.server || ""),
            auth: String(res.headers["www-authenticate"] || ""),
            body: chunks.join(""),
          });
        });
      },
    );
    req.on("error", () => resolve(null));
    req.on("timeout", () => {
      req.destroy();
      resolve(null);
    });
  });
}

function fingerprint(probe, gateway) {
  if (!probe) return { label: `Gateway ${gateway}`, kind: "unknown" };
  const blob = `${probe.server} ${probe.auth} ${probe.body}`.toLowerCase();
  const rules = [
    [/asus|rt-ax|rt-ac/, "ASUS router"],
    [/unifi|ubiquiti|udm/, "UniFi gateway"],
    [/eero/, "eero"],
    [/nest|google wifi/, "Google Wifi / Nest"],
    [/tp-link|tplink|archer/, "TP-Link router"],
    [/netgear/, "Netgear router"],
    [/orbi/, "Netgear Orbi"],
    [/fritz/, "FRITZ!Box"],
    [/openwrt|luci/, "OpenWrt"],
    [/pfsense|opnsense/, "Firewall (pfSense/OPNsense)"],
    [/firewalla/, "Firewalla"],
    [/synology/, "Synology"],
    [/apple-airport|airport/, "Apple AirPort"],
    [/mini_httpd/, "Consumer router"],
  ];
  for (const [re, label] of rules) {
    if (re.test(blob)) return { label, kind: "router" };
  }
  if (probe.auth) return { label: `Router at ${gateway} (login page)`, kind: "router" };
  if (probe.ok) return { label: `Device at ${gateway} answered HTTP`, kind: "gateway" };
  return { label: `Gateway ${gateway}`, kind: "unknown" };
}

function ssdpDiscover(timeoutMs = 1800) {
  return new Promise((resolve) => {
    /** @type {string[]} */
    const hits = [];
    const sock = dgram.createSocket({ type: "udp4", reuseAddr: true });
    const timer = setTimeout(() => {
      try {
        sock.close();
      } catch {
        /* */
      }
      resolve(hits);
    }, timeoutMs);
    sock.on("error", () => {
      clearTimeout(timer);
      resolve(hits);
    });
    sock.on("message", (msg, rinfo) => {
      const text = msg.toString("utf8");
      if (/internetgatewaydevice|wanipconnection|router/i.test(text)) {
        hits.push(`${rinfo.address} ${text.split("\n")[0] || ""}`.trim());
      }
    });
    sock.bind(0, () => {
      try {
        sock.setBroadcast(true);
      } catch {
        /* */
      }
      const msg = Buffer.from(
        'M-SEARCH * HTTP/1.1\r\nHOST: 239.255.255.250:1900\r\nMAN: "ssdp:discover"\r\nMX: 1\r\nST: urn:schemas-upnp-org:device:InternetGatewayDevice:1\r\n\r\n',
      );
      sock.send(msg, 1900, "239.255.255.250", () => {});
      sock.send(msg, 1900, "255.255.255.255", () => {});
    });
  });
}

function tailFile(path) {
  let offset = 0;
  try {
    offset = fs.statSync(path).size;
  } catch {
    note(`DNS log not found yet: ${path}`);
  }
  const tick = () => {
    fs.stat(path, (err, st) => {
      if (err || !st) return;
      if (st.size < offset) offset = 0;
      if (st.size === offset) return;
      const stream = fs.createReadStream(path, { start: offset, end: st.size - 1, encoding: "utf8" });
      offset = st.size;
      const rl = createInterface({ input: stream });
      rl.on("line", (line) => {
        const parsed = parseQuery(line);
        if (parsed) pushEvent(parsed, line);
      });
    });
  };
  setInterval(tick, 800);
  note(`Tailing DNS log ${path}`);
}

function listenSyslog(port) {
  const sock = dgram.createSocket("udp4");
  sock.on("message", (msg, rinfo) => {
    const text = msg.toString("utf8").replace(/\u0000/g, "").trim();
    const parsed = parseQuery(text);
    if (parsed) pushEvent(parsed, text);
    else if (/\.[a-z]{2,}/i.test(text) && rinfo?.address) {
      const hostHit = text.match(/([a-z0-9._-]+\.[a-z]{2,})/i);
      if (hostHit) pushEvent({ host: hostHit[1], sourceIp: rinfo.address }, text);
    }
  });
  sock.on("error", (err) => {
    note(`Syslog ${port}: ${err.message}`);
  });
  sock.bind(port, "0.0.0.0", () => {
    note(`Syslog listening UDP ${port} (point the router here)`);
  });
}

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function htmlPage(state) {
  const rows = events
    .slice(-40)
    .reverse()
    .map(
      (e) =>
        `<tr><td>${new Date(e.ts).toLocaleTimeString()}</td><td>${e.sourceIp}</td><td>${e.host}</td></tr>`,
    )
    .join("");
  return `<!doctype html>
<html lang="en">
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Linewatch collector</title>
<style>
  body{font:15px/1.45 ui-sans-serif,system-ui;background:#0c0d0e;color:#e8e6e3;margin:0;padding:24px}
  a{color:#8aa0ad}
  .card{background:#141516;border-radius:12px;padding:20px;margin:0 0 16px;max-width:720px}
  code,td{font-family:ui-monospace,Menlo,monospace;font-size:12px}
  table{width:100%;border-collapse:collapse}
  td,th{text-align:left;padding:8px 4px;border-bottom:1px solid #222}
  .muted{color:#8b8a86}
</style>
<body>
  <div class="card">
    <p class="muted">LINEWATCH COLLECTOR</p>
    <h1>House line is open</h1>
    <p>This computer: <code>${state.lanIp || "—"}</code></p>
    <p>Router / gateway: <code>${state.gateway || "—"}</code> · ${state.router.label}</p>
    <p>Syslog UDP <code>${SYSLOG_PORT}</code> · API <code>http://${state.lanIp}:${HTTP_PORT}</code></p>
    <p class="muted">In Linewatch on your phone, Setup → Your house → paste that API address → Connect.</p>
    <p class="muted">On the router, send syslog or DNS query logs to <code>${state.lanIp}:${SYSLOG_PORT}</code>. Pi-hole: tail the query log with LINEWATCH_DNS_LOG.</p>
  </div>
  <div class="card">
    <h2>Recent queries</h2>
    ${
      rows
        ? `<table><thead><tr><th>Time</th><th>Device IP</th><th>Host</th></tr></thead><tbody>${rows}</tbody></table>`
        : `<p class="muted">Waiting for the router to send DNS/syslog. ${events.length} buffered.</p>`
    }
  </div>
</body>
</html>`;
}

async function main() {
  const lans = lanAddresses();
  const lanIp = lans[0]?.ip || "";
  const gateway = guessGateway(lans);
  note(`LAN ${lans.map((l) => l.ip).join(", ") || "none"}`);
  if (gateway) note(`Default gateway ${gateway}`);

  let probe = null;
  if (gateway) {
    probe = (await probeHttp(gateway, 80)) || (await probeHttp(gateway, 8080));
  }
  const router = fingerprint(probe, gateway || "unknown");
  note(`Router guess: ${router.label}`);

  const ssdp = await ssdpDiscover();
  if (ssdp.length) note(`UPnP gateway ads: ${ssdp.slice(0, 3).join(" | ")}`);

  listenSyslog(SYSLOG_PORT);
  if (DNS_LOG) tailFile(DNS_LOG);

  const state = () => ({
    ok: true,
    service: "linewatch-collector",
    lanIp,
    lan: lans,
    gateway,
    router,
    syslogPort: SYSLOG_PORT,
    httpPort: HTTP_PORT,
    eventCount: events.length,
    listening: true,
  });

  const server = http.createServer((req, res) => {
    cors(res);
    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    if (url.pathname === "/status") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(state()));
      return;
    }
    if (url.pathname === "/events") {
      const since = Number(url.searchParams.get("since") || 0);
      const rows = events.filter((e) => e.ts > since).map(({ ts, sourceIp, host }) => ({ ts, sourceIp, host }));
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ events: rows, total: events.length }));
      return;
    }
    if (url.pathname === "/export.txt") {
      const body = events
        .map((e) => `${new Date(e.ts).toISOString()},${e.sourceIp},${e.host}`)
        .join("\n");
      res.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
      res.end(body);
      return;
    }
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(htmlPage({ ...state(), router }));
  });

  server.listen(HTTP_PORT, "0.0.0.0", () => {
    note(`API http://${lanIp || "127.0.0.1"}:${HTTP_PORT}`);
    note("In Linewatch → Setup → Your house → Connect with that URL.");
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
