import { Outlet, createFileRoute } from "@tanstack/react-router";

const DefaultLayout = () => (
  <div className="flex h-svh flex-col bg-background">
    <Outlet />
  </div>
);

export const Route = createFileRoute("/_default")({
  component: DefaultLayout,
});
