import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { createError, defineEventHandler, getRequestHost, getRequestIP } from "h3";

export default defineEventHandler(async (event) => {
  const ip = getRequestIP(event) ?? "";
  const rawHost = getRequestHost(event);
  const host = rawHost.startsWith("[") ? rawHost.slice(1, rawHost.indexOf("]")) : rawHost.split(":", 1)[0];
  const localIp = ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(ip);
  const localHost = ["127.0.0.1", "localhost", "::1"].includes(host);
  if (!localIp && !localHost) {
    throw createError({ statusCode: 403, statusMessage: "Update status is only available on this Mac." });
  }
  try {
    return JSON.parse(
      await readFile(join(homedir(), "Library/Application Support/Linewatch/update-status.json"), "utf8"),
    );
  } catch {
    return { state: "idle", message: "Ready to update.", version: null, updatedAt: null };
  }
});
