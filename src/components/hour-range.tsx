/**
 * Linewatch — household outbound watch
 * Copyright (c) 2026 Chris Decker
 */
import { Switch } from "@/components/ui/switch";

function labelHour(h: number) {
  const hr = ((h + 11) % 12) + 1;
  const am = h % 24 < 12;
  return `${hr}:00 ${am ? "AM" : "PM"}`;
}

export function HourRange({
  title,
  description,
  enabled,
  onEnabled,
  start,
  end,
  onStart,
  onEnd,
}: {
  title: string;
  description: string;
  enabled: boolean;
  onEnabled: (v: boolean) => void;
  start: number;
  end: number;
  onStart: (h: number) => void;
  onEnd: (h: number) => void;
}) {
  return (
    <div className="rounded-md bg-elevated px-4 py-4">
      <Switch checked={enabled} onCheckedChange={onEnabled} label={title} description={description} />
      <div className={`mt-4 space-y-4 ${enabled ? "" : "opacity-40"}`}>
        <label className="block text-xs text-muted">
          Starts {labelHour(start)}
          <input
            type="range"
            min={0}
            max={23}
            value={start}
            disabled={!enabled}
            onChange={(e) => onStart(Number(e.target.value))}
            className="mt-2 h-11 w-full accent-accent"
          />
        </label>
        <label className="block text-xs text-muted">
          Ends {labelHour(end)}
          <input
            type="range"
            min={0}
            max={23}
            value={end}
            disabled={!enabled}
            onChange={(e) => onEnd(Number(e.target.value))}
            className="mt-2 h-11 w-full accent-accent"
          />
        </label>
      </div>
    </div>
  );
}
