#!/usr/bin/env node
/**
 * Linewatch click-to-run installer
 * Copyright (c) 2026 Chris Decker
 *
 * Double-click Install Linewatch on Mac or Windows. This computer becomes
 * house DNS, the parent desk opens, and the phone finds it on this Wi-Fi.
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA = path.join(ROOT, "data");

function lanIp() {
  for (const rows of Object.values(os.networkInterfaces())) {
    for (const r of rows || []) {
      if (r.internal || r.family === "IPv6" || r.family === 6) continue;
      const ip = r.address;
      if (/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(ip)) return ip;
    }
  }
  return "";
}

function which(cmd) {
  const paths = (process.env.PATH || "").split(path.delimiter);
  const ext = process.platform === "win32" ? [".cmd", ".exe", ""] : [""];
  for (const dir of paths) {
    for (const e of ext) {
      const p = path.join(dir, cmd + e);
      if (fs.existsSync(p)) return p;
    }
  }
  return "";
}

function openBrowser(url) {
  const plat = process.platform;
  const cmd = plat === "darwin" ? "open" : plat === "win32" ? "cmd" : "xdg-open";
  const args = plat === "win32" ? ["/c", "start", "", url] : [url];
  spawn(cmd, args, { detached: true, stdio: "ignore" }).unref();
}

function start(command, args, extraEnv = {}) {
  const child = spawn(command, args, {
    cwd: ROOT,
    env: { ...process.env, ...extraEnv },
    stdio: "inherit",
    detached: false,
  });
  child.on("exit", (code) => {
    if (code && code !== 0) console.error(`${command} exited ${code}`);
  });
  return child;
}

function waitHttp(url, tries = 40) {
  return new Promise((resolve) => {
    const tick = (n) => {
      const req = http.get(url, (res) => {
        res.resume();
        resolve(true);
      });
      req.on("error", () => {
        if (n <= 0) resolve(false);
        else setTimeout(() => tick(n - 1), 250);
      });
    };
    tick(tries);
  });
}

async function main() {
  console.log("Linewatch — Chris Decker");
  console.log("Installing the house watch on this computer…");
  fs.mkdirSync(DATA, { recursive: true });

  const ip = lanIp();
  const node = process.execPath;
  const python = which("python3") || which("python");
  const javac = which("javac");

  const collectorJs = path.join(ROOT, "collector", "linewatch-collector.mjs");
  if (!fs.existsSync(collectorJs)) {
    console.error("Missing collector. Unzip the Linewatch folder first.");
    process.exit(1);
  }

  console.log("Starting house DNS + parent API…");
  start(node, [collectorJs], { LINEWATCH_DATA: DATA });

  const ready = await waitHttp("http://127.0.0.1:8787/status");
  if (!ready) {
    if (python) {
      console.log("Node API slow — Python collector is also in collector/python if you need it.");
    }
    if (javac) {
      console.log("Java collector is in collector/java.");
    }
  }

  const desk = ip ? `http://${ip}:8787` : "http://127.0.0.1:8787";
  console.log("");
  console.log("This computer is the watch.");
  if (ip) console.log(`  Address on this Wi-Fi: ${ip}`);
  console.log("  1. On your router, set DNS to this computer.");
  console.log("  2. On your phone (same Wi-Fi), open Linewatch — it finds this box.");
  console.log("  3. Keep this window open, or use the always-on service in SETUP.");
  console.log("");
  openBrowser(desk);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
