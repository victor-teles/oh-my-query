import { HeadContent, Outlet, createRootRoute } from "@tanstack/react-router";

import { AppProviders } from "@/components/app-providers";
import "@/index.css";

export const Route = createRootRoute({
  component: RootComponent,
  head: () => ({
    meta: [{ title: "oh-my-query" }],
  }),
});

function RootComponent() {
  return (
    <>
      <HeadContent />
      <AppProviders>
        <Outlet />
      </AppProviders>
    </>
  );
}
