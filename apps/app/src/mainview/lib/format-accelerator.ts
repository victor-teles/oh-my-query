const KEY_SYMBOLS: Record<string, string> = {
  alt: "⌥",
  backspace: "⌫",
  cmd: "⌘",
  cmdorctrl: "⌘",
  command: "⌘",
  commandorcontrol: "⌘",
  control: "⌃",
  ctrl: "⌃",
  down: "↓",
  enter: "↩",
  escape: "esc",
  left: "←",
  meta: "⌘",
  option: "⌥",
  return: "↩",
  right: "→",
  shift: "⇧",
  space: "Space",
  super: "⌘",
  tab: "⇥",
  up: "↑",
};

export const formatAccelerator = (accelerator: string): string[] =>
  accelerator
    .split("+")
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .map((part) => KEY_SYMBOLS[part.toLowerCase()] ?? part.toUpperCase());
