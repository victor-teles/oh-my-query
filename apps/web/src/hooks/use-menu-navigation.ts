import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { isTauri } from "@/lib/tauri";

const MENU_ROUTES: Record<string, string> = {
  "/settings": "/settings",
};

export const useMenuNavigation = () => {
  const navigate = useNavigate();

  useEffect(() => {
    if (!isTauri()) {
      return;
    }

    let unlisten: (() => void) | undefined;

    const setup = async () => {
      const { listen } = await import("@tauri-apps/api/event");
      unlisten = await listen<string>("menu-navigate", (event) => {
        const route = MENU_ROUTES[event.payload];
        if (route) {
          navigate({ to: route });
        }
      });
    };

    setup();

    return () => {
      unlisten?.();
    };
  }, [navigate]);
};
