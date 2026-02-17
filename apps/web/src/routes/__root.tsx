import { HotkeysProvider } from "@tanstack/react-hotkeys";
import {
  HeadContent,
  Outlet,
  createRootRouteWithContext,
} from "@tanstack/react-router";

import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
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
  return (
    <>
      <HeadContent />
      <ThemeProvider
        attribute="class"
        defaultTheme="dark"
        disableTransitionOnChange
        storageKey="vite-ui-theme"
      >
        <HotkeysProvider>
          <TooltipProvider>
            <Outlet />
            <Toaster richColors />
          </TooltipProvider>
        </HotkeysProvider>
      </ThemeProvider>
    </>
  );
}
