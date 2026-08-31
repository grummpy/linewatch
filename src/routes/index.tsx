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
  const house = houseSource === "house";

  return (
    <AppShell>
      <div className="flex flex-col gap-5">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-medium tracking-tight md:text-3xl">Live operations</h1>
            <p className="mt-1 max-w-xl text-sm text-muted">
              {house
                ? "This feed is your LAN — collector to the router. Filter a person, split Sidewalk from WAN."
                : "Demo household until you connect a collector. Filter a person. Split Sidewalk from WAN."}
            </p>
          </div>
          <p className="font-mono text-[11px] tracking-wide text-subtle uppercase">
            {house
              ? `House ${collectorStatus?.gateway ?? "line"} · firewall ${mode}`
              : running
                ? `Demo live · firewall ${mode}`
                : "Idle"}
          </p>
        </header>
        {!house ? (
          <p className="rounded-lg bg-elevated px-4 py-3 text-sm text-muted">
            Riley / Sam are a demo. To watch the real router, open{" "}
            <Link to="/settings" className="text-fg underline-offset-2 hover:underline">
              Setup → Your house
            </Link>{" "}
            and run the collector on a computer on your Wi-Fi.
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