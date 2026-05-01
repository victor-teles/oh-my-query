export interface RedactOptions {
  customPatterns?: string[];
}

export interface RedactResult {
  text: string;
  count: number;
}

const EMAIL = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

const PHONE = /(?:\+\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}\b/g;

const SSN = /\b(?!000|666|9\d{2})\d{3}-(?!00)\d{2}-(?!0000)\d{4}\b/g;

const CREDIT_CARD =
  /\b(?:4[0-9]{12}(?:[0-9]{3})?|[25][1-7][0-9]{14}|6(?:011|5[0-9]{2})[0-9]{12}|3[47][0-9]{13}|3(?:0[0-5]|[68][0-9])[0-9]{11}|(?:2131|1800|35\d{3})\d{11})\b/g;

const JWT = /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g;

const API_KEY =
  /(?:api[_-]?key|apikey|access[_-]?token|auth[_-]?token|secret[_-]?key|bearer)\s*[:=]\s*[\w\-.]{20,}/gi;

const IPV4 =
  /\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b/g;

export const PII_PATTERNS: Record<string, RegExp> = {
  api_key: API_KEY,
  credit_card: CREDIT_CARD,
  email: EMAIL,
  ipv4: IPV4,
  jwt: JWT,
  phone: PHONE,
  ssn: SSN,
};

const applyPattern = (
  text: string,
  re: RegExp
): { text: string; count: number } => {
  const matches = text.match(re);
  const count = matches?.length ?? 0;
  return { count, text: text.replace(re, "[REDACTED]") };
};

const ensureGlobal = (pattern: RegExp): RegExp =>
  pattern.flags.includes("g")
    ? new RegExp(pattern.source, pattern.flags)
    : new RegExp(pattern.source, `${pattern.flags}g`);

export const redactPii = (
  text: string,
  options: RedactOptions = {}
): RedactResult => {
  let result = text;
  let count = 0;

  for (const pattern of Object.values(PII_PATTERNS)) {
    const applied = applyPattern(result, ensureGlobal(pattern));
    result = applied.text;
    count += applied.count;
  }

  if (options.customPatterns) {
    for (const raw of options.customPatterns) {
      const trimmed = raw.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }
      try {
        const re = new RegExp(trimmed, "g");
        const applied = applyPattern(result, re);
        result = applied.text;
        count += applied.count;
      } catch {
        // invalid regex — skip silently
      }
    }
  }

  return { count, text: result };
};
