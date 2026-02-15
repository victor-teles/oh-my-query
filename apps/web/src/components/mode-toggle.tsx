import { Moon, Sun } from "lucide-react";
import { useCallback } from "react";

import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function ModeToggle() {
  const { setTheme } = useTheme();

  const onDarkClick = useCallback(() => {
    setTheme("dark");
  }, [setTheme]);

  const onLightClick = useCallback(() => {
    setTheme("light");
  }, [setTheme]);

  const onSystemClick = useCallback(() => {
    setTheme("system");
  }, [setTheme]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" size="icon" />}>
        <Sun className="h-[1.2rem] w-[1.2rem] scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
        <Moon className="absolute h-[1.2rem] w-[1.2rem] scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
        <span className="sr-only">Toggle theme</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onLightClick}>Light</DropdownMenuItem>
        <DropdownMenuItem onClick={onDarkClick}>Dark</DropdownMenuItem>
        <DropdownMenuItem onClick={onSystemClick}>System</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
