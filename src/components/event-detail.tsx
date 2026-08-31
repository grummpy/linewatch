/**
 * Linewatch — household outbound watch
 * Copyright (c) 2026 Chris Decker
 */
import { Ban, Check, ShieldAlert } from "lucide-react";
import { CategoryBadge } from "@/components/category-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { formatBytes, formatDateTime, pathTone } from "@/lib/linewatch/format";
import { deviceById } from "@/lib/linewatch/selectors";
import { useLinewatch } from "@/lib/linewatch/store";
import { CATEGORY_LABEL, PATH_LABEL } from "@/lib/linewatch/types";

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border py-3">
      <span className="text-xs text-muted">{k}</span>
      <span className="text-right font-mono text-xs tabular">{v}</span>
    </div>
  );
}

export function EventDetail() {
  const selectedEventId = useLinewatch((s) => s.selectedEventId);
  const selectEvent = useLinewatch((s) => s.selectEvent);
  const event = useLinewatch((s) => s.events.find((e) => e.id === s.selectedEventId));
  const devices = useLinewatch((s) => s.devices);
  const toggleBlockDevice = useLinewatch((s) => s.toggleBlockDevice);
  const addToBlocklist = useLinewatch((s) => s.addToBlocklist);
  const blockSiteForPerson = useLinewatch((s) => s.blockSiteForPerson);
  const acknowledge = useLinewatch((s) => s.acknowledge);
  const relatedAlert = useLinewatch((s) => s.alerts.find((a) => a.eventId === s.selectedEventId));

  const device = event ? deviceById(devices, event.deviceId) : undefined;

  return (
    <Sheet
      open={Boolean(selectedEventId)}
      onOpenChange={(o) => {
        if (!o) selectEvent(null);
      }}
      title="Event"
    >
      {event ? (
        <div>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <CategoryBadge category={event.category} risk={event.risk} />
            <Badge tone={pathTone(event.path)}>{PATH_LABEL[event.path]}</Badge>
            {event.blocked ? <Badge tone="warn">Blocked</Badge> : null}
            {event.locationHint ? <Badge tone="accent">Location</Badge> : null}
            {event.risk === "alert" ? (
              <span className="inline-flex items-center gap-1 text-xs text-danger">
                <ShieldAlert className="size-3.5" /> Alert
              </span>
            ) : null}
          </div>
          <p className="text-lg font-medium tracking-tight">{event.destLabel}</p>
          <p className="mt-1 font-mono text-xs text-muted">{event.destHost}</p>

          <div className="mt-5">
            <Row k="Time" v={formatDateTime(event.ts)} />
            <Row k="Person" v={event.owner} />
            <Row k="Device" v={device?.name ?? "Unknown"} />
            <Row k="Role" v={device?.role ?? "—"} />
            <Row k="Source IP" v={event.sourceIp} />
            <Row k="MAC" v={device?.mac ?? "—"} />
            <Row k="Destination IP" v={event.destIp} />
            <Row k="Server region" v={event.destRegion} />
            <Row k="Path" v={PATH_LABEL[event.path]} />
            <Row k="Genre" v={CATEGORY_LABEL[event.category]} />
            <Row k="Protocol" v={`${event.protocol.toUpperCase()} :${event.destPort}`} />
            <Row k="Bytes" v={formatBytes(event.bytes)} />
            <Row
              k="User location"
              v={
                event.locationHint
                  ? event.locationHint
                  : "None in this log — no GPS coordinate on the wire"
              }
            />
          </div>
          <p className="mt-3 text-xs leading-relaxed text-muted">
            Server region is where the site answered from, not where {event.owner} is. Sidewalk is
            tagged from Amazon / Ring / Tile endpoints — not the 900 MHz radio itself.
          </p>

          <div className="mt-6 flex flex-col gap-2">
            {relatedAlert && !relatedAlert.acknowledged ? (
              <Button variant="outline" onClick={() => acknowledge(relatedAlert.id)}>
                <Check /> Acknowledge alert
              </Button>
            ) : null}
            {device ? (
              <Button variant={device.blocked ? "ghost" : "danger"} onClick={() => toggleBlockDevice(device.id)}>
                <Ban />
                {device.blocked ? "Unblock device" : "Block this device"}
              </Button>
            ) : null}
            <Button variant="outline" onClick={() => addToBlocklist(event.destHost)}>
              Block {event.destHost} for the house
            </Button>
            <Button variant="outline" onClick={() => blockSiteForPerson(event.owner, event.destHost)}>
              Block for {event.owner} only
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted">Event no longer in the buffer.</p>
      )}
    </Sheet>
  );
}
