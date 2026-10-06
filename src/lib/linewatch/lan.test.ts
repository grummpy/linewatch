import assert from "node:assert/strict";
import test from "node:test";

import { discoverCollector, fetchCollectorStatus, hasObservedDnsPath } from "./lan";

test("candidate discovery never sends a management bearer token", async () => {
  const originalFetch = globalThis.fetch;
  const requests: Array<{ url: string; headers: HeadersInit | undefined }> = [];
  globalThis.fetch = (async (input, init) => {
    requests.push({ url: String(input), headers: init?.headers });
    return new Response("no", { status: 404 });
  }) as typeof fetch;
  try {
    const found = await discoverCollector(
      { ips: ["192.168.42.18"], likelyGateway: "192.168.42.1", subnet: "192.168.42.0/24" },
      "",
    );
    assert.equal(found, null);
    assert.ok(requests.length > 3);
    for (const request of requests) {
      const headers = new Headers(request.headers);
      assert.equal(headers.get("authorization"), null, `discovery leaked a bearer to ${request.url}`);
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("an explicitly selected collector can still use its supplied token", async () => {
  const originalFetch = globalThis.fetch;
  let authorization = "";
  globalThis.fetch = (async (_input, init) => {
    authorization = new Headers(init?.headers).get("authorization") || "";
    return new Response(JSON.stringify({ ok: true, service: "linewatch-collector" }), { status: 200 });
  }) as typeof fetch;
  try {
    const result = await fetchCollectorStatus("http://192.168.42.10:8787", 100, "configured-token");
    assert.equal(result.ok, true);
    assert.equal(authorization, "Bearer configured-token");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("the desk requires a current collector DNS observation before claiming protection", () => {
  assert.equal(hasObservedDnsPath({ ok: true, dns: true, dnsPath: "awaiting_query" }), false);
  assert.equal(hasObservedDnsPath({ ok: true, dns: true, dnsPath: "not_verified" }), false);
  assert.equal(hasObservedDnsPath({ ok: true, dns: true, dnsPath: "observed" }), true);
});
