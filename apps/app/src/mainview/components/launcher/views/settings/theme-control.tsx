import type { SegmentOption } from "@/components/ui/segmented-control";

import { useTheme } from "@/components/theme-provider";
import { SegmentedControl } from "@/components/ui/segmented-control";

type ThemeValue = "system" | "dark" | "light";

const THEMES: readonly SegmentOption<ThemeValue>[] = [
  { label: "System", value: "system" },
  { label: "Dark", value: "dark" },
  { label: "Light", value: "light" },
];

const isThemeValue = (value: string | undefined): value is ThemeValue =>
  THEMES.some((theme) => theme.value === value);

export function ThemeControl() {
  const { theme, setTheme } = useTheme();
  return (
    <SegmentedControl
      label="Theme"
      onChange={setTheme}
      options={THEMES}
      value={isThemeValue(theme) ? theme : "dark"}
    />
  );
}
