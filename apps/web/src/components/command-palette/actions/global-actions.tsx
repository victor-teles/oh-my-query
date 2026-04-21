import { useNavigate } from "@tanstack/react-router";
import { HomeIcon, MoonIcon, SettingsIcon, SunIcon } from "lucide-react";
import { useMemo } from "react";

import type { CommandAction } from "@/components/command-palette/types";

import { useRegisterCommandActions } from "@/components/command-palette/use-register-command-actions";
import { useTheme } from "@/components/theme-provider";

export const GlobalCommandActions = () => {
  const navigate = useNavigate();
  const { resolvedTheme, setTheme } = useTheme();

  const isDark = resolvedTheme === "dark";

  const actions = useMemo<CommandAction[]>(
    () => [
      {
        group: "Navigate",
        icon: HomeIcon,
        id: "nav.home",
        keywords: ["connections", "start"],
        label: "Go to Home",
        perform: () => navigate({ to: "/" }),
      },
      {
        group: "Navigate",
        icon: SettingsIcon,
        id: "nav.settings",
        keywords: ["preferences", "config"],
        label: "Open Settings",
        perform: () => navigate({ to: "/settings" }),
        shortcut: ["⌘", ","],
      },
      {
        group: "View",
        icon: isDark ? SunIcon : MoonIcon,
        id: "view.toggle-theme",
        keywords: ["theme", "dark", "light", "appearance"],
        label: isDark ? "Switch to Light Mode" : "Switch to Dark Mode",
        perform: () => setTheme(isDark ? "light" : "dark"),
      },
    ],
    [isDark, navigate, setTheme]
  );

  useRegisterCommandActions(actions, [actions]);

  return null;
};
