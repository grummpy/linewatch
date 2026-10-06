import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  allowConfiguredCors,
  authorizedManagementRequest,
  dnsPathState,
  resolveManagementConfig,
  writeFileAtomically,
} from "./linewatch-collector.mjs";

test("a bound DNS listener is not treated as a verified household path", () => {
  assert.equal(dnsPathState(0, null), "not_listening");
  assert.equal(dnsPathState(53, null), "awaiting_query");
  assert.equal(dnsPathState(53, 1_728_000_000_000), "observed");
});

test("collector recovery writes replace complete files without direct overwrite", () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "linewatch-recovery-"));
  try {
    const target = path.join(temp, "logs.jsonl");
    fs.writeFileSync(target, "old complete row\n", "utf8");
    writeFileAtomically(target, "new complete row\n");
    assert.equal(fs.readFileSync(target, "utf8"), "new complete row\n");
    assert.deepEqual(fs.readdirSync(temp).sort(), ["logs.jsonl"]);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});

test("collector management defaults to loopback without CORS", () => {
  const config = resolveManagementConfig({});
  assert.equal(config.bind, "127.0.0.1");
  assert.equal(config.token, "");
  assert.equal(config.allowedOrigin, null);
  assert.equal(config.forcedLoopback, false);

  const headers = new Map();
  const response = { setHeader: (name, value) => headers.set(name, value) };
  assert.equal(
    allowConfiguredCors({ headers: { host: "127.0.0.1:8787", origin: "http://127.0.0.1:8787" } }, response, config),
    true,
  );
  assert.equal(headers.get("Access-Control-Allow-Origin"), "http://127.0.0.1:8787");
  assert.equal(
    allowConfiguredCors({ headers: { host: "127.0.0.1:8787", origin: "http://rogue.example.test" } }, response, config),
    false,
  );
});

test("a LAN management bind without a token is forced back to loopback", () => {
  const config = resolveManagementConfig({ LINEWATCH_MANAGEMENT_BIND: "0.0.0.0" });
  assert.equal(config.bind, "127.0.0.1");
  assert.equal(config.forcedLoopback, true);
});

test("LAN management requires an exact bearer token and configured origin", () => {
  const config = resolveManagementConfig({
    LINEWATCH_MANAGEMENT_BIND: "0.0.0.0",
    LINEWATCH_MANAGEMENT_TOKEN: "test-token",
    LINEWATCH_MANAGEMENT_ORIGIN: "https://desk.example.test",
  });
  assert.equal(authorizedManagementRequest({ headers: { authorization: "Bearer test-token" } }, config), true);
  assert.equal(authorizedManagementRequest({ headers: { authorization: "Bearer wrong" } }, config), false);

  const headers = new Map();
  const response = { setHeader: (name, value) => headers.set(name, value) };
  assert.equal(allowConfiguredCors({ headers: { origin: "https://desk.example.test" } }, response, config), true);
  assert.equal(headers.get("Access-Control-Allow-Origin"), "https://desk.example.test");
  assert.equal(allowConfiguredCors({ headers: { origin: "https://other.example.test" } }, response, config), false);
});
