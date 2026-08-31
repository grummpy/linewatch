/**
 * Linewatch — household outbound watch
 * Copyright (c) 2026 Chris Decker
 *
 * One-screen house setup: autocomplete the router, find the collector
 * on this Wi-Fi, keep watching after the phone is closed (7-day logs).
 */
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useLinewatch } from "@/lib/linewatch/store";

const COLLECTOR_CMD = "npm run collector";

export function HouseConnect() {
  const houseSource = useLinewatch((s) => s.houseSource);
  const collectorUrl = useLinewatch((s) => s.collectorUrl);
  const collectorStatus = useLinewatch((s) => s.collectorStatus);
  const lanProbe = useLinewatch((s) => s.lanProbe);
  const discovering = useLinewatch((s) => s.discovering);
  const suggestedUrls = useLinewatch((s) => s.suggestedUrls);
  const autoJoinHouse = useLinewatch((s) => s.autoJoinHouse);
  const setCollectorUrl = useLinewatch((s) => s.setCollectorUrl);
  const connectCollector = useLinewatch((s) => s.connectCollector);
  const useDemoHouse = useLinewatch((s) => s.useDemoHouse);
  const [busy, setBusy] = useState(false);
  const [url, setUrl] = useState(collectorUrl);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setUrl(collectorUrl);
  }, [collectorUrl]);

  const live = houseSource === "house" && collectorStatus?.ok;
  const routerIp = collectorStatus?.gateway || lanProbe?.likelyGateway || "";
  const prefix = routerIp ? routerIp.split(".").slice(0, 3).join(".") : "";

  return (
    <section className="rounded-lg bg-surface p-4 shadow-[var(--shadow-border)] md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium">Your house</h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
            Opens onto your router. This computer is house DNS — every device asks it for names.
            The phone only watches. Logs overwrite after 7 days.
          </p>
        </div>
        <span className="font-mono text-[11px] tracking-wide text-subtle uppercase">
          {discovering ? "Finding router…" : live ? "Watching" : houseSource === "house" ? "Collector off" : "Not connected"}
        </span>
      </div>

      <div className="mt-4 rounded-md bg-elevated px-4 py-4">
        <p className="text-[11px] tracking-wide text-subtle uppercase">Router</p>
        <p className="mt-1 font-mono text-xl tabular">{routerIp || (discovering ? "…" : "Not on Wi-Fi yet")}</p>
        {collectorStatus?.router?.label ? (
          <p className="mt-1 text-xs text-muted">{collectorStatus.router.label}</p>
        ) : lanProbe?.subnet ? (
          <p className="mt-1 text-xs text-muted">{lanProbe.subnet} · usually .1</p>
        ) : null}
      </div>

      {live ? (
        <p className="mt-4 text-sm text-ok">
          Collector on {collectorStatus.lanIp || collectorUrl}. {collectorStatus.eventCount ?? 0}{" "}
          queries this week. Close the phone — this computer still watches. Older than 7 days is
          overwritten.
        </p>
      ) : (
        <div className="mt-4 space-y-3 text-sm text-muted">
          <p>
            On a Pi, Mac, or PC that stays on:{" "}
            <button
              type="button"
              className="font-mono text-xs text-fg"
              onClick={() => {
                void navigator.clipboard?.writeText(COLLECTOR_CMD);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
            >
              {COLLECTOR_CMD}
            </button>
            {copied ? <span className="ml-2 text-ok">copied</span> : null}
          </p>
          <p>Point the router’s DNS at that computer. Open this app — it fills the address in. The phone only watches.</p>
        </div>
      )}

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
          list="linewatch-collectors"
          placeholder={prefix ? `http://${prefix}.10:8787` : "Collector address on this Wi-Fi"}
          autoComplete="on"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          className="h-11 min-w-0 flex-1 rounded-sm bg-elevated px-3 font-mono text-sm shadow-[var(--shadow-border)]"
        />
        <datalist id="linewatch-collectors">
          {suggestedUrls.map((u) => (
            <option key={u} value={u} />
          ))}
        </datalist>
        <Button type="submit" className="h-11" disabled={busy || discovering}>
          {busy || discovering ? "Finding…" : live ? "Reconnect" : "Connect"}
        </Button>
      </form>

      {collectorStatus?.error && !live ? <p className="mt-3 text-sm text-danger">{collectorStatus.error}</p> : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => void autoJoinHouse()} disabled={discovering}>
          Find my router
        </Button>
        {houseSource === "house" ? (
          <Button size="sm" variant="ghost" onClick={useDemoHouse}>
            Demo household
          </Button>
        ) : null}
      </div>
    </section>
  );
}
