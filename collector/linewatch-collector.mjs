#!/usr/bin/env node
/**
 * Linewatch house collector — DNS + parent API
 * Copyright (c) 2026 Chris Decker
 *
 * Run this on a Mac, PC, or Raspberry Pi that stays on the home Wi-Fi.
 * It is the house DNS: every device asks here for names. Linewatch on the
 * phone only watches this box and gets alerts.
 *
 *   node collector/linewatch-collector.mjs
 *
 * Point the router DNS at this computer. Phone: open Linewatch on this
 * Wi-Fi — it finds this collector.
 */
import dgram from "node:dgram";
import fs from "node:fs";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { answerA, decodeQuery, sinkhole } from "./lib/dns-packet.mjs";
import {
  WEEK_MS,
  buildInsights,
  decide,
  mergePolicy,
  defaultPolicy,
  sentenceFor,
  shouldAlert,
  shouldQuarantine,
} from "./lib/policy.mjs";
import { scanLan } from "./lib/scan.mjs";

const HTTP_PORT = Number(process.env.LINEWATCH_PORT || 8787);
const SYSLOG_PORT = Number(process.env.LINEWATCH_SYSLOG || 5514);
const DNS_PORT = Number(process.env.LINEWATCH_DNS_PORT || 53);
const DNS_FALLBACK = Number(process.env.LINEWATCH_DNS_FALLBACK || 5353);
const DNS_LOG = process.env.LINEWATCH_DNS_LOG || "";
const UPSTREAM = process.env.LINEWATCH_UPSTREAM || "1.1.1.1";
const MAX = 20_000;
const DATA_DIR = process.env.LINEWATCH_DATA || path.join(process.cwd(), "data");
const LOG_FILE = path.join(DATA_DIR, "logs.jsonl");
const POLICY_FILE = path.join(DATA_DIR, "policy.json");
const ALERT_FILE = path.join(DATA_DIR, "alerts.json");
const SCAN_FILE = path.join(DATA_DIR, "scans.json");
const INSIGHT_FILE = path.join(DATA_DIR, "insights.json");

/** @typedef {{ ts: number, sourceIp: string, mac: string, host: string, category: string, action: string, reason: string, entropy: number, owner: string }} LogRow */

/** @type {LogRow[]} */
const logs = [];
/** @type {any[]} */
const alerts = [];
/** @type {string[]} */
const logLines = [];
let policy = mergePolicy(null);
let dnsPortBound = 0;
let lastScan = null;
let scanRunning = false;

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
        out.push({ ip: r.address, mac: r.mac, netmask: r.netmask });
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
      if (cols[1] === "00000000" && cols[2] && cols[2] !== "00000000") return parseHexIpv4(cols[2]);
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

function pruneWeek(list, now = Date.now()) {
  const cut = now - WEEK_MS;
  return list.filter((e) => e.ts >= cut);
}

function saveJson(file, data) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function saveLogs() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const keep = pruneWeek(logs);
    logs.length = 0;
    logs.push(...keep);
    const body = keep
      .map((e) =>
        JSON.stringify({
          ts: e.ts,
          deviceMac: e.mac,
          sourceIp: e.sourceIp,
          requestedDomain: e.host,
          category: e.category,
          action: e.action,
          reason: e.reason,
          owner: e.owner,
          entropy: e.entropy,
        }),
      )
      .join("\n");
    fs.writeFileSync(LOG_FILE, body ? `${body}\n` : "");
    saveJson(ALERT_FILE, pruneWeek(alerts).slice(0, 200));
    saveJson(POLICY_FILE, policy);
  } catch (err) {
    note(`Log save failed: ${err instanceof Error ? err.message : err}`);
  }
}

let persistTimer = null;
function scheduleSave() {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(saveLogs, 400);
}

