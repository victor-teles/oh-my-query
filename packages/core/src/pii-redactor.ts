export interface RedactOptions {
  customPatterns?: readonly string[];
}

export interface RedactResult {
  text: string;
  count: number;
}

const REDACTION_TOKEN = "[REDACTED]";
const api_key =
  /(?:api[_-]?key|apikey|access[_-]?token|auth[_-]?token|secret[_-]?key|bearer)\s*[:=]\s*[\w\-.]{20,}/gi;
const credit_card = new RegExp(
  String.raw`\b(?:${[
    String.raw`4\d{3}(?:[ -]?\d{4}){3}`,
    String.raw`4\d{12}`,
    String.raw`(?:5[1-5]|2[2-7])\d{2}(?:[ -]?\d{4}){3}`,
    String.raw`3[47]\d{2}[ -]?\d{6}[ -]?\d{5}`,
    String.raw`6(?:011|5\d{2})(?:[ -]?\d{4}){3}`,
    String.raw`3(?:0[0-5]|[68]\d)\d(?:\d{10}|[ -]?\d{6}[ -]?\d{4})`,
    String.raw`(?:2131|1800)\d{11}`,
    String.raw`35\d{2}(?:[ -]?\d{4}){3}`,
  ].join("|")})\b`,
  "g"
);
const email = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const ipv4 =
  /\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b/g;
const jwt = /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g;
const phone = /(?:\+\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}\b/g;
const ssn = /\b(?!000|666|9\d{2})\d{3}-(?!00)\d{2}-(?!0000)\d{4}\b/g;

export const PII_PATTERNS: Readonly<Record<string, RegExp>> = Object.freeze({
  api_key,
  credit_card,
  email,
  ipv4,
  jwt,
  phone,
  ssn,
});

const BUILTIN_PATTERNS: readonly RegExp[] = Object.values(PII_PATTERNS);

const compileCustomPattern = (raw: string): RegExp | null => {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.startsWith("#")) {
    return null;
  }
  try {
    return new RegExp(trimmed, "g");
  } catch {
    return null;
  }
};

const compileCustomPatterns = (raw: readonly string[]): RegExp[] =>
  raw.flatMap((entry) => {
    const compiled = compileCustomPattern(entry);
    return compiled ? [compiled] : [];
  });

const redactWith = (text: string, pattern: RegExp): RedactResult => {
  let count = 0;
  const next = text.replace(pattern, () => {
    count += 1;
    return REDACTION_TOKEN;
  });
  return { count, text: next };
};

export const redactPii = (
  text: string,
  options: RedactOptions = {}
): RedactResult => {
  const patterns = [
    ...BUILTIN_PATTERNS,
    ...compileCustomPatterns(options.customPatterns ?? []),
  ];

  let current = text;
  let total = 0;
  for (const pattern of patterns) {
    const { text: next, count } = redactWith(current, pattern);
    current = next;
    total += count;
  }
  return { count: total, text: current };
};
