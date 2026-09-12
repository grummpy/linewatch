import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { createError, defineEventHandler, getRequestIP } from "h3";

export default defineEventHandler(async (event) => {
  const ip = getRequestIP(event) ?? "";
  if (!["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(ip)) {
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
