/**
 * Linewatch — household outbound watch
 * Copyright (c) 2026 Chris Decker
 */
import { buildInsights } from "@/lib/linewatch/policy";
import { useLinewatch } from "@/lib/linewatch/store";

export function InsightsCard() {
  const events = useLinewatch((s) => s.events);
  const now = useLinewatch((s) => s.now);
  const remote = useLinewatch((s) => s.insights);
  const report = remote ?? buildInsights(events, now || Date.now());

  return (
    <section className="rounded-lg bg-surface p-4 shadow-[var(--shadow-border)] md:p-5">
      <h2 className="text-sm font-medium">Today, in plain language</h2>
      <ul className="mt-3 space-y-2">
        {report.sentences.map((s) => (
          <li key={s} className="text-sm leading-relaxed">
            {s}
          </li>
        ))}
      </ul>
      {report.repeatOffenders.length > 0 ? (
        <div className="mt-4">
          <p className="text-[11px] tracking-wide text-subtle uppercase">Repeated blocks</p>
          <ul className="mt-2 space-y-2">
            {report.repeatOffenders.map((r) => (
              <li key={`${r.owner}-${r.host}`} className="text-sm text-danger">
                {r.sentence}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <p className="mt-4 font-mono text-[11px] text-muted">
        {report.queries} lookups · {report.blocked} blocked · {report.adultAttempts} adult · {report.vpnAttempts} VPN
      </p>
    </section>
  );
}
