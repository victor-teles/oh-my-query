import type { ColumnDetail, SchemaInfo, TableItem } from "@conch/core";

export const PREFILTER_THRESHOLD = 150;
export const RELEVANT_TABLES = 40;
const MAX_TABLES_WITH_NEIGHBORS = 80;

const SCORE_TABLE_EXACT = 10;
const SCORE_TABLE_PARTIAL = 5;
const SCORE_COLUMN_EXACT = 3;
const SCORE_COLUMN_PARTIAL = 1;
const MIN_TOKEN_LENGTH = 3;

const STOP_WORDS = new Set([
  "all",
  "and",
  "are",
  "by",
  "each",
  "for",
  "from",
  "how",
  "last",
  "many",
  "per",
  "show",
  "the",
  "this",
  "top",
  "what",
  "which",
  "with",
]);

export interface FilteredSchema {
  schema: SchemaInfo;
  omittedTables: number;
}

interface Relation {
  key: string;
  schemaName: string;
  name: string;
  columns: ColumnDetail[];
  table: TableItem | null;
  index: number;
}

const stem = (word: string): string => {
  if (word.endsWith("ies") && word.length > 4) {
    return `${word.slice(0, -3)}y`;
  }
  if (word.endsWith("ses") || word.endsWith("xes")) {
    return word.slice(0, -2);
  }
  if (word.endsWith("s") && !word.endsWith("ss") && word.length > 3) {
    return word.slice(0, -1);
  }
  return word;
};

const words = (text: string): string[] =>
  text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= MIN_TOKEN_LENGTH)
    .map(stem);

const promptTokens = (prompt: string): string[] => [
  ...new Set(words(prompt).filter((word) => !STOP_WORDS.has(word))),
];

const scoreName = (
  name: string,
  tokens: string[],
  exact: number,
  partial: number
): number => {
  const parts = words(name);
  const joined = parts.join("_");
  let score = 0;
  for (const token of tokens) {
    if (parts.includes(token)) {
      score += exact;
    } else if (joined.includes(token)) {
      score += partial;
    }
  }
  return score;
};

const scoreRelation = (relation: Relation, tokens: string[]): number =>
  scoreName(relation.name, tokens, SCORE_TABLE_EXACT, SCORE_TABLE_PARTIAL) +
  relation.columns.reduce(
    (total, column) =>
      total +
      scoreName(column.name, tokens, SCORE_COLUMN_EXACT, SCORE_COLUMN_PARTIAL),
    0
  );

const relationsOf = (schema: SchemaInfo): Relation[] =>
  schema.schemas
    .flatMap((item) => [
      ...item.tables.map((table) => ({
        columns: table.columns,
        name: table.name,
        schemaName: item.name,
        table,
      })),
      ...item.views.map((view) => ({
        columns: view.columns,
        name: view.name,
        schemaName: item.name,
        table: null,
      })),
    ])
    .map((relation, index) => ({
      ...relation,
      index,
      key: `${relation.schemaName}.${relation.name}`,
    }));

const byRelevance = (tokens: string[]) => {
  const scores = new Map<Relation, number>();
  const scoreOf = (relation: Relation): number => {
    let score = scores.get(relation);
    if (score === undefined) {
      score = scoreRelation(relation, tokens);
      scores.set(relation, score);
    }
    return score;
  };
  return (a: Relation, b: Relation): number =>
    scoreOf(b) - scoreOf(a) ||
    (b.table?.rowEstimate ?? 0) - (a.table?.rowEstimate ?? 0) ||
    a.index - b.index;
};

const neighborKeys = (relation: Relation, all: Relation[]): string[] => {
  const outbound = (relation.table?.foreignKeys ?? []).map(
    (fk) => `${relation.schemaName}.${fk.referencedTable}`
  );
  const inbound = all
    .filter((other) =>
      other.table?.foreignKeys.some(
        (fk) =>
          other.schemaName === relation.schemaName &&
          fk.referencedTable === relation.name
      )
    )
    .map((other) => other.key);
  return [...outbound, ...inbound];
};

const keepRelations = (relations: Relation[], prompt: string): Set<string> => {
  const ranked = relations.toSorted(byRelevance(promptTokens(prompt)));
  const relevant = ranked.slice(0, RELEVANT_TABLES);
  const kept = new Set(relevant.map((relation) => relation.key));
  const known = new Set(relations.map((relation) => relation.key));
  for (const relation of relevant) {
    for (const key of neighborKeys(relation, relations)) {
      if (kept.size >= MAX_TABLES_WITH_NEIGHBORS) {
        return kept;
      }
      if (known.has(key)) {
        kept.add(key);
      }
    }
  }
  return kept;
};

export const selectRelevantSchema = (
  schema: SchemaInfo,
  prompt: string
): FilteredSchema => {
  const relations = relationsOf(schema);
  if (relations.length <= PREFILTER_THRESHOLD) {
    return { omittedTables: 0, schema };
  }
  const kept = keepRelations(relations, prompt);
  const isKept = (schemaName: string, name: string) =>
    kept.has(`${schemaName}.${name}`);
  return {
    omittedTables: relations.length - kept.size,
    schema: {
      schemas: schema.schemas.map((item) => ({
        ...item,
        tables: item.tables.filter((table) => isKept(item.name, table.name)),
        views: item.views.filter((view) => isKept(item.name, view.name)),
      })),
    },
  };
};
