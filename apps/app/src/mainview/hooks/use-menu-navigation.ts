import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { onMenuNavigate } from "@/lib/ipc";

const MENU_ROUTES: Record<string, string> = {
  "/settings": "/settings",
};

export const useMenuNavigation = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const off = onMenuNavigate((route) => {
      const target = MENU_ROUTES[route];
      if (target) {
        navigate({ to: target });
      }
    });
    return off;
  }, [navigate]);
};
