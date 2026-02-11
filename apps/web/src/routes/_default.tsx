import { Outlet, createFileRoute } from "@tanstack/react-router";

import Header from "@/components/header";

const DefaultLayout = () => (
  <div className="grid grid-rows-[auto_1fr] h-svh">
    <Header />
    <Outlet />
  </div>
);

export const Route = createFileRoute("/_default")({
  component: DefaultLayout,
});
