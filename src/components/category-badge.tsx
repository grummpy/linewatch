/**
 * Linewatch — household outbound watch
 * Copyright (c) 2026 Chris Decker
 */
import { Badge } from "@/components/ui/badge";
import { CATEGORY_LABEL, type Category, type Risk } from "@/lib/linewatch/types";

export function CategoryBadge({ category, risk }: { category: Category; risk?: Risk }) {
  const tone =
    category === "adult" || risk === "alert"
      ? "danger"
      : risk === "watch"
        ? "warn"
        : category === "social"
          ? "accent"
          : "muted";
  return <Badge tone={tone}>{CATEGORY_LABEL[category]}</Badge>;
}
