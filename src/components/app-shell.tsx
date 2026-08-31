/**
 * Linewatch — household outbound watch
 * Copyright (c) 2026 Chris Decker
 */
import { Link, useRouterState } from "@tanstack/react-router";
import { Archive, Home, Radio, Settings2, Users } from "lucide-react";
import type { ReactNode } from "react";
import { Toaster } from "sonner";
import { useLinewatch } from "@/lib/linewatch/store";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Live", icon: Radio },
  { to: "/people", label: "People", icon: Users },
  { to: "/house", label: "House", icon: Home },
  { to: "/logs", label: "Logs", icon: Archive },
  { to: "/settings", label: "Setup", icon: Settings2 },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const running = useLinewatch((s) => s.running);
  const unacked = useLinewatch((s) => s.alerts.filter((a) => !a.acknowledged).length);

  return (
    <div className="flex min-h-dvh flex-col bg-bg text-fg md:flex-row">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-bg/95 px-4 py-3 backdrop-blur-sm md:hidden">
        <Brand running={running} />
        {unacked > 0 ? (
          <span className="rounded-full bg-danger px-2 py-0.5 text-[11px] font-medium text-danger-fg tabular">
            {unacked}
          </span>
        ) : null}
      </header>

      <aside className="hidden w-56 shrink-0 flex-col border-r border-border bg-bg md:flex">
        <div className="px-5 pt-6 pb-8">
          <Brand running={running} />
          <p className="mt-2 text-xs leading-snug text-muted">The line out of the house.</p>
        </div>
        <nav className="flex flex-1 flex-col gap-0.5 px-3">
          {NAV.map((item) => {
            const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex h-11 items-center gap-3 rounded-sm px-3 text-sm transition-colors duration-150",
                  active ? "bg-elevated text-fg" : "text-muted hover:bg-surface hover:text-fg",
                )}
              >
                <Icon className="size-4" strokeWidth={1.75} />
                <span>{item.label}</span>
                {item.to === "/logs" && unacked > 0 ? (
                  <span className="ml-auto rounded-full bg-danger px-1.5 py-0.5 text-[10px] text-danger-fg tabular">
                    {unacked}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>
        <p className="px-5 py-5 text-[11px] text-subtle">LAN 192.168.1.0/24</p>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col pb-20 md:pb-0">
        <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-5 md:px-8 md:py-8">{children}</div>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-bg/95 backdrop-blur-sm md:hidden">
        <ul className="grid grid-cols-5">
          {NAV.map((item) => {
            const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <li key={item.to}>
                <Link
                  to={item.to}
                  className={cn(
                    "relative flex h-16 flex-col items-center justify-center gap-1 text-[11px]",
                    active ? "text-fg" : "text-muted",
                  )}
                >
                  <Icon className="size-4" strokeWidth={1.75} />
                  {item.label}
                  {item.to === "/logs" && unacked > 0 ? (
                    <span className="absolute top-2 right-4 size-1.5 rounded-full bg-danger" />
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <Toaster
        theme="dark"
        position="top-center"
        toastOptions={{
          style: {
            background: "#1b1d1f",
            border: "1px solid color-mix(in oklab, #e8e6e3 14%, transparent)",
            color: "#e8e6e3",
            fontFamily: "IBM Plex Sans, sans-serif",
          },
        }}
      />
    </div>
  );
}

function Brand({ running }: { running: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="relative flex size-2">
        <span className={cn("absolute inset-0 rounded-full", running ? "bg-ok live-dot" : "bg-muted")} />
      </span>
      <span className="text-[13px] font-medium tracking-[0.18em] uppercase">Linewatch</span>
    </div>
  );
}
