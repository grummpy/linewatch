/**
 * Linewatch — household outbound watch
 * Copyright (c) 2026 Chris Decker
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { HouseConnect } from "@/components/house-connect";
import { ScanPanel } from "@/components/scan-panel";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useLinewatch } from "@/lib/linewatch/store";

export const Route = createFileRoute("/settings")({ component: SettingsPage });

function SettingsPage() {
  const rules = useLinewatch((s) => s.rules);
  const setRules = useLinewatch((s) => s.setRules);
  const running = useLinewatch((s) => s.running);
  const start = useLinewatch((s) => s.start);
  const stop = useLinewatch((s) => s.stop);
  const fireDemoAlert = useLinewatch((s) => s.fireDemoAlert);
  const ingestLog = useLinewatch((s) => s.ingestLog);
  const ingestNote = useLinewatch((s) => s.ingestNote);
  const addToBlocklist = useLinewatch((s) => s.addToBlocklist);
  const removeFromBlocklist = useLinewatch((s) => s.removeFromBlocklist);
  const [log, setLog] = useState("");
  const [blockHost, setBlockHost] = useState("");
  const [updateState, setUpdateState] = useState<"checking" | "available" | "current" | "blocked" | "running" | "succeeded" | "failed">("checking");
  const [updateMessage, setUpdateMessage] = useState("Checking the published GitHub version…");
  const updatePoll = useRef<number | null>(null);

  const checkForUpdate = useCallback(async () => {
    setUpdateState("checking");
    setUpdateMessage("Checking the published GitHub version…");
    try {
      const response = await fetch("/api/system/update-check", { cache: "no-store" });
      if (!response.ok) throw new Error("GitHub could not be checked right now.");
      const result = await response.json();
      const versions = `Installed ${result.currentVersion} · Published ${result.publishedVersion}`;
      if (result.updateReady && result.localChanges) {
        setUpdateState("blocked");
        setUpdateMessage(`${versions}. An update is ready, but tracked local changes need review first. Your household data is protected.`);
      } else if (result.updateReady) {
        setUpdateState("available");
        setUpdateMessage(`${versions}. An update is ready. Your household setup and saved data will be preserved.`);
      } else {
        setUpdateState("current");
        setUpdateMessage(`${versions}. LineWatch is up to date.`);
      }
    } catch (error) {
      setUpdateState("failed");
      setUpdateMessage(error instanceof Error ? error.message : "GitHub could not be checked right now.");
    }
  }, []);

  useEffect(() => {
    void checkForUpdate();
    const interval = window.setInterval(() => void checkForUpdate(), 15 * 60_000);
    return () => {
      window.clearInterval(interval);
      if (updatePoll.current) window.clearTimeout(updatePoll.current);
    };
  }, [checkForUpdate]);

  async function updateAndRestart() {
    setUpdateState("running");
    setUpdateMessage("Starting update…");
    try {
      const response = await fetch("/api/system/update", { method: "POST" });
      if (!response.ok) throw new Error((await response.text()) || "Update could not start.");
      setUpdateMessage("Checking GitHub and installing the latest release…");
      const started = Date.now();
      const poll = async () => {
        try {
          const status = await fetch("/api/system/update-status", { cache: "no-store" }).then((r) => r.json());
          setUpdateMessage(status.message || "Updating…");
          if (status.state === "failed") {
            setUpdateState("failed");
            return;
          }
          if (status.state === "succeeded") {
            setUpdateState("succeeded");
            window.setTimeout(() => window.location.reload(), 3500);
            return;
          }
        } catch {
          setUpdateMessage("LineWatch is restarting…");
        }
        if (Date.now() - started < 5 * 60_000) updatePoll.current = window.setTimeout(poll, 2000);
        else {
          setUpdateState("failed");
          setUpdateMessage("The update is taking longer than expected. Check the update log.");
        }
      };
      updatePoll.current = window.setTimeout(poll, 1000);
    } catch (error) {
      setUpdateState("failed");
      setUpdateMessage(error instanceof Error ? error.message : "Update could not start.");
    }
  }

  async function enableNotify() {
    if (typeof Notification === "undefined") return;
    const perm = await Notification.requestPermission();
    setRules({ browserNotify: perm === "granted" });
  }

  return (
    <AppShell>
      <div className="mx-auto flex max-w-2xl flex-col gap-8">
        <header>
          <h1 className="text-2xl font-medium tracking-tight md:text-3xl">Setup</h1>
          <p className="mt-1 text-sm text-muted">
            Point this at your house. The collector computer stays on; this phone can close.
          </p>
        </header>

        <HouseConnect />

        <ScanPanel />

        <section className="rounded-lg bg-surface p-4 shadow-[var(--shadow-border)] md:p-5">
          <h2 className="text-sm font-medium">Application update</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted" role="status" aria-live="polite">
            {updateMessage}
          </p>
          <Button
            className={updateState === "available" ? "mt-4 animate-pulse bg-emerald-500 text-slate-950 shadow-[0_0_22px_rgba(16,185,129,0.5)] [animation-duration:2.8s] hover:bg-emerald-400 motion-reduce:animate-none" : "mt-4"}
            disabled={["checking", "current", "blocked", "running", "succeeded"].includes(updateState)}
            onClick={() => updateState === "failed" ? void checkForUpdate() : void updateAndRestart()}
          >
            {updateState === "checking" ? "Checking…" : updateState === "available" ? "Update & Restart" : updateState === "current" ? "Up to Date" : updateState === "blocked" ? "Local Changes Need Review" : updateState === "running" ? "Updating…" : updateState === "succeeded" ? "Restarting…" : "Check Again"}
          </Button>
        </section>

        <details className="text-sm">
          <summary className="cursor-pointer text-muted">Phone install, alerts, paste a log</summary>
          <div className="mt-4 flex flex-col gap-8">

        <section className="rounded-lg bg-surface p-4 shadow-[var(--shadow-border)] md:p-5">
          <h2 className="text-sm font-medium">Install the app</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Linewatch is a progressive web app. That is the Windows, iPhone, and Android build — one
            live desk, installed on modern OS releases (Windows 10 22H2 / Windows 11, iOS 16+,
            Android 10+).
          </p>
          <ul className="mt-4 space-y-4 text-sm">
            <li>
              <p className="font-medium">Windows</p>
              <p className="mt-1 text-muted">
                Edge or Chrome on Windows 11 (or Windows 10 22H2+): menu → Apps → Install this site
                as an app. Pin to Start or the taskbar. Opens in its own window.
              </p>
            </li>
            <li>
              <p className="font-medium">iPhone</p>
              <p className="mt-1 text-muted">
                Safari on iOS 16 or later: Share → Add to Home Screen. It runs full-screen like a
                native app, with live feed and alerts. Chrome on iOS cannot install Home Screen apps.
              </p>
            </li>
            <li>
              <p className="font-medium">Android</p>
              <p className="mt-1 text-muted">
                Chrome on Android 10 or later: Install app from the address bar or menu. Add to the
                home screen and app drawer. Notifications work once you allow them here.
              </p>
            </li>
            <li>
              <p className="font-medium">Mac</p>
              <p className="mt-1 text-muted">
                Safari: File → Add to Dock. Chrome: Install app. Same windowed desk as Windows.
              </p>
            </li>
          </ul>
          <p className="mt-4 text-xs leading-relaxed text-muted">
            There is no separate App Store / Play binary from this desk — the installed web app{" "}
            <em>is</em> the iPhone, Android, and Windows version, and it tracks current OS releases.
            House firewall lives under{" "}
            <Link to="/house" className="text-fg underline-offset-2 hover:underline">
              House
            </Link>
            .
          </p>
        </section>

        <section className="rounded-lg bg-surface p-4 shadow-[var(--shadow-border)] md:p-5">
          <h2 className="text-sm font-medium">Alerts</h2>
          <div className="mt-3 divide-y divide-border">
            <Switch
              checked={rules.alertAdult}
              onCheckedChange={(v) => setRules({ alertAdult: v })}
              label="Adult destinations"
              description="Fire immediately when a classified adult host is requested."
            />
            <Switch
              checked={rules.alertAfterHoursSocial}
              onCheckedChange={(v) => setRules({ alertAfterHoursSocial: v })}
              label="Kids on social after hours"
              description={`Watch alerts between ${String(rules.quietStartHour).padStart(2, "0")}:00 and ${String(rules.quietEndHour).padStart(2, "0")}:00.`}
            />
            <Switch
              checked={rules.sound}
              onCheckedChange={(v) => setRules({ sound: v })}
              label="Sound"
              description="Two-tone chime on adult hits."
            />
            <Switch
              checked={rules.browserNotify}
              onCheckedChange={(v) => {
                if (v) void enableNotify();
                else setRules({ browserNotify: false });
              }}
              label="Desktop notifications"
              description="System banner with device, host, and IPs."
            />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <label className="text-xs text-muted">
              Quiet starts
              <input
                type="number"
                min={0}
                max={23}
                value={rules.quietStartHour}
                onChange={(e) => setRules({ quietStartHour: Number(e.target.value) || 0 })}
                className="mt-1 h-11 w-full rounded-sm bg-elevated px-3 font-mono text-sm text-fg shadow-[var(--shadow-border)]"
              />
            </label>
            <label className="text-xs text-muted">
              Quiet ends
              <input
                type="number"
                min={0}
                max={23}
                value={rules.quietEndHour}
                onChange={(e) => setRules({ quietEndHour: Number(e.target.value) || 0 })}
                className="mt-1 h-11 w-full rounded-sm bg-elevated px-3 font-mono text-sm text-fg shadow-[var(--shadow-border)]"
              />
            </label>
          </div>
        </section>

        <section className="rounded-lg bg-surface p-4 shadow-[var(--shadow-border)] md:p-5">
          <h2 className="text-sm font-medium">Demo collector</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Until your router is pointed at the house collector, Linewatch runs a labeled demo
            household so you can learn the desk. Pause that here. Sidewalk is tagged from Amazon /
            Ring / Tile hosts, not the 900 MHz radio.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => (running ? stop() : start())}>
              {running ? "Pause demo feed" : "Resume demo feed"}
            </Button>
            <Button variant="danger" onClick={fireDemoAlert}>
              Fire adult sample
            </Button>
          </div>
        </section>

        <section className="rounded-lg bg-surface p-4 shadow-[var(--shadow-border)] md:p-5">
          <h2 className="text-sm font-medium">Ingest DNS log</h2>
          <p className="mt-2 text-sm text-muted">
            Paste Pi-hole / dnsmasq lines, or <span className="font-mono text-xs">time,source_ip,host</span>.
          </p>
          <textarea
            value={log}
            onChange={(e) => setLog(e.target.value)}
            rows={5}
            placeholder={"Aug 30 12:14:01 query[A] pornhub.com from 192.168.1.31"}
            className="mt-3 w-full rounded-sm bg-elevated p-3 font-mono text-xs text-fg shadow-[var(--shadow-border)]"
          />
          <div className="mt-3 flex items-center gap-3">
            <Button
              size="sm"
              onClick={() => {
                ingestLog(log);
                setLog("");
              }}
            >
              Ingest
            </Button>
            {ingestNote ? <p className="text-xs text-muted">{ingestNote}</p> : null}
          </div>
        </section>

        <section className="rounded-lg bg-surface p-4 shadow-[var(--shadow-border)] md:p-5">
          <h2 className="text-sm font-medium">Destination blocklist</h2>
          <p className="mt-1 text-xs text-muted">
            Quick add. Full house firewall is on the House tab.
          </p>
          <form
            className="mt-3 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              addToBlocklist(blockHost);
              setBlockHost("");
            }}
          >
            <input
              value={blockHost}
              onChange={(e) => setBlockHost(e.target.value)}
              placeholder="host to block"
              className="h-11 min-w-0 flex-1 rounded-sm bg-elevated px-3 font-mono text-sm shadow-[var(--shadow-border)]"
            />
            <Button type="submit" size="sm" className="h-11">
              Add
            </Button>
          </form>
          {rules.blocklist.length === 0 ? (
            <p className="mt-3 text-xs text-muted">Empty.</p>
          ) : (
            <ul className="mt-3 space-y-1">
              {rules.blocklist.map((h) => (
                <li key={h} className="flex items-center justify-between gap-2 text-sm">
                  <span className="font-mono text-xs">{h}</span>
                  <button type="button" className="h-11 px-2 text-xs text-muted hover:text-fg" onClick={() => removeFromBlocklist(h)}>
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
          </div>
        </details>
      </div>
    </AppShell>
  );
}
