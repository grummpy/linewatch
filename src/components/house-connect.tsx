import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useLinewatch } from "@/lib/linewatch/store";

export function HouseConnect() {
  const houseSource = useLinewatch((s) => s.houseSource);
  const collectorUrl = useLinewatch((s) => s.collectorUrl);
  const collectorStatus = useLinewatch((s) => s.collectorStatus);
  const lanProbe = useLinewatch((s) => s.lanProbe);
  const probeLan = useLinewatch((s) => s.probeLan);
  const setCollectorUrl = useLinewatch((s) => s.setCollectorUrl);
  const connectCollector = useLinewatch((s) => s.connectCollector);
  const disconnectCollector = useLinewatch((s) => s.disconnectCollector);
  const useDemoHouse = useLinewatch((s) => s.useDemoHouse);
  const ingestNote = useLinewatch((s) => s.ingestNote);
  const [busy, setBusy] = useState(false);
  const [url, setUrl] = useState(collectorUrl);

  useEffect(() => {
    void probeLan();
  }, [probeLan]);

  useEffect(() => {
    setUrl(collectorUrl);
  }, [collectorUrl]);

  const live = houseSource === "house" && collectorStatus?.ok;

  return (
    <section className="rounded-lg bg-surface p-4 shadow-[var(--shadow-border)] md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium">Your house</h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
            A phone cannot tap the router by itself. Run the Linewatch collector on a computer that
            stays on this Wi-Fi. It finds the gateway and takes DNS/syslog the router sends it.
          </p>
        </div>
        <span className="font-mono text-[11px] tracking-wide text-subtle uppercase">
          {live ? "House line" : houseSource === "house" ? "House · collector down" : "Demo household"}
        </span>
      </div>

      <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
        <div className="rounded-md bg-elevated px-3 py-3">
          <dt className="text-[11px] tracking-wide text-subtle uppercase">This device</dt>
          <dd className="mt-1 font-mono text-xs">
            {lanProbe?.ips[0] ?? "Probing LAN…"}
            {lanProbe?.subnet ? <span className="text-muted"> · {lanProbe.subnet}</span> : null}
          </dd>
        </div>
        <div className="rounded-md bg-elevated px-3 py-3">
          <dt className="text-[11px] tracking-wide text-subtle uppercase">Likely router</dt>
          <dd className="mt-1 font-mono text-xs">
            {collectorStatus?.gateway || lanProbe?.likelyGateway || "—"}
            {collectorStatus?.router?.label ? (
              <span className="mt-1 block text-muted">{collectorStatus.router.label}</span>
            ) : (
              <span className="mt-1 block text-muted">Usually .1 on your subnet. Confirm in a browser.</span>
            )}
          </dd>
        </div>
      </dl>

      <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-muted">
        <li>
          On a Mac, PC, or Pi on this Wi-Fi:{" "}
          <span className="font-mono text-xs text-fg">node collector/linewatch-collector.mjs</span>
        </li>
        <li>It prints this computer’s LAN IP and a router guess. Point the router’s syslog or DNS log at that IP, UDP 5514.</li>
        <li>Paste the collector URL below and Connect. Live hits then come from your LAN, not the demo family.</li>
      </ol>

      <form
        className="mt-4 flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          setCollectorUrl(url);
          setBusy(true);
          void connectCollector(url).finally(() => setBusy(false));
        }}
      >
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="http://192.168.1.12:8787"
          className="h-11 min-w-0 flex-1 rounded-sm bg-elevated px-3 font-mono text-sm shadow-[var(--shadow-border)]"
        />
        <Button type="submit" className="h-11" disabled={busy}>
          {busy ? "Connecting…" : "Connect"}
        </Button>
      </form>

      {collectorStatus?.ok ? (
        <p className="mt-3 text-sm text-ok">
          Collector live{collectorStatus.lanIp ? ` on ${collectorStatus.lanIp}` : ""}.{" "}
          {collectorStatus.eventCount ?? 0} queries buffered. Syslog UDP {collectorStatus.syslogPort ?? 5514}.
        </p>
      ) : collectorStatus?.error ? (
        <p className="mt-3 text-sm text-danger">{collectorStatus.error}</p>
      ) : null}
      {ingestNote ? <p className="mt-2 text-xs text-muted">{ingestNote}</p> : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => void probeLan()}>
          Probe this LAN
        </Button>
        {houseSource === "house" ? (
          <>
            <Button size="sm" variant="ghost" onClick={disconnectCollector}>
              Disconnect collector
            </Button>
            <Button size="sm" variant="ghost" onClick={useDemoHouse}>
              Back to demo household
            </Button>
          </>
        ) : null}
      </div>

      <details className="mt-4 text-sm">
        <summary className="cursor-pointer text-muted">Router recipes</summary>
        <ul className="mt-3 space-y-2 text-muted">
          <li>
            <span className="text-fg">Pi-hole</span> — query log on. Run the collector with{" "}
            <span className="font-mono text-xs">LINEWATCH_DNS_LOG=/var/log/pihole.log</span>
          </li>
          <li>
            <span className="text-fg">UniFi</span> — Settings → System → syslog to the collector IP, port 5514
          </li>
          <li>
            <span className="text-fg">Asus / Merlin</span> — System log → forwarding to the collector IP
          </li>
          <li>
            <span className="text-fg">OpenWrt / pfSense</span> — system log remote server = collector IP
          </li>
          <li>
            <span className="text-fg">eero, Nest, ISP gateway</span> — most cannot syslog. Put Pi-hole or this
            collector machine as DNS for the house, then tail that DNS log.
          </li>
        </ul>
      </details>
    </section>
  );
}
