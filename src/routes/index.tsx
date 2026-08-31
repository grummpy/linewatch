/**
 * Linewatch — household outbound watch
 * Copyright (c) 2026 Chris Decker
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertBanner } from "@/components/alert-banner";
import { AppShell } from "@/components/app-shell";
import { EventDetail } from "@/components/event-detail";
import { KpiStrip } from "@/components/kpi-strip";
import { LiveFeed } from "@/components/live-feed";
import { useLinewatch } from "@/lib/linewatch/store";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const running = useLinewatch((s) => s.running);
  const mode = useLinewatch((s) => s.rules.firewallMode);
  const houseSource = useLinewatch((s) => s.houseSource);
  const collectorStatus = useLinewatch((s) => s.collectorStatus);
  const discovering = useLinewatch((s) => s.discovering);
  const lanProbe = useLinewatch((s) => s.lanProbe);
  const house = houseSource === "house";
  const live = house && collectorStatus?.ok;
  const routerIp = collectorStatus?.gateway || lanProbe?.likelyGateway;

  return (
    <AppShell>
      <div className="flex flex-col gap-5">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-medium tracking-tight md:text-3xl">Live</h1>
            <p className="mt-1 max-w-xl text-sm text-muted">
              {live
                ? "Your house. Collector keeps watching when this phone is closed. Logs last 7 days."
                : discovering
                  ? "Looking for your router on this Wi-Fi…"
                  : "Opens looking for your router. Connect once — the collector computer does the rest."}
            </p>
          </div>
          <p className="font-mono text-[11px] tracking-wide text-subtle uppercase">
            {discovering
              ? "Finding router"
              : live
                ? `House ${routerIp ?? "line"} · 7-day log`
                : house
                  ? "Collector off · last 7 days"
                  : running
                    ? `Demo · firewall ${mode}`
                    : "Idle"}
          </p>
        </header>
        {!live ? (
          <p className="rounded-lg bg-elevated px-4 py-3 text-sm text-muted">
            {discovering
              ? routerIp
                ? `Router looks like ${routerIp}. Searching for the collector…`
                : "Searching this Wi-Fi for your router and collector…"
              : routerIp
                ? `Router looks like ${routerIp}. `
                : ""}
            {!discovering ? (
              <>
                Setup is one screen:{" "}
                <Link to="/settings" className="text-fg underline-offset-2 hover:underline">
                  Setup
                </Link>
                . Leave a Pi or PC on; this app can close.
              </>
            ) : null}
          </p>
        ) : null}
        <AlertBanner />
        <KpiStrip />
        <LiveFeed />
        <EventDetail />
      </div>
    </AppShell>
  );
}
