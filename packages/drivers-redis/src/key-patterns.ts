const VARIABLE_SEGMENTS: readonly RegExp[] = [
  /^-?\d+(?:\.\d+)?$/,
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  /^[0-9a-f]{12,}$/i,
  /^[^@\s]+@[^@\s]+\.[^@\s]+$/,
  /^\d{4}-\d{2}-\d{2}(?:[T ][\d:.]+(?:Z|[+-]\d{2}:?\d{2})?)?$/,
];

const TOKEN_LIKE = /^[A-Za-z0-9+/_=-]{16,}$/;

const looksLikeToken = (segment: string): boolean =>
  TOKEN_LIKE.test(segment) &&
  (/\d/.test(segment) || (/[a-z]/.test(segment) && /[A-Z]/.test(segment)));

const isVariable = (segment: string): boolean =>
  VARIABLE_SEGMENTS.some((pattern) => pattern.test(segment)) ||
  looksLikeToken(segment);

export const generalizeKey = (key: string): string =>
  key
    .split(":")
    .map((segment) => (isVariable(segment) ? "*" : segment))
    .join(":");

export interface KeyPattern {
  pattern: string;
  count: number;
  sample: string;
}

export const groupKeyPatterns = (keys: Iterable<string>): KeyPattern[] => {
  const groups = new Map<string, KeyPattern>();
  for (const key of keys) {
    const pattern = generalizeKey(key);
    const group = groups.get(pattern);
    if (group) {
      group.count += 1;
    } else {
      groups.set(pattern, { count: 1, pattern, sample: key });
    }
  }
  return [...groups.values()].toSorted(
    (a, b) => b.count - a.count || a.pattern.localeCompare(b.pattern)
  );
};
