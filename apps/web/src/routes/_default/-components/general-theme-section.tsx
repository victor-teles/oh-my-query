import { Monitor, Moon, Sun } from "lucide-react";
import { useCallback } from "react";

import { useTheme } from "@/components/theme-provider";
import { cn } from "@/lib/utils";

const THEME_OPTIONS = [
  { icon: Sun, label: "Light", value: "light" },
  { icon: Moon, label: "Dark", value: "dark" },
  { icon: Monitor, label: "System", value: "system" },
] as const;

const ThemeOptionCard = ({
  icon: Icon,
  label,
  value,
  isSelected,
  onSelect,
}: {
  icon: typeof Sun;
  label: string;
  value: string;
  isSelected: boolean;
  onSelect: (value: string) => void;
}) => {
  const handleClick = useCallback(() => {
    onSelect(value);
  }, [onSelect, value]);

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        "flex cursor-pointer flex-col items-center gap-2 rounded-lg px-6 py-4 ring-1 transition-all",
        isSelected
          ? "ring-2 ring-primary text-foreground"
          : "ring-foreground/10 text-muted-foreground hover:ring-foreground/25 hover:text-foreground"
      )}
    >
      <Icon className="size-5" />
      <span className="text-xs font-medium">{label}</span>
    </button>
  );
};

export const GeneralThemeSection = () => {
  const { theme, setTheme } = useTheme();

  return (
    <section>
      <h2 className="mb-1 text-sm font-medium">Appearance</h2>
      <p className="mb-4 text-xs text-muted-foreground">
        Choose the overall look for the application.
      </p>
      <div className="flex gap-3">
        {THEME_OPTIONS.map((option) => (
          <ThemeOptionCard
            key={option.value}
            icon={option.icon}
            label={option.label}
            value={option.value}
            isSelected={theme === option.value}
            onSelect={setTheme}
          />
        ))}
      </div>
    </section>
  );
};
