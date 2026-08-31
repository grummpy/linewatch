import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { HouseConnect } from "@/components/house-connect";
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
            Same Linewatch on Windows, iPhone, Android, and Mac — install the app, then watch the
            house from your pocket.
          </p>
        </header>

        <HouseConnect />

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
    </AppShell>
  );
}
