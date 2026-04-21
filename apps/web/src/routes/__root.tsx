import {
  HeadContent,
  Outlet,
  createRootRouteWithContext,
} from "@tanstack/react-router";

import { AppProviders } from "@/components/app-providers";
import { GlobalCommandActions } from "@/components/command-palette/actions/global-actions";
import { CommandPalette } from "@/components/command-palette/command-palette";
import { AppIsland } from "@/components/titlebar/dynamic-island/dynamic-island";
import { Toaster } from "@/components/ui/sonner";
import { useMenuNavigation } from "@/hooks/use-menu-navigation";
import "@/index.css";

export interface RouterAppContext {
  noop?: () => void;
}

export const Route = createRootRouteWithContext<RouterAppContext>()({
  component: RootComponent,
  head: () => ({
    links: [
      {
        href: "/favicon.ico",
        rel: "icon",
      },
    ],
    meta: [
      {
        title: "oh-my-query",
      },
      {
        content: "oh-my-query is a web application",
        name: "description",
      },
    ],
  }),
});

function RootComponent() {
  useMenuNavigation();

  return (
    <>
      <HeadContent />
      <AppProviders>
        <GlobalCommandActions />
        <Outlet />
        <AppIsland />
        <CommandPalette />
        <Toaster richColors />
      </AppProviders>
    </>
  );
}
