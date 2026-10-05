import assert from "node:assert/strict";
import test from "node:test";

import { eventFromCollector } from "./simulate";
import { DEFAULT_RULES, type Device } from "./types";

test("collector DNS events do not borrow generated traffic fields", () => {
  const devices: Device[] = [{
    id: "device-1",
    name: "Test phone",
    owner: "Test owner",
    role: "child",
    ip: "192.168.1.20",
    mac: "00:11:22:33:44:55",
    kind: "phone",
    blocked: false,
    lastSeen: 0,
  }];
  const event = eventFromCollector({
    host: "example.test",
    sourceIp: "192.168.1.20",
    ts: 1_700_000_000_000,
    category: "unknown",
    action: "allowed",
    devices,
    rules: DEFAULT_RULES,
  });

  assert.equal(event.provenance.source, "collector_dns");
  assert.equal(event.destIp, "not observed");
  assert.equal(event.destRegion, "not observed");
  assert.equal(event.bytes, 0);
  assert.equal(event.path, "unknown");
  assert.equal(event.protocol, "dns");
  assert.equal(event.destPort, 53);
});

test("the same collector observation keeps a stable replay identity", () => {
  const devices: Device[] = [{
    id: "device-1",
    name: "Test phone",
    owner: "Test owner",
    role: "child",
    ip: "192.168.1.20",
    mac: "00:11:22:33:44:55",
    kind: "phone",
    blocked: false,
    lastSeen: 0,
  }];
  const input = {
    host: "example.test",
    sourceIp: "192.168.1.20",
    ts: 1_700_000_000_000,
    mac: "00:11:22:33:44:55",
    devices,
    rules: DEFAULT_RULES,
  };
  assert.equal(eventFromCollector(input).id, eventFromCollector(input).id);
});
