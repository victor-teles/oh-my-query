import { motion, useReducedMotion } from "motion/react";
import { useCallback, useState } from "react";

import { useTheme } from "@/components/theme-provider";
import { cn } from "@/lib/utils";

import { useSettingsFeedback } from "./settings-feedback-context";

type ThemeValue = "light" | "dark" | "system";

const THEME_OPTIONS: { value: ThemeValue; label: string }[] = [
  { label: "Light", value: "light" },
  { label: "Dark", value: "dark" },
  { label: "System", value: "system" },
];

const ChromePreview = ({ mode }: { mode: "light" | "dark" }) => (
  <div className={cn("flex h-full flex-col", mode)}>
    <div className="h-2 shrink-0 border-b border-sidebar-border bg-sidebar" />
    <div className="flex flex-1 bg-background">
      <div className="flex w-1/4 flex-col gap-1 border-r border-sidebar-border bg-sidebar p-1.5">
        <div className="h-0.5 w-3/4 rounded-full bg-foreground/20" />
        <div className="h-0.5 w-1/2 rounded-full bg-foreground/20" />
        <div className="h-0.5 w-2/3 rounded-full bg-foreground/20" />
      </div>
      <div className="relative flex flex-1 flex-col gap-1 p-1.5">
        <div className="h-0.5 w-1/2 rounded-full bg-foreground/20" />
        <div className="h-0.5 w-2/3 rounded-full bg-foreground/20" />
        <div className="h-0.5 w-1/3 rounded-full bg-foreground/20" />
        <div className="absolute right-1.5 bottom-1.5 size-1.5 rounded-full bg-primary" />
      </div>
    </div>
  </div>
);

const SystemPreview = () => (
  <div className="flex h-full flex-col">
    <div className="flex-1 overflow-hidden">
      <ChromePreview mode="light" />
    </div>
    <div className="h-px bg-foreground/25" />
    <div className="flex-1 overflow-hidden">
      <ChromePreview mode="dark" />
    </div>
  </div>
);

interface ThemeTileProps {
  value: ThemeValue;
  label: string;
  isSelected: boolean;
  onSelect: (value: ThemeValue) => void;
}

const ThemeTile = ({ value, label, isSelected, onSelect }: ThemeTileProps) => {
  const [pulseKey, setPulseKey] = useState<number | null>(null);
  const reduced = useReducedMotion();

  const handleClick = useCallback(() => {
    onSelect(value);
    setPulseKey(Date.now());
  }, [onSelect, value]);

  const handlePulseComplete = useCallback(() => {
    setPulseKey(null);
  }, []);

  return (
    <div className="relative">
      <button
        aria-pressed={isSelected}
        className={cn(
          "group block w-full cursor-pointer overflow-hidden rounded-lg text-left ring-2 transition-colors",
          "focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sidebar-ring",
          isSelected
            ? "ring-primary"
            : "ring-foreground/10 hover:ring-foreground/25"
        )}
        onClick={handleClick}
        type="button"
      >
        <div className="pointer-events-none h-[100px] overflow-hidden">
          {value === "system" ? (
            <SystemPreview />
          ) : (
            <ChromePreview mode={value} />
          )}
        </div>
        <div
          className={cn(
            "border-t px-3 py-2 text-sm font-medium transition-colors",
            isSelected
              ? "border-primary/30 text-foreground"
              : "border-foreground/10 text-muted-foreground group-hover:text-foreground"
          )}
        >
          {label}
        </div>
      </button>
      {pulseKey !== null && (
        <motion.div
          animate={reduced ? { opacity: 0 } : { opacity: 0, scale: 1.05 }}
          className="pointer-events-none absolute inset-0 rounded-lg ring-2 ring-primary"
          initial={reduced ? { opacity: 0.6 } : { opacity: 0.9, scale: 1 }}
          key={pulseKey}
          onAnimationComplete={handlePulseComplete}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        />
      )}
    </div>
  );
};

export const GeneralThemeSection = () => {
  const { theme, setTheme } = useTheme();
  const { notifySaved } = useSettingsFeedback();

  const handleSelect = useCallback(
    (value: ThemeValue) => {
      setTheme(value);
      notifySaved();
    },
    [setTheme, notifySaved]
  );

  return (
    <section>
      <h2 className="text-xl font-semibold tracking-tight">Appearance</h2>
      <p className="mt-1.5 mb-6 text-sm text-muted-foreground">
        Light, dark, or match your system. Pick what’s easy on the eyes.
      </p>
      <div className="grid grid-cols-3 gap-3">
        {THEME_OPTIONS.map((option) => (
          <ThemeTile
            isSelected={theme === option.value}
            key={option.value}
            label={option.label}
            onSelect={handleSelect}
            value={option.value}
          />
        ))}
      </div>
    </section>
  );
};
