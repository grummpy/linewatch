import { spawn } from "node:child_process";
import { accessSync, constants } from "node:fs";
import { fileURLToPath } from "node:url";
import { createError, defineEventHandler, getRequestIP } from "h3";

function requireLocalRequest(event: Parameters<typeof getRequestIP>[0]) {
  const ip = getRequestIP(event) ?? "";
  if (!["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(ip)) {
    throw createError({ statusCode: 403, statusMessage: "Updates can only run from this Mac." });
  }
}

export default defineEventHandler((event) => {
  requireLocalRequest(event);
  const root = fileURLToPath(new URL("../../../", import.meta.url));
  const script = `${root}scripts/update-and-restart.sh`;
  try {
    accessSync(script, constants.X_OK);
  } catch {
    throw createError({ statusCode: 500, statusMessage: "The update helper is unavailable." });
  }

  const child = spawn("/bin/bash", [script], {
    cwd: root,
    detached: true,
    env: { ...process.env, LINEWATCH_SERVER_PID: String(process.pid) },
    stdio: "ignore",
  });
  child.unref();
  return { state: "started", message: "LineWatch is checking for updates." };
});
