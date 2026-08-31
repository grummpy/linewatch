/**
 * Linewatch — household outbound watch
 * Copyright (c) 2026 Chris Decker
 */
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatTime } from "@/lib/linewatch/format";
import { deviceById } from "@/lib/linewatch/selectors";
import { useLinewatch } from "@/lib/linewatch/store";

export function AlertBanner() {
  const devices = useLinewatch((s) => s.devices);
  const acknowledge = useLinewatch((s) => s.acknowledge);
  const acknowledgeAll = useLinewatch((s) => s.acknowledgeAll);
  const selectEvent = useLinewatch((s) => s.selectEvent);
  const toggleBlockDevice = useLinewatch((s) => s.toggleBlockDevice);
  const current = useLinewatch((s) => s.alerts.find((a) => !a.acknowledged));
  const extra = useLinewatch((s) => Math.max(0, s.alerts.filter((a) => !a.acknowledged).length - 1));

  if (!current) return null;
  const device = deviceById(devices, current.deviceId);
  const adult = current.severity === "high" || current.category === "adult";

  return (
    <section
      className={
        adult
          ? "rounded-lg bg-danger/12 p-4 shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--color-danger)_35%,transparent)]"
          : "rounded-lg bg-warn/10 p-4 shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--color-warn)_30%,transparent)]"
      }
    >
      <div className="flex items-start gap-3">
        <ShieldAlert className={adult ? "mt-0.5 size-5 text-danger" : "mt-0.5 size-5 text-warn"} />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium tracking-[0.14em] uppercase text-muted">
            {adult ? "Adult content" : "After-hours social"}
            {extra > 0 ? ` · +${extra} more` : ""}
          </p>
          <p className="mt-1 text-base font-medium tracking-tight">
            {device?.name ?? current.sourceIp} opened {current.label}
          </p>
          <p className="mt-1 font-mono text-xs text-muted">
            {formatTime(current.ts)} · {current.sourceIp} → {current.destIp} · {current.host}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" variant={adult ? "danger" : "default"} onClick={() => acknowledge(current.id)}>
              Acknowledge
            </Button>
            <Button size="sm" variant="outline" onClick={() => selectEvent(current.eventId)}>
              Open event
            </Button>
            {device && !device.blocked ? (
              <Button size="sm" variant="ghost" onClick={() => toggleBlockDevice(device.id)}>
                Block device
              </Button>
            ) : null}
            {extra > 0 ? (
              <Button size="sm" variant="ghost" onClick={acknowledgeAll}>
                Clear all
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
