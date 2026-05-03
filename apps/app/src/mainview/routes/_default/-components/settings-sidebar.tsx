import { Download, Paintbrush, Palette, RefreshCw, Type } from "lucide-react";
import { useCallback } from "react";

import { isTauri } from "@/lib/tauri";
import { cn } from "@/lib/utils";

export type SettingsSectionId =
  | "appearance"
  | "syntax-theme"
  | "code-font"
  | "export"
  | "updates";

export const SETTINGS_SECTIONS = [
  { icon: Palette, id: "appearance", label: "Appearance" },
  { icon: Paintbrush, id: "syntax-theme", label: "Syntax Theme" },
  { icon: Type, id: "code-font", label: "Code Font" },
  { icon: Download, id: "export", label: "Export" },
  { icon: RefreshCw, id: "updates", label: "Updates" },
] as const satisfies readonly {
  id: SettingsSectionId;
  label: string;
  icon: typeof Palette;
}[];

interface NavItemProps {
  id: SettingsSectionId;
  label: string;
  icon: typeof Palette;
  shortcut: string;
  isActive: boolean;
  onSelect: (id: SettingsSectionId) => void;
}

const NavItem = ({
  id,
  label,
  icon: Icon,
  shortcut,
  isActive,
  onSelect,
}: NavItemProps) => {
  const handleClick = useCallback(() => {
    onSelect(id);
  }, [id, onSelect]);

  return (
    <button aria-current={isActive ? "page" : undefined} className={cn(`
          group flex w-full cursor-pointer items-center gap-2.5 rounded-md
          px-2.5 py-1.5 text-sm transition-colors
        `, `
          focus-visible:ring-2 focus-visible:ring-sidebar-ring
          focus-visible:outline-none
        `, isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : `
            text-sidebar-foreground/75
            hover:bg-sidebar-accent/50 hover:text-sidebar-foreground
          `)} onClick={handleClick} type="button">
      <Icon className="size-4 shrink-0" />
      <span>{label}</span>
      <span
        aria-hidden="true"
        className={cn(
          "ml-auto text-[11px] tabular-nums transition-colors",
          isActive ? "text-sidebar-accent-foreground/60" : `
              text-sidebar-foreground/35
              group-hover:text-sidebar-foreground/60
            `
        )}
      >
        {shortcut}
      </span>
    </button>
  );
};

interface SettingsSidebarProps {
  active: SettingsSectionId;
  onSelect: (id: SettingsSectionId) => void;
}

export const SettingsSidebar = ({ active, onSelect }: SettingsSidebarProps) => (
  <nav aria-label="Settings sections" className={cn(`
        flex h-full w-52 shrink-0 flex-col gap-0.5 border-r
        border-sidebar-border px-2 py-3 text-sidebar-foreground
      `, isTauri() ? "bg-sidebar/80" : "bg-sidebar")}>
    {SETTINGS_SECTIONS.map((section, index) => (
      <NavItem
        icon={section.icon}
        id={section.id}
        isActive={active === section.id}
        key={section.id}
        label={section.label}
        onSelect={onSelect}
        shortcut={`⌘${index + 1}`}
      />
    ))}
  </nav>
);
