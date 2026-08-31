/**
 * Linewatch — household outbound watch
 * Copyright (c) 2026 Chris Decker
 */
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/linewatch/format";
import { useLinewatch } from "@/lib/linewatch/store";

export function ScanPanel() {
  const scan = useLinewatch((s) => s.scan);
  const runScan = useLinewatch((s) => s.runScan);

  return (
    <section className="rounded-lg bg-surface p-4 shadow-[var(--shadow-border)] md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium">Wi-Fi exposure scan</h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
            On demand only. Checks devices on this network for open admin ports (Telnet, SMB, RDP). Does
            not run in the background.
          </p>
        </div>
        <Button onClick={() => void runScan()} disabled={scan.running}>
          {scan.running ? "Scanning…" : "Scan this Wi-Fi"}
        </Button>
      </div>
      {scan.at ? (
        <p className="mt-3 font-mono text-[11px] text-muted">
          Last run {formatDateTime(scan.at)} · {scan.targets} device{scan.targets === 1 ? "" : "s"}
        </p>
      ) : null}
      {scan.findings.length ? (
        <ul className="mt-4 space-y-3">
          {scan.findings.map((f) => (
            <li key={`${f.ip}-${f.port}`} className="flex gap-3 text-sm">
              <ShieldAlert className={f.severity === "high" ? "mt-0.5 size-4 text-danger" : "mt-0.5 size-4 text-warn"} />
              <span>{f.sentence}</span>
            </li>
          ))}
        </ul>
      ) : scan.at && !scan.running ? (
        <p className="mt-4 text-sm text-muted">Nothing open on the usual danger ports.</p>
      ) : null}
    </section>
  );
}