function loadDisk() {
  try {
    policy = mergePolicy(JSON.parse(fs.readFileSync(POLICY_FILE, "utf8")));
  } catch {
    policy = defaultPolicy();
  }
  try {
    const text = fs.readFileSync(LOG_FILE, "utf8");
    const cut = Date.now() - WEEK_MS;
    for (const line of text.split("\n")) {
      if (!line.trim()) continue;
      try {
        const ev = JSON.parse(line);
        const host = ev.requestedDomain || ev.host;
        const mac = ev.deviceMac || ev.mac || "";
        if (ev && ev.ts >= cut && host && ev.sourceIp) {
          logs.push({
            ts: ev.ts,
            sourceIp: ev.sourceIp,
            mac,
            host,
            category: ev.category || "unknown",
            action: ev.action || "allowed",
            reason: ev.reason || "ok",
            entropy: ev.entropy || 0,
            owner: ev.owner || "Unknown",
          });
        }
      } catch {
        /* skip */
      }
    }
    if (logs.length > MAX) logs.splice(0, logs.length - MAX);
    note(`Loaded ${logs.length} DNS rows from last 7 days`);
  } catch {
    /* first run */
  }
  try {
    const a = JSON.parse(fs.readFileSync(ALERT_FILE, "utf8"));
    if (Array.isArray(a)) alerts.push(...pruneWeek(a));
  } catch {
    /* */
  }
  try {
    lastScan = JSON.parse(fs.readFileSync(SCAN_FILE, "utf8"));
  } catch {
    lastScan = null;
  }
}

function pushLog(row) {
  logs.push(row);
  if (logs.length > MAX) logs.splice(0, logs.length - MAX);
  const alert = shouldAlert(row, row.role);
  const recentSame = logs.filter(
    (l) => l.host === row.host && l.sourceIp === row.sourceIp && l.ts >= row.ts - 10 * 60_000 && l.action === "blocked",
  );
  const extras = { count: recentSame.length, mins: 10, name: row.owner };
  if (alert.yes || recentSame.length >= 3) {
    const kind = recentSame.length >= 3 ? "repeat" : alert.kind;
    alerts.unshift({
      id: `al-${row.ts}-${Math.random().toString(36).slice(2, 7)}`,
      ts: row.ts,
      host: row.host,
      sourceIp: row.sourceIp,
      mac: row.mac,
      owner: row.owner,
      category: row.category,
      reason: row.reason,
      kind,
      severity: kind === "repeat" || alert.severity === "high" ? "high" : "medium",
      sentence: sentenceFor(row, extras),
      acknowledged: false,
    });
    if (alerts.length > 200) alerts.length = 200;
  }
  if (row.mac) {
    const prof = policy.profiles?.[row.owner];
    const auto =
      typeof prof?.autoQuarantine === "boolean"
        ? prof.autoQuarantine
        : row.role === "child"
          ? policy.autoQuarantine !== false
          : false;
    if (shouldQuarantine(logs, row.mac, row.ts, auto) && !policy.quarantine[row.mac]) {
      policy.quarantine[row.mac] = { since: row.ts, reason: "repeated high-severity blocks", untilReview: true };
      alerts.unshift({
        id: `al-q-${row.ts}`,
        ts: row.ts,
        host: row.host,
        sourceIp: row.sourceIp,
        mac: row.mac,
        owner: row.owner,
        category: row.category,
        reason: "quarantine",
        kind: "quarantine",
        severity: "high",
        sentence: `${row.owner || row.sourceIp} was isolated after repeated high-severity hits. Review and release.`,
        acknowledged: false,
      });
      note(`Quarantine ${row.mac} (${row.owner})`);
    }
  }
  scheduleSave();
}

function applyDecision(host, sourceIp, ts = Date.now()) {
  const decision = decide(policy, host, sourceIp, ts);
  const row = {
    ts,
    sourceIp,
    mac: decision.mac,
    host,
    category: decision.category,
    action: decision.action === "rewritten" ? "rewritten" : decision.action,
    reason: decision.reason,
    entropy: decision.entropy,
    owner: decision.owner,
    role: decision.role,
  };
  pushLog(row);
  return decision;
}

