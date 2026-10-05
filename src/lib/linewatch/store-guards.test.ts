import assert from "node:assert/strict";
import test from "node:test";

import { HOUSEHOLD } from "./catalog";
import { adultSample } from "./simulate";
import { useLinewatch } from "./store";
import { DEFAULT_RULES } from "./types";

function resetDemoState() {
  const demo = adultSample(HOUSEHOLD.map((device) => ({ ...device })), DEFAULT_RULES, 1_700_000_000_000);
  assert.ok(demo);
  useLinewatch.setState({
    houseSource: "demo",
    collectorUrl: "",
    collectorToken: "",
    collectorUseToken: false,
    devices: HOUSEHOLD.map((device) => ({ ...device })),
    events: [demo],
    observedEvents: [],
    alerts: [],
    archives: [],
    rules: DEFAULT_RULES,
  });
  return demo;
}

test("a demo action cannot change a real-house state or policy ledger", () => {
  const demo = resetDemoState();
  useLinewatch.setState({
    houseSource: "house",
    collectorUrl: "http://192.168.1.10:8787",
    events: [],
    observedEvents: [],
  });

  useLinewatch.getState().fireDemoAlert();
  const state = useLinewatch.getState();
  assert.equal(state.events.length, 0);
  assert.equal(state.observedEvents.length, 0);
  assert.equal(state.devices.some((device) => device.quarantined), false);
  assert.equal(demo.provenance.source, "demo");
});

test("importing a real DNS row removes demo rows before it joins observations", () => {
  const demo = resetDemoState();
  const count = useLinewatch.getState().ingestLog("2026-10-05T00:00:00Z,192.168.1.44,example.test");
  const state = useLinewatch.getState();
  assert.equal(count, 1);
  assert.equal(state.houseSource, "house");
  assert.equal(state.events.some((event) => event.id === demo.id), false);
  assert.equal(state.events.every((event) => event.provenance.source !== "demo"), true);
  assert.equal(state.observedEvents.length, 1);
  assert.equal(state.observedEvents[0]?.provenance.source, "imported_dns_log");
});
