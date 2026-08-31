/**
 * Linewatch — household outbound watch
 * Copyright (c) 2026 Chris Decker
 */
import * as SwitchPrimitive from "@radix-ui/react-switch";
import { cn } from "@/lib/utils";

export function Switch({
  checked,
  onCheckedChange,
  label,
  description,
}: {
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <label className="flex min-h-11 cursor-pointer items-start justify-between gap-4 py-2">
      <span>
        <span className="block text-sm font-medium">{label}</span>
        {description ? <span className="mt-0.5 block text-xs text-muted">{description}</span> : null}
      </span>
      <SwitchPrimitive.Root
        checked={checked}
        onCheckedChange={onCheckedChange}
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full bg-elevated shadow-[var(--shadow-border)]",
          "data-[state=checked]:bg-accent",
        )}
      >
        <SwitchPrimitive.Thumb
          className={cn(
            "block size-5 translate-x-0.5 rounded-full bg-fg transition-transform duration-150",
            "data-[state=checked]:translate-x-[22px] data-[state=checked]:bg-accent-fg",
          )}
        />
      </SwitchPrimitive.Root>
    </label>
  );
}
