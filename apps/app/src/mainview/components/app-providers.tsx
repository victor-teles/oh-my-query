import type { ReactNode } from "react";

import { HotkeysProvider } from "@tanstack/react-hotkeys";

import { CommandPaletteProvider } from "@/components/command-palette/command-palette-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { IslandProvider } from "@/contexts/island-context";

export const AppProviders = ({ children }: { children: ReactNode }) => (
  <ThemeProvider
    attribute="class"
    defaultTheme="dark"
    disableTransitionOnChange
    storageKey="vite-ui-theme"
  >
    <HotkeysProvider>
      <CommandPaletteProvider>
        <TooltipProvider>
          <IslandProvider>{children}</IslandProvider>
        </TooltipProvider>
      </CommandPaletteProvider>
    </HotkeysProvider>
  </ThemeProvider>
);