function parseQueryLine(text) {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const dns = trimmed.match(/(?:query\[A(?:AAA)?\]\s+)?([a-z0-9._-]+\.[a-z]{2,})\s+from\s+((?:\d{1,3}\.){3}\d{1,3})/i);
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

function probeHttp(ip, port, timeoutMs = 1200) {
  return new Promise((resolve) => {
    const req = http.get(
      { host: ip, port, path: "/", timeout: timeoutMs, headers: { "user-agent": "Linewatch-collector/2.0" } },
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
  ];
  for (const [re, label] of rules) {
    if (re.test(blob)) return { label, kind: "router" };
  }
  if (probe.auth) return { label: `Router at ${gateway} (login page)`, kind: "router" };
  if (probe.ok) return { label: `Device at ${gateway} answered HTTP`, kind: "gateway" };
  return { label: `Gateway ${gateway}`, kind: "unknown" };
}

function tailFile(filePath) {
  let offset = 0;
  try {
    offset = fs.statSync(filePath).size;
  } catch {
    note(`DNS log not found yet: ${filePath}`);
  }
  const tick = () => {
    fs.stat(filePath, (err, st) => {
      if (err || !st) return;
      if (st.size < offset) offset = 0;
      if (st.size === offset) return;
      const stream = fs.createReadStream(filePath, { start: offset, end: st.size - 1, encoding: "utf8" });
      offset = st.size;
      const rl = createInterface({ input: stream });
      rl.on("line", (line) => {
        const parsed = parseQueryLine(line);
        if (parsed) applyDecision(parsed.host, parsed.sourceIp, parsed.ts || Date.now());
      });
    });
  };
  setInterval(tick, 800);
  note(`Tailing DNS log ${filePath}`);
}

function listenSyslog(port) {
  const sock = dgram.createSocket("udp4");
  sock.on("message", (msg, rinfo) => {
    const text = msg.toString("utf8").replace(/\u0000/g, "").trim();
    const parsed = parseQueryLine(text);
    if (parsed) applyDecision(parsed.host, parsed.sourceIp, Date.now());
    else if (/\.[a-z]{2,}/i.test(text) && rinfo?.address) {
      const hostHit = text.match(/([a-z0-9._-]+\.[a-z]{2,})/i);
      if (hostHit) applyDecision(hostHit[1], rinfo.address, Date.now());
    }
  });
  sock.on("error", (err) => note(`Syslog ${port}: ${err.message}`));
  sock.bind(port, "0.0.0.0", () => note(`Syslog listening UDP ${port}`));
}

function forwardDns(packet) {
  return new Promise((resolve) => {
    const sock = dgram.createSocket("udp4");
    const t = setTimeout(() => {
      try {
        sock.close();
      } catch {
        /* */
      }
      resolve(null);
    }, 1400);
    sock.on("message", (msg) => {
      clearTimeout(t);
      try {
        sock.close();
      } catch {
        /* */
      }
      resolve(msg);
    });
    sock.on("error", () => {
      clearTimeout(t);
      resolve(null);
    });
    sock.send(packet, 53, UPSTREAM);
  });
}

async function handleDns(msg, rinfo, sock) {
  const q = decodeQuery(msg);
  if (!q) return;
  const decision = applyDecision(q.name, rinfo.address, Date.now());
  let reply;
  if (decision.action === "blocked") reply = sinkhole(q);
  else if (decision.action === "rewritten" && decision.rewriteIp) reply = answerA(q, decision.rewriteIp, 60);
  else reply = (await forwardDns(msg)) || sinkhole(q);
  sock.send(reply, rinfo.port, rinfo.address);
}

function listenDns(port) {
  return new Promise((resolve, reject) => {
    const sock = dgram.createSocket("udp4");
    sock.on("message", (msg, rinfo) => {
      void handleDns(msg, rinfo, sock);
    });
    sock.on("error", (err) => {
      sock.close();
      reject(err);
    });
    sock.bind(port, "0.0.0.0", () => {
      dnsPortBound = port;
      note(`House DNS on UDP ${port} — point the router here`);
      resolve(sock);
    });
  });
}

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function readBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    let n = 0;
    req.on("data", (c) => {
      n += c.length;
      if (n < 200_000) chunks.push(c);
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"));
      } catch {
        resolve({});
      }
    });
  });
}

