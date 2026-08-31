#!/usr/bin/env python3
"""Linewatch house DNS — Python
Copyright (c) 2026 Chris Decker

Stdlib only. Drop-in house resolver: bind DNS, apply policy.json, append logs.jsonl.
Run: python3 collector/python/linewatch_dns.py
"""
from __future__ import annotations

import json
import math
import os
import socket
import struct
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

DATA = Path(os.environ.get("LINEWATCH_DATA") or Path.cwd() / "data")
POLICY_FILE = DATA / "policy.json"
LOG_FILE = DATA / "logs.jsonl"
DNS_PORT = int(os.environ.get("LINEWATCH_DNS_PORT") or 53)
HTTP_PORT = int(os.environ.get("LINEWATCH_PORT") or 8787)
UPSTREAM = os.environ.get("LINEWATCH_UPSTREAM") or "1.1.1.1"

ADULT = {"pornhub.com", "xvideos.com", "xnxx.com", "xhamster.com", "onlyfans.com", "chaturbate.com"}
VPN = {"dns.google", "cloudflare-dns.com", "nordvpn.com", "expressvpn.com", "protonvpn.com", "mask.icloud.com", "mask-h2.icloud.com"}
SOCIAL = {"tiktok.com", "instagram.com", "discord.com", "snapchat.com", "reddit.com"}
GAMING = {"roblox.com", "steampowered.com", "xboxlive.com", "minecraft.net", "epicgames.com"}
SAFE = {
    "google.com": ("forcesafesearch.google.com", "216.239.38.120"),
    "www.google.com": ("forcesafesearch.google.com", "216.239.38.120"),
    "youtube.com": ("restrict.youtube.com", "216.239.38.119"),
    "www.youtube.com": ("restrict.youtube.com", "216.239.38.119"),
    "bing.com": ("strict.bing.com", "204.79.197.200"),
    "duckduckgo.com": ("safe.duckduckgo.com", "52.250.42.157"),
}


def normalize(host: str) -> str:
    h = host.strip().lower().rstrip(".")
    if h.startswith("www."):
        h = h[4:]
    return h


def matches(host: str, names: set[str]) -> bool:
    h = normalize(host)
    return any(h == n or h.endswith("." + n) for n in names)


def entropy(s: str) -> float:
    if not s:
        return 0.0
    freq: dict[str, int] = {}
    for ch in s:
        freq[ch] = freq.get(ch, 0) + 1
    n = len(s)
    return -sum((c / n) * math.log2(c / n) for c in freq.values())


def classify(host: str) -> str:
    if matches(host, ADULT):
        return "adult"
    if matches(host, VPN):
        return "vpn"
    if matches(host, SOCIAL):
        return "social"
    if matches(host, GAMING):
        return "gaming"
    return "unknown"


def dga(host: str) -> bool:
    label = normalize(host).split(".")[0]
    if len(label) < 10:
        return False
    return entropy(label) >= 3.5


def load_policy() -> dict:
    try:
        return json.loads(POLICY_FILE.read_text())
    except Exception:
        return {
            "blockAdult": True,
            "safeSearch": True,
            "blocklistGlobal": list(ADULT),
            "allowlist": ["apple.com", "windowsupdate.com", "icloud.com"],
            "devices": [],
            "profiles": {},
            "quarantine": {},
            "homeworkOn": False,
            "bedtimeOn": True,
            "bedtimeStart": 21,
            "bedtimeEnd": 7,
        }


def in_window(hour: int, start: int, end: int) -> bool:
    if start == end:
        return False
    if start > end:
        return hour >= start or hour < end
    return hour >= start and hour < end


