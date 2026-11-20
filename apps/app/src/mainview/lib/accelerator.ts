type Modifier = "altKey" | "ctrlKey" | "metaKey" | "shiftKey";

const MODIFIERS: Record<string, Modifier> = {
  alt: "altKey",
  cmd: "metaKey",
  cmdorctrl: "metaKey",
  command: "metaKey",
  commandorcontrol: "metaKey",
  control: "ctrlKey",
  ctrl: "ctrlKey",
  meta: "metaKey",
  option: "altKey",
  shift: "shiftKey",
  super: "metaKey",
};

const NAMED_CODES: Record<string, string> = {
  down: "ArrowDown",
  enter: "Enter",
  escape: "Escape",
  left: "ArrowLeft",
  return: "Enter",
  right: "ArrowRight",
  space: "Space",
  tab: "Tab",
  up: "ArrowUp",
};

const LETTER = /^[a-z]$/;
const DIGIT = /^\d$/;

const codeFor = (key: string): string => {
  const lower = key.toLowerCase();
  if (LETTER.test(lower)) {
    return `Key${lower.toUpperCase()}`;
  }
  if (DIGIT.test(lower)) {
    return `Digit${lower}`;
  }
  return NAMED_CODES[lower] ?? key;
};

export type KeyChord = Pick<
  KeyboardEvent,
  "altKey" | "code" | "ctrlKey" | "metaKey" | "shiftKey"
>;

// Matches on `code`, not `key`: Option changes the produced character
// (⌥⇧Space types a non-breaking space).
export const matchesAccelerator = (
  event: KeyChord,
  accelerator: string
): boolean => {
  const parts = accelerator
    .split("+")
    .map((part) => part.trim())
    .filter(Boolean);
  const key = parts.at(-1);
  if (!key) {
    return false;
  }
  const required = new Set(
    parts.slice(0, -1).map((part) => MODIFIERS[part.toLowerCase()])
  );
  const modifiers: Modifier[] = ["altKey", "ctrlKey", "metaKey", "shiftKey"];
  return (
    event.code === codeFor(key) &&
    modifiers.every((modifier) => event[modifier] === required.has(modifier))
  );
};