function insightsNow() {
  const report = buildInsights(logs, policy.devices, Date.now());
  try {
    saveJson(INSIGHT_FILE, report);
  } catch {
    /* */
  }
  return report;
}

function htmlPage(state) {
  const rows = logs
    .slice(-50)
    .reverse()
    .map(
      (e) =>
        `<tr><td>${new Date(e.ts).toLocaleTimeString()}</td><td>${e.owner}</td><td>${e.sourceIp}</td><td>${e.host}</td><td>${e.category}</td><td>${e.action}</td><td>${e.reason}</td></tr>`,
    )
    .join("");
  const q = Object.keys(policy.quarantine || {});
  const ins = insightsNow();
  return `<!doctype html>
<html lang="en">
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Linewatch</title>
<style>
  body{font:15px/1.45 "IBM Plex Sans",ui-sans-serif,system-ui;background:#0c0d0e;color:#e8e6e3;margin:0;padding:24px}
  a{color:#8aa0ad}
  .card{background:#141516;border-radius:12px;padding:20px;margin:0 0 16px;max-width:920px}
  code,td{font-family:ui-monospace,Menlo,monospace;font-size:12px}
  table{width:100%;border-collapse:collapse}
  td,th{text-align:left;padding:8px 4px;border-bottom:1px solid #222}
  .muted{color:#8b8a86}
  button{background:#e8e6e3;color:#0c0d0e;border:0;border-radius:8px;padding:10px 14px;font:15px/1 "IBM Plex Sans",sans-serif;cursor:pointer;margin:4px 8px 0 0}
  button.ghost{background:transparent;color:#e8e6e3;box-shadow:0 0 0 1px #333}
</style>
<body>
  <div class="card">
    <p class="muted">LINEWATCH · HOUSE DNS</p>
    <h1>This computer is the watch</h1>
    <p>This computer: <code>${state.lanIp || "—"}</code></p>
    <p>Router: <code>${state.gateway || "—"}</code> · ${state.router.label}</p>
    <p>House DNS ${dnsPortBound ? "is on" : "needs an administrator start"} · API ready for the phone</p>
    <p class="muted">Keep this computer on. Close the phone — logs still write. Older than 7 days is overwritten.</p>
    <p class="muted">On the router, set DNS to <code>${state.lanIp}</code>. Open Linewatch on your phone on this Wi-Fi.</p>
  </div>
  <div class="card">
    <h2>Today</h2>
    ${(ins.sentences || []).map((s) => `<p>${s}</p>`).join("") || "<p class='muted'>Waiting on queries.</p>"}
    <p class="muted">${ins.queries} lookups · ${ins.blocked} blocked · ${ins.adultAttempts} adult</p>
    ${q.length ? `<p>Isolated devices: ${q.join(", ")}</p>` : ""}
    <p>
      <button type="button" onclick="fetch('/scan',{method:'POST'}).then(()=>location.reload())">Scan this Wi-Fi</button>
      <button class="ghost" type="button" onclick="location.reload()">Refresh</button>
    </p>
    ${
      lastScan?.findings?.length
        ? `<ul>${lastScan.findings.map((f) => `<li>${f.sentence}</li>`).join("")}</ul>`
        : lastScan
          ? "<p class='muted'>Last scan found nothing open on the usual danger ports.</p>"
          : ""
    }
  </div>
  <div class="card">
    <h2>Recent DNS</h2>
    ${
      rows
        ? `<table><thead><tr><th>Time</th><th>Who</th><th>IP</th><th>Domain</th><th>Genre</th><th>Action</th><th>Why</th></tr></thead><tbody>${rows}</tbody></table>`
        : `<p class="muted">Waiting for the house to ask for names.</p>`
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
  if (gateway) probe = (await probeHttp(gateway, 80)) || (await probeHttp(gateway, 8080));
  const router = fingerprint(probe, gateway || "unknown");
  note(`Router guess: ${router.label}`);

  loadDisk();
  if (!policy.devices.length) {
    policy.devices = [
      { ip: "192.168.1.24", mac: "A4:83:E7:2C:91:04", name: "Riley's iPhone", owner: "Riley", role: "child" },
      { ip: "192.168.1.31", mac: "F0:18:98:6A:22:B1", name: "Sam's iPad", owner: "Sam", role: "child" },
      { ip: "192.168.1.12", mac: "3C:22:FB:11:08:C2", name: "Jordan's MacBook", owner: "Jordan", role: "parent" },
      { ip: "192.168.1.18", mac: "D8:8F:76:40:AA:19", name: "Avery's iPhone", owner: "Avery", role: "parent" },
    ];
    policy.profiles = {
      Riley: { role: "child", autoQuarantine: true, blocks: [] },
      Sam: { role: "child", autoQuarantine: true, blocks: [] },
      Jordan: { role: "parent", autoQuarantine: false, blocks: [] },
      Avery: { role: "parent", autoQuarantine: false, blocks: [] },
    };
  }

  setInterval(() => {
    const before = logs.length;
    const keep = pruneWeek(logs);
    if (keep.length !== before) {
      logs.length = 0;
      logs.push(...keep);
      note(`Dropped logs older than 7 days (${before - keep.length} rows)`);
    }
    insightsNow();
    saveLogs();
  }, 60 * 60 * 1000);

  listenSyslog(SYSLOG_PORT);
  if (DNS_LOG) tailFile(DNS_LOG);

  try {
    await listenDns(DNS_PORT);
  } catch (err) {
    note(`House DNS on ${DNS_PORT} needs administrator (${err instanceof Error ? err.message : err})`);
    try {
      await listenDns(DNS_FALLBACK);
      note("Started house DNS on the fallback. Run the installer as administrator to take the house resolver.");
    } catch (err2) {
      note(`DNS not bound: ${err2 instanceof Error ? err2.message : err2}`);
    }
  }

  const state = () => ({
    ok: true,
    service: "linewatch-collector",
    lanIp,
    lan: lans,
    gateway,
    router,
    syslogPort: SYSLOG_PORT,
    httpPort: HTTP_PORT,
    dnsPort: dnsPortBound,
    dns: Boolean(dnsPortBound),
    eventCount: logs.length,
    listening: true,
    alwaysOn: true,
    retentionDays: 7,
    quarantine: Object.keys(policy.quarantine || {}),
    insights: insightsNow(),
    scan: lastScan,
    scanRunning,
  });

  const server = http.createServer(async (req, res) => {
    cors(res);
    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    const json = (code, obj) => {
      res.writeHead(code, { "content-type": "application/json" });
      res.end(JSON.stringify(obj));
    };

    if (url.pathname === "/status") return json(200, state());
    if (url.pathname === "/events") {
      const since = Number(url.searchParams.get("since") || 0);
      const events = logs
        .filter((e) => e.ts > since)
        .map((e) => ({
          ts: e.ts,
          sourceIp: e.sourceIp,
          host: e.host,
          mac: e.mac,
          category: e.category,
          action: e.action,
          reason: e.reason,
          entropy: e.entropy,
          owner: e.owner,
        }));
      return json(200, { events, total: logs.length });
    }
    if (url.pathname === "/logs") {
      const since = Number(url.searchParams.get("since") || 0);
      return json(200, { logs: logs.filter((e) => e.ts > since) });
    }
    if (url.pathname === "/insights") return json(200, insightsNow());
    if (url.pathname === "/alerts") return json(200, { alerts: alerts.slice(0, 80) });
    if (url.pathname === "/policy" && req.method === "GET") return json(200, policy);
    if (url.pathname === "/policy" && req.method === "POST") {
      const body = await readBody(req);
      policy = mergePolicy({ ...policy, ...body, profiles: body.profiles || policy.profiles, quarantine: body.quarantine || policy.quarantine });
      scheduleSave();
      return json(200, { ok: true, policy });
    }
    if (url.pathname === "/block" && req.method === "POST") {
      const body = await readBody(req);
      const host = String(body.host || "").toLowerCase();
      if (!host) return json(400, { ok: false });
      if (body.owner) {
        const prof = policy.profiles[body.owner] || { role: "child", blocks: [], autoQuarantine: true };
        if (!prof.blocks.includes(host)) prof.blocks.push(host);
        policy.profiles[body.owner] = prof;
      } else if (!policy.blocklistGlobal.includes(host)) policy.blocklistGlobal.push(host);
      scheduleSave();
      return json(200, { ok: true });
    }
    if (url.pathname === "/allow" && req.method === "POST") {
      const body = await readBody(req);
      const host = String(body.host || "").toLowerCase();
      if (!host) return json(400, { ok: false });
      policy.blocklistGlobal = policy.blocklistGlobal.filter((h) => h !== host);
      if (body.owner && policy.profiles[body.owner]) {
        policy.profiles[body.owner].blocks = (policy.profiles[body.owner].blocks || []).filter((h) => h !== host);
      }
      if (!policy.allowlist.includes(host)) policy.allowlist.push(host);
      scheduleSave();
      return json(200, { ok: true });
    }
    if (url.pathname === "/quarantine" && req.method === "POST") {
      const body = await readBody(req);
      const mac = String(body.mac || "").toLowerCase();
      if (!mac) return json(400, { ok: false });
      if (body.on === false) delete policy.quarantine[mac];
      else policy.quarantine[mac] = { since: Date.now(), reason: body.reason || "manual", untilReview: true };
      scheduleSave();
      return json(200, { ok: true, quarantine: policy.quarantine });
    }
    if (url.pathname === "/scan" && req.method === "POST") {
      if (scanRunning) return json(202, { ok: true, running: true });
      scanRunning = true;
      scanLan(policy.devices, gateway)
        .then((result) => {
          lastScan = result;
          scanRunning = false;
          saveJson(SCAN_FILE, result);
          for (const f of result.findings.filter((x) => x.severity === "high")) {
            alerts.unshift({
              id: `al-scan-${f.ip}-${f.port}`,
              ts: result.at,
              host: `${f.ip}:${f.port}`,
              sourceIp: f.ip,
              mac: f.mac,
              owner: f.name,
              category: "system",
              reason: "scan",
              kind: "scan",
              severity: "high",
              sentence: f.sentence,
              acknowledged: false,
            });
          }
          scheduleSave();
        })
        .catch(() => {
          scanRunning = false;
        });
      return json(202, { ok: true, running: true });
    }
    if (url.pathname === "/scan") return json(200, { running: scanRunning, scan: lastScan });
    if (url.pathname === "/export.txt") {
      const body = logs.map((e) => `${new Date(e.ts).toISOString()},${e.sourceIp},${e.mac},${e.host},${e.category},${e.action},${e.reason}`).join("\n");
      res.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
      res.end(body);
      return;
    }
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(htmlPage({ ...state(), router }));
  });

  server.listen(HTTP_PORT, "0.0.0.0", () => {
    note(`Parent desk http://${lanIp || "127.0.0.1"}:${HTTP_PORT}`);
    note("Phone: open Linewatch on this Wi-Fi. It finds this computer.");
  });
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

export { applyDecision, loadDisk };
