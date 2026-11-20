import type { ReactNode } from "react";

import { MotionConfig } from "motion/react";

import { ThemeProvider } from "@/components/theme-provider";

export const AppProviders = ({ children }: { children: ReactNode }) => (
  <ThemeProvider
    attribute="class"
    defaultTheme="dark"
    disableTransitionOnChange
    storageKey="vite-ui-theme"
  >
    <MotionConfig reducedMotion="user">{children}</MotionConfig>
  </ThemeProvider>
);
