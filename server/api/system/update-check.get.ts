import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import { promisify } from "node:util";
import { createError, defineEventHandler, getRequestHost, getRequestIP } from "h3";

const execFileAsync = promisify(execFile);
const runtimePackage = JSON.parse(readFileSync(`${process.cwd()}/package.json`, "utf8")) as { version: string };

function requireLocalRequest(event: Parameters<typeof getRequestIP>[0]) {
  const ip = getRequestIP(event) ?? "";
  const rawHost = getRequestHost(event);
  const host = rawHost.startsWith("[") ? rawHost.slice(1, rawHost.indexOf("]")) : rawHost.split(":", 1)[0];
  if (!["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(ip) && !["127.0.0.1", "localhost", "::1"].includes(host)) {
    throw createError({ statusCode: 403, statusMessage: "Update checks can only run from this Mac." });
  }
}

async function git(root: string, args: string[]) {
  const result = await execFileAsync("/usr/bin/git", args, {
    cwd: root,
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
    timeout: 20_000,
    maxBuffer: 1024 * 1024,
  });
  return result.stdout.trim();
}

export default defineEventHandler(async (event) => {
  requireLocalRequest(event);
  const root = process.cwd();
  try {
    await git(root, ["fetch", "--quiet", "origin", "+refs/heads/main:refs/remotes/origin/main"]);
    const [currentCommit, publishedCommit, dirty, publishedPackage] = await Promise.all([
      git(root, ["rev-parse", "HEAD"]),
      git(root, ["rev-parse", "origin/main"]),
      git(root, ["status", "--porcelain", "--untracked-files=no"]),
      git(root, ["show", "origin/main:package.json"]).then((value) => JSON.parse(value)),
    ]);
    const ancestor = currentCommit === publishedCommit
      ? true
      : await execFileAsync("/usr/bin/git", ["merge-base", "--is-ancestor", "HEAD", "origin/main"], { cwd: root })
          .then(() => true)
          .catch(() => false);
    const runtimeVersionMismatch = runtimePackage.version !== publishedPackage.version;
    return {
      currentVersion: runtimePackage.version,
      publishedVersion: publishedPackage.version,
      currentCommit: currentCommit.slice(0, 7),
      publishedCommit: publishedCommit.slice(0, 7),
      runtimeVersionMismatch,
      updateReady: (currentCommit !== publishedCommit || runtimeVersionMismatch) && ancestor,
      localChanges: Boolean(dirty),
      relationship: currentCommit === publishedCommit ? "current" : ancestor ? "behind" : "local_or_diverged",
    };
  } catch (error) {
    throw createError({ statusCode: 503, statusMessage: error instanceof Error ? error.message : "GitHub could not be checked." });
  }
});
