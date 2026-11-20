import type { RecentAsk } from "@/lib/ipc";

import { fuzzyMatch } from "@/lib/fuzzy-match";

export interface HistoryEntry {
  ask: RecentAsk;
  connectionName: string | null;
}

export interface HistoryMatch {
  id: string;
  entry: HistoryEntry;
  promptMatches: number[];
}

export interface HistorySection {
  id: string;
  label: string;
  entries: HistoryMatch[];
}

const DAY_MS = 86_400_000;
const WEEK_DAYS = 7;
const SQL_WEIGHT = 0.5;
const SQL_WORD = /[a-z_][a-z0-9_]*/giu;
const SQL_KEYWORDS = new Set([
  "and",
  "as",
  "asc",
  "between",
  "by",
  "case",
  "count",
  "date",
  "desc",
  "distinct",
  "else",
  "end",
  "from",
  "group",
  "having",
  "in",
  "inner",
  "interval",
  "is",
  "join",
  "left",
  "limit",
  "not",
  "null",
  "on",
  "or",
  "order",
  "outer",
  "right",
  "select",
  "sum",
  "then",
  "when",
  "where",
  "with",
]);

const WEEKDAY = new Intl.DateTimeFormat("en-US", { weekday: "long" });
const MONTH = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
});

const startOfDay = (date: Date): number =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

// Rounding absorbs the 23- and 25-hour days around a DST change.
const daysBetween = (earlier: Date, later: Date): number =>
  Math.round((startOfDay(later) - startOfDay(earlier)) / DAY_MS);

const dayGroup = (
  askedAt: Date,
  now: Date
): Omit<HistorySection, "entries"> => {
  if (Number.isNaN(askedAt.getTime())) {
    return { id: "earlier", label: "Earlier" };
  }
  const days = daysBetween(askedAt, now);
  if (days <= 0) {
    return { id: "today", label: "Today" };
  }
  if (days === 1) {
    return { id: "yesterday", label: "Yesterday" };
  }
  if (days < WEEK_DAYS) {
    return { id: `day-${days}`, label: WEEKDAY.format(askedAt) };
  }
  return {
    id: `month-${askedAt.getFullYear()}-${askedAt.getMonth()}`,
    label: MONTH.format(askedAt),
  };
};

const newestFirst = (a: HistoryEntry, b: HistoryEntry): number =>
  b.ask.askedAt.localeCompare(a.ask.askedAt);

const groupByDay = (
  entries: readonly HistoryEntry[],
  now: Date
): HistorySection[] => {
  const sections = new Map<string, HistorySection>();
  for (const entry of entries.toSorted(newestFirst)) {
    const group = dayGroup(new Date(entry.ask.askedAt), now);
    const section = sections.get(group.id) ?? { ...group, entries: [] };
    section.entries.push({ entry, id: entry.ask.id, promptMatches: [] });
    sections.set(group.id, section);
  }
  return [...sections.values()];
};

const sqlWords = (sql: string): string[] => [
  ...new Set(
    (sql.match(SQL_WORD) ?? [])
      .map((word) => word.toLowerCase())
      .filter((word) => !SQL_KEYWORDS.has(word))
  ),
];

const bestWordScore = (words: readonly string[], term: string) => {
  let best: number | null = null;
  for (const word of words) {
    const score = fuzzyMatch(word, term)?.score ?? null;
    if (score !== null && (best === null || score > best)) {
      best = score;
    }
  }
  return best;
};

const sqlScore = (sql: string, query: string): number | null => {
  const words = sqlWords(sql);
  let total = 0;
  for (const term of query.split(/\s+/u)) {
    const score = bestWordScore(words, term);
    if (score === null) {
      return null;
    }
    total += score;
  }
  return Math.min(total, total * SQL_WEIGHT);
};

interface Scored {
  match: HistoryMatch;
  score: number;
}

const scoreEntry = (entry: HistoryEntry, query: string): Scored | null => {
  const prompt = fuzzyMatch(entry.ask.prompt, query);
  const scores = [
    prompt?.score ?? null,
    fuzzyMatch(entry.ask.spec.title, query)?.score ?? null,
    entry.connectionName === null
      ? null
      : (fuzzyMatch(entry.connectionName, query)?.score ?? null),
    sqlScore(entry.ask.sql, query),
  ].filter((score): score is number => score !== null);
  if (scores.length === 0) {
    return null;
  }
  return {
    match: { entry, id: entry.ask.id, promptMatches: prompt?.matches ?? [] },
    score: Math.max(...scores),
  };
};

const byScoreThenRecency = (a: Scored, b: Scored): number =>
  b.score - a.score || newestFirst(a.match.entry, b.match.entry);

export const historySections = (
  entries: readonly HistoryEntry[],
  query: string,
  now: Date
): HistorySection[] => {
  const needle = query.trim();
  if (!needle) {
    return groupByDay(entries, now);
  }
  const matches = entries
    .map((entry) => scoreEntry(entry, needle))
    .filter((scored): scored is Scored => scored !== null)
    .toSorted(byScoreThenRecency)
    .map((scored) => scored.match);
  return matches.length > 0
    ? [{ entries: matches, id: "matches", label: "Matches" }]
    : [];
};

export const flattenHistory = (
  sections: readonly HistorySection[]
): HistoryMatch[] => sections.flatMap((section) => section.entries);
