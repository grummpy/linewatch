/**
 * Linewatch on-demand LAN exposure scan
 * Copyright (c) 2026 Chris Decker
 *
 * Not a full nmap. TCP connect to dangerous ports on this Wi-Fi only.
 * Parent taps Scan — it does not run in the background.
 */
import net from "node:net";

export const DANGEROUS = [
  { port: 21, label: "FTP" },
  { port: 22, label: "SSH" },
  { port: 23, label: "Telnet", severity: "high" },
  { port: 135, label: "RPC" },
  { port: 139, label: "NetBIOS" },
  { port: 445, label: "SMB", severity: "high" },
  { port: 1433, label: "MSSQL" },
  { port: 3306, label: "MySQL" },
  { port: 3389, label: "RDP", severity: "high" },
  { port: 5432, label: "Postgres" },
  { port: 5555, label: "ADB", severity: "high" },
  { port: 5900, label: "VNC", severity: "high" },
  { port: 6379, label: "Redis" },
  { port: 2323, label: "Telnet-alt", severity: "high" },
  { port: 9200, label: "Elasticsearch" },
  { port: 11211, label: "Memcached" },
  { port: 27017, label: "MongoDB" },
];

function probe(ip, port, timeout = 350) {
  return new Promise((resolve) => {
    const sock = net.connect({ host: ip, port });
    const t = setTimeout(() => {
      sock.destroy();
      resolve(false);
    }, timeout);
    sock.on("connect", () => {
      clearTimeout(t);
      sock.destroy();
      resolve(true);
    });
    sock.on("error", () => {
      clearTimeout(t);
      resolve(false);
    });
  });
}

function isPrivateIp(ip) {
  const p = String(ip).split(".").map(Number);
  if (p.length !== 4 || p.some((n) => Number.isNaN(n))) return false;
  if (p[0] === 10) return true;
  if (p[0] === 192 && p[1] === 168) return true;
  if (p[0] === 172 && p[1] >= 16 && p[1] <= 31) return true;
  return false;
}

/**
 * Scan known LAN devices only (and the gateway). Never the public internet.
 * @param {{ ip: string, name?: string, mac?: string }[]} devices
 * @param {string | null} gateway
 */
export async function scanLan(devices, gateway) {
  const targets = [];
  const prefix = gateway ? String(gateway).split(".").slice(0, 3).join(".") : "";
  const add = (ip, name, mac) => {
    if (!ip || !isPrivateIp(ip)) return;
    if (prefix && ip !== gateway && !String(ip).startsWith(`${prefix}.`)) return;
    if (targets.some((t) => t.ip === ip)) return;
    targets.push({ ip, name: name || ip, mac: mac || "" });
  };
  for (const d of devices || []) add(d.ip, d.name, d.mac);
  if (gateway) add(gateway, "Router", "");

  const findings = [];
  await Promise.all(
    targets.map(async (t) => {
      await Promise.all(
        DANGEROUS.map(async (svc) => {
          const open = await probe(t.ip, svc.port);
          if (open) {
            findings.push({
              ip: t.ip,
              name: t.name,
              mac: t.mac,
              port: svc.port,
              label: svc.label,
              severity: svc.severity === "high" ? "high" : "medium",
              sentence:
                svc.severity === "high"
                  ? `${t.name} (${t.ip}) has ${svc.label} open. That is a common exposure — review it.`
                  : `${t.name} (${t.ip}) answers on ${svc.label}.`,
            });
          }
        }),
      );
    }),
  );
  return {
    at: Date.now(),
    targets: targets.length,
    findings,
    ok: true,
  };
}
