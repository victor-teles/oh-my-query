import { Outlet, createFileRoute } from "@tanstack/react-router";

import Header from "@/components/header";
import { Titlebar } from "@/components/titlebar/titlebar";

const DefaultLayout = () => (
  <div className="grid grid-rows-[auto_auto_1fr] h-svh">
    <Titlebar />
    <Header />
    <Outlet />
  </div>
);

export const Route = createFileRoute("/_default")({
  component: DefaultLayout,
});
