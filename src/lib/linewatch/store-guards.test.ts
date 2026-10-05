import assert from "node:assert/strict";
import test from "node:test";

import { HOUSEHOLD } from "./catalog";
import { adultSample, eventFromCollector } from "./simulate";
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

function collectorStatus() {
  return { ok: true, service: "linewatch-collector", gateway: "192.168.1.1", insights: {} };
}

function collectorRow(ts: number) {
  return {
    ts,
    sourceIp: "192.168.1.44",
    host: "adult.example.test",
    mac: "00:11:22:33:44:55",
    category: "adult" as const,
    action: "blocked" as const,
    reason: "category_adult",
  };
}

function resetLiveState() {
  useLinewatch.getState().disconnectCollector();
  useLinewatch.setState({
    houseSource: "house",
    collectorUrl: "",
    collectorToken: "",
    collectorUseToken: false,
    collectorStatus: null,
    devices: [],
    events: [],
    observedEvents: [],
    alerts: [],
    archives: [],
    rules: DEFAULT_RULES,
  });
}

test("collector replay migrates a legacy random ID without duplicate alerts", async () => {
  const originalFetch = globalThis.fetch;
  const ts = Date.now() - 60_000;
  const row = collectorRow(ts);
  globalThis.fetch = (async (input) => {
    const url = String(input);
    if (url.includes("/events?")) return new Response(JSON.stringify({ events: [row] }), { status: 200 });
    if (url.endsWith("/status")) return new Response(JSON.stringify(collectorStatus()), { status: 200 });
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }) as typeof fetch;
  try {
    resetLiveState();
    const observed = eventFromCollector({ ...row, devices: [], rules: DEFAULT_RULES });
    const legacy = { ...observed, id: "ev-pre-fix-random" };
    useLinewatch.setState({ events: [legacy], observedEvents: [legacy] });

    await useLinewatch.getState().connectCollector("http://192.168.1.10:8787", false);
    let state = useLinewatch.getState();
    assert.equal(state.events.length, 1);
    assert.equal(state.observedEvents.length, 1);
    assert.equal(state.events[0]?.id, observed.id, "replay upgrades one legacy random ID to its source identity");
    assert.equal(state.alerts.length, 0, "a migrated replay cannot create a new alert");

    useLinewatch.getState().disconnectCollector();
    useLinewatch.setState({ events: [], observedEvents: [], alerts: [], devices: [], houseSource: "house" });
    await useLinewatch.getState().connectCollector("http://192.168.1.10:8787", false);
    useLinewatch.getState().disconnectCollector();
    await useLinewatch.getState().connectCollector("http://192.168.1.10:8787", false);
    state = useLinewatch.getState();
    assert.equal(state.events.length, 1, "repeated polling keeps one source row");
    assert.equal(state.alerts.length, 1, "repeated polling does not inflate a single blocked event into repeat alerts");
  } finally {
    useLinewatch.getState().disconnectCollector();
    globalThis.fetch = originalFetch;
  }
});

test("a delayed collector response cannot overwrite an explicit demo switch", async () => {
  const originalFetch = globalThis.fetch;
  const ts = Date.now() - 60_000;
  let releaseEvents: ((response: Response) => void) | undefined;
  globalThis.fetch = ((input) => {
    const url = String(input);
    if (url.includes("/events?")) {
      return new Promise<Response>((resolve) => { releaseEvents = resolve; });
    }
    return Promise.resolve(new Response(JSON.stringify(collectorStatus()), { status: 200 }));
  }) as typeof fetch;
  try {
    resetLiveState();
    const pending = useLinewatch.getState().connectCollector("http://192.168.1.10:8787", false);
    for (let attempts = 0; attempts < 10 && !releaseEvents; attempts += 1) await new Promise((resolve) => setTimeout(resolve, 0));
    assert.ok(releaseEvents, "collector event request started");
    useLinewatch.getState().useDemoHouse();
    releaseEvents!(new Response(JSON.stringify({ events: [collectorRow(ts)] }), { status: 200 }));
    await pending;
    const state = useLinewatch.getState();
    assert.equal(state.houseSource, "demo");
    assert.equal(state.collectorStatus, null);
    assert.equal(state.observedEvents.length, 0);
    assert.equal(state.events.every((event) => event.provenance.source === "demo"), true);
  } finally {
    useLinewatch.getState().disconnectCollector();
    globalThis.fetch = originalFetch;
  }
});
