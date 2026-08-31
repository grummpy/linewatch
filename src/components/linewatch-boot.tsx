/**
 * Linewatch — household outbound watch
 * Copyright (c) 2026 Chris Decker
 */
import { useLayoutEffect } from "react";
import { useLinewatch } from "@/lib/linewatch/store";

export function LinewatchBoot() {
  const start = useLinewatch((s) => s.start);
  useLayoutEffect(() => {
    start();
  }, [start]);
  return null;
}
