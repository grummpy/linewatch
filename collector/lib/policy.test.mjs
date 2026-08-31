/**
 * Linewatch policy tests — Chris Decker
 */
import test from "node:test";
import assert from "node:assert/strict";
import { decodeQuery, encodeResponse, sinkhole, TYPE_A } from "./dns-packet.mjs";
import {
  decide,
  defaultPolicy,
  dgaScore,
  shannonEntropy,
  buildInsights,
  shouldQuarantine,
  sentenceFor,
  inWindow,
} from "./policy.mjs";

function childPolicy(extra = {}) {
  const p = defaultPolicy();
  p.devices = [{ ip: "192.168.1.31", mac: "aa:bb:cc:dd:ee:ff", name: "Sam's iPad", owner: "Sam", role: "child" }];
  p.profiles = { Sam: { role: "child", autoQuarantine: true, blocks: [] } };
  return { ...p, ...extra };
}

test("adult is blocked for a child", () => {
  const d = decide(childPolicy(), "www.pornhub.com", "192.168.1.31");
  assert.equal(d.action, "blocked");
  assert.equal(d.category, "adult");
});

test("system updates still leave", () => {
  const d = decide(childPolicy(), "windowsupdate.com", "192.168.1.31");
  assert.equal(d.action, "allowed");
});

test("VPN / DoH is blocked for a child", () => {
  const d = decide(childPolicy(), "mask.icloud.com", "192.168.1.31");
  assert.equal(d.action, "blocked");
  assert.equal(d.reason, "vpn-doh");
});

test("safe search rewrite for google", () => {
  const d = decide(childPolicy(), "www.google.com", "192.168.1.31");
  assert.equal(d.action, "rewritten");
  assert.equal(d.rewriteHost, "forcesafesearch.google.com");
});

test("homework window blocks gaming", () => {
  const hour = 16;
  const ts = new Date();
  ts.setHours(hour, 5, 0, 0);
  const d = decide(childPolicy({ homeworkOn: true }), "roblox.com", "192.168.1.31", ts.getTime());
  assert.equal(d.action, "blocked");
  assert.equal(d.reason, "homework");
});

test("DGA entropy flags random labels", () => {
  const hit = dgaScore("x7q9k2m1p0w8.biz");
  assert.equal(hit.flagged, true);
  assert.ok(hit.entropy >= 3.2);
  const safe = dgaScore("youtube.com");
  assert.equal(safe.flagged, false);
});

test("shannon entropy of aaaa is low", () => {
  assert.ok(shannonEntropy("aaaa") < 1);
  assert.ok(shannonEntropy("x7q9k2m1") > 2.5);
});

test("quarantine after three adult hits", () => {
  const now = Date.now();
  const logs = [0, 1, 2].map((i) => ({
    ts: now - i * 60_000,
    mac: "aa:bb:cc:dd:ee:ff",
    action: "blocked",
    category: "adult",
    reason: "global-adult",
  }));
  assert.equal(shouldQuarantine(logs, "aa:bb:cc:dd:ee:ff", now, true), true);
  assert.equal(shouldQuarantine(logs, "aa:bb:cc:dd:ee:ff", now, false), false);
});

test("insights speak in sentences", () => {
  const now = Date.now();
  const logs = [
    { ts: now, host: "pornhub.com", action: "blocked", category: "adult", owner: "Sam", sourceIp: "192.168.1.31" },
    { ts: now, host: "pornhub.com", action: "blocked", category: "adult", owner: "Sam", sourceIp: "192.168.1.31" },
    { ts: now, host: "pornhub.com", action: "blocked", category: "adult", owner: "Sam", sourceIp: "192.168.1.31" },
  ];
  const ins = buildInsights(logs, [], now);
  assert.ok(ins.adultAttempts === 3);
  assert.ok(ins.sentences[0].includes("adult"));
  assert.ok(ins.repeatOffenders.length >= 1);
});

test("bedtime window wraps midnight", () => {
  assert.equal(inWindow(22, 21, 7), true);
  assert.equal(inWindow(2, 21, 7), true);
  assert.equal(inWindow(12, 21, 7), false);
});

test("contextual sentence", () => {
  const s = sentenceFor({ owner: "Riley", host: "pornhub.com", category: "adult", reason: "global-adult" }, { count: 4, mins: 8 });
  assert.match(s, /Riley tried pornhub.com 4 times/);
});

test("dns packet round trip sinkhole", () => {
  const qname = Buffer.from([3, 0x77, 0x77, 0x77, 6, 0x67, 0x6f, 0x6f, 0x67, 0x6c, 0x65, 3, 0x63, 0x6f, 0x6d, 0, 0, 1, 0, 1]);
  const header = Buffer.alloc(12);
  header.writeUInt16BE(0x1234, 0);
  header.writeUInt16BE(0x0100, 2);
  header.writeUInt16BE(1, 4);
  const buf = Buffer.concat([header, qname]);
  const q = decodeQuery(buf);
  assert.equal(q.name, "www.google.com");
  assert.equal(q.qtype, TYPE_A);
  const resp = sinkhole(q);
  assert.ok(resp.length > 12);
  assert.equal(resp.readUInt16BE(0), 0x1234);
});
