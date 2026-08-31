import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";

export const Route = createFileRoute("/people")({ component: PeopleLayout });

function PeopleLayout() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
