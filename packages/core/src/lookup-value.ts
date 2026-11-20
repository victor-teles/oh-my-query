export const LOOKUP_KINDS = ["uuid", "email", "integer"] as const;

export type LookupKind = (typeof LOOKUP_KINDS)[number];

export type LookupValue =
  | { kind: "uuid"; value: string }
  | { kind: "email"; value: string }
  | { kind: "integer"; value: string };

export const MAX_LOOKUP_INPUT = 320;
const MAX_EMAIL = 254;
const MAX_EMAIL_LOCAL = 64;
const INT64_MAX = 9_223_372_036_854_775_807n;

const LINE_BREAK = /[\r\n]/;
const WHITESPACE = /\s/;
const DASHED_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BARE_UUID = /^[0-9a-f]{32}$/i;
const EMAIL_DOMAIN = /^[^\s@.]+(?:\.[^\s@.]+)*\.[a-z]{2,}$/i;
const INTEGER = /^[1-9][0-9]{0,18}$/;
const MAILTO = /^mailto:/i;

const WRAPPERS: readonly (readonly [string, string])[] = [
  ['"', '"'],
  ["'", "'"],
  ["`", "`"],
  ["<", ">"],
  ["{", "}"],
];

const unwrap = (text: string): string => {
  const pair = WRAPPERS.find(
    ([open, close]) =>
      text.length >= 2 && text.startsWith(open) && text.endsWith(close)
  );
  return pair ? text.slice(1, -1).trim() : text;
};

const canonicalUuid = (text: string): string | null => {
  if (DASHED_UUID.test(text)) {
    return text.toLowerCase();
  }
  if (!BARE_UUID.test(text)) {
    return null;
  }
  const hex = text.toLowerCase();
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join("-");
};

const isEmail = (text: string): boolean => {
  if (text.length > MAX_EMAIL || WHITESPACE.test(text)) {
    return false;
  }
  const parts = text.split("@");
  if (parts.length !== 2) {
    return false;
  }
  const [local = "", domain = ""] = parts;
  return (
    local.length > 0 &&
    local.length <= MAX_EMAIL_LOCAL &&
    EMAIL_DOMAIN.test(domain)
  );
};

const isInteger = (text: string): boolean =>
  INTEGER.test(text) && BigInt(text) <= INT64_MAX;

export const classifyLookupValue = (raw: string): LookupValue | null => {
  if (raw.length > MAX_LOOKUP_INPUT || LINE_BREAK.test(raw)) {
    return null;
  }
  const text = unwrap(raw.trim()).replace(MAILTO, "");
  if (!text) {
    return null;
  }
  const uuid = canonicalUuid(text);
  if (uuid) {
    return { kind: "uuid", value: uuid };
  }
  if (isEmail(text)) {
    return { kind: "email", value: text };
  }
  return isInteger(text) ? { kind: "integer", value: text } : null;
};
