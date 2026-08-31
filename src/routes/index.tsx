import { createFileRoute } from "@tanstack/react-router";
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

  return (
    <AppShell>
      <div className="flex flex-col gap-5">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-medium tracking-tight md:text-3xl">Live operations</h1>
            <p className="mt-1 max-w-xl text-sm text-muted">
              Filter a person. Split Amazon Sidewalk from WAN data. Location flags mean a maps or
              weather host — not a GPS pin.
            </p>
          </div>
          <p className="font-mono text-[11px] tracking-wide text-subtle uppercase">
            {running ? `Collector live · firewall ${mode}` : "Collector idle"}
          </p>
        </header>
        <AlertBanner />
        <KpiStrip />
        <LiveFeed />
        <EventDetail />
      </div>
    </AppShell>
  );
}