def decide(policy: dict, host: str, ip: str) -> dict:
    h = normalize(host)
    cat = classify(h)
    devices = policy.get("devices") or []
    dev = next((d for d in devices if d.get("ip") == ip), None)
    owner = (dev or {}).get("owner") or "Unknown"
    role = (dev or {}).get("role") or "child"
    mac = (dev or {}).get("mac") or ""
    hour = time.localtime().tm_hour
    if mac and mac.lower() in {k.lower() for k in (policy.get("quarantine") or {})}:
        return {"action": "blocked", "reason": "quarantine", "category": cat, "owner": owner, "mac": mac}
    # VPN / private DNS before allowlist so mask.icloud.com is not treated as iCloud updates.
    if role == "child" and (cat == "vpn" or matches(h, VPN)):
        return {"action": "blocked", "reason": "vpn-doh", "category": "vpn", "owner": owner, "mac": mac}
    if matches(h, set(policy.get("allowlist") or [])):
        if policy.get("safeSearch") and role == "child" and h in SAFE:
            rh, rip = SAFE[h]
            return {"action": "rewritten", "reason": "safe-search", "category": "search", "rewriteIp": rip, "owner": owner, "mac": mac}
        return {"action": "allowed", "reason": "allowlist", "category": cat, "owner": owner, "mac": mac}
    if matches(h, set(policy.get("blocklistGlobal") or [])) or (cat == "adult" and policy.get("blockAdult", True) and role == "child"):
        return {"action": "blocked", "reason": "global-adult" if cat == "adult" else "global-blocklist", "category": cat, "owner": owner, "mac": mac}
    if role == "child" and dga(h):
        return {"action": "blocked", "reason": "dga-entropy", "category": "unknown", "owner": owner, "mac": mac}
    if policy.get("homeworkOn") and in_window(hour, int(policy.get("homeworkStart") or 16), int(policy.get("homeworkEnd") or 18)) and cat in ("gaming", "social") and role == "child":
        return {"action": "blocked", "reason": "homework", "category": cat, "owner": owner, "mac": mac}
    if policy.get("bedtimeOn") and in_window(hour, int(policy.get("bedtimeStart") or 21), int(policy.get("bedtimeEnd") or 7)) and cat in ("social", "gaming", "streaming") and role == "child":
        return {"action": "blocked", "reason": "bedtime", "category": cat, "owner": owner, "mac": mac}
    if policy.get("safeSearch") and role == "child" and h in SAFE:
        rh, rip = SAFE[h]
        return {"action": "rewritten", "reason": "safe-search", "category": "search", "rewriteIp": rip, "owner": owner, "mac": mac}
    return {"action": "allowed", "reason": "ok", "category": cat, "owner": owner, "mac": mac}


def append_log(host: str, ip: str, d: dict) -> None:
    DATA.mkdir(parents=True, exist_ok=True)
    row = {
        "ts": int(time.time() * 1000),
        "deviceMac": d.get("mac") or "",
        "sourceIp": ip,
        "requestedDomain": host,
        "category": d.get("category"),
        "action": d.get("action"),
        "reason": d.get("reason"),
        "owner": d.get("owner"),
        "entropy": round(entropy(normalize(host).split(".")[0]), 3),
    }
    with LOG_FILE.open("a", encoding="utf-8") as f:
        f.write(json.dumps(row) + "\n")


def decode_qname(buf: bytes, off: int) -> tuple[str, int]:
    labels = []
    while off < len(buf):
        n = buf[off]
        if n == 0:
            return ".".join(labels).lower(), off + 1
        if n & 0xC0 == 0xC0:
            return ".".join(labels).lower(), off + 2
        labels.append(buf[off + 1 : off + 1 + n].decode("ascii", "ignore"))
        off += 1 + n
    return "", off


def sinkhole(query: bytes, ip: str = "0.0.0.0") -> bytes:
    if len(query) < 12:
        return b""
    qid = query[:2]
    name, qend = decode_qname(query, 12)
    question = query[12 : qend + 4] if qend + 4 <= len(query) else query[12:]
    header = qid + struct.pack("!HHHHH", 0x8180, 1, 1, 0, 0)
    parts = [int(x) & 255 for x in ip.split(".")]
    rr = b"\xc0\x0c" + struct.pack("!HHIH", 1, 1, 30, 4) + bytes(parts)
    return header + question + rr


def answer_ip(query: bytes, ip: str) -> bytes:
    return sinkhole(query, ip)


def forward(query: bytes) -> bytes | None:
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.settimeout(1.4)
    try:
        sock.sendto(query, (UPSTREAM, 53))
        data, _ = sock.recvfrom(4096)
        return data
    except OSError:
        return None
    finally:
        sock.close()


def handle_dns(data: bytes, addr, sock: socket.socket, policy: dict) -> None:
    name, _ = decode_qname(data, 12)
    if not name:
        return
    d = decide(policy, name, addr[0])
    append_log(name, addr[0], d)
    if d["action"] == "blocked":
        reply = sinkhole(data)
    elif d["action"] == "rewritten" and d.get("rewriteIp"):
        reply = answer_ip(data, d["rewriteIp"])
    else:
        reply = forward(data) or sinkhole(data)
    if reply:
        sock.sendto(reply, addr)


def read_logs(since: int = 0) -> list:
    rows = []
    try:
        for line in LOG_FILE.read_text(encoding="utf-8").splitlines():
            if not line.strip():
                continue
            try:
                ev = json.loads(line)
            except json.JSONDecodeError:
                continue
            ts = int(ev.get("ts") or 0)
            if ts <= since:
                continue
            rows.append(
                {
                    "ts": ts,
                    "sourceIp": ev.get("sourceIp") or "",
                    "host": ev.get("requestedDomain") or ev.get("host") or "",
                    "mac": ev.get("deviceMac") or ev.get("mac") or "",
                    "category": ev.get("category") or "unknown",
                    "action": ev.get("action") or "allowed",
                    "reason": ev.get("reason") or "ok",
                    "entropy": ev.get("entropy") or 0,
                    "owner": ev.get("owner") or "Unknown",
                }
            )
    except OSError:
        pass
    return rows[-800:]


class Api(BaseHTTPRequestHandler):
    policy: dict = {}

    def log_message(self, fmt: str, *args) -> None:  # noqa: A003
        return

    def _send(self, code: int, obj) -> None:
        raw = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def do_OPTIONS(self) -> None:  # noqa: N802
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self) -> None:  # noqa: N802
        from urllib.parse import parse_qs, urlparse

        parsed = urlparse(self.path)
        qs = parse_qs(parsed.query)
        since = 0
        try:
            since = int((qs.get("since") or ["0"])[0])
        except ValueError:
            since = 0
        if parsed.path.startswith("/status"):
            self._send(
                200,
                {
                    "ok": True,
                    "service": "linewatch-collector",
                    "runtime": "python",
                    "alwaysOn": True,
                    "retentionDays": 7,
                    "dns": True,
                    "eventCount": len(read_logs()),
                },
            )
            return
        if parsed.path.startswith("/events"):
            events = read_logs(since)
            self._send(200, {"events": events, "total": len(events)})
            return
        if parsed.path.startswith("/logs"):
            self._send(200, {"logs": read_logs(since)})
            return
        if parsed.path.startswith("/policy"):
            self._send(200, self.policy)
            return
        self._send(200, {"ok": True, "service": "linewatch-collector", "runtime": "python"})


def serve_http(policy: dict) -> None:
    Api.policy = policy
    httpd = ThreadingHTTPServer(("0.0.0.0", HTTP_PORT), Api)
    print(f"Linewatch Python API on {HTTP_PORT}", flush=True)
    httpd.serve_forever()


def main() -> int:
    policy = load_policy()
    threading.Thread(target=serve_http, args=(policy,), daemon=True).start()
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    port = DNS_PORT
    try:
        sock.bind(("0.0.0.0", port))
    except OSError:
        port = int(os.environ.get("LINEWATCH_DNS_FALLBACK") or 5353)
        sock.bind(("0.0.0.0", port))
        print(f"House DNS fallback {port} — run as administrator for the house resolver", flush=True)
    else:
        print(f"House DNS on {port}", flush=True)
    print("Chris Decker · Linewatch Python collector", flush=True)
    while True:
        data, addr = sock.recvfrom(4096)
        try:
            handle_dns(data, addr, sock, load_policy())
        except Exception as exc:  # noqa: BLE001
            print("dns error", exc, file=sys.stderr)


if __name__ == "__main__":
    raise SystemExit(main())
