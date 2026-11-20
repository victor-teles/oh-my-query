import { z } from "zod";

export interface MongoReadQuery {
  description?: string;
  collection: string;
  pipeline: Record<string, unknown>[];
}

export type MongoReadQueryParse =
  | { ok: true; query: MongoReadQuery }
  | { ok: false; reason: string };

export const MONGO_MAX_STAGES = 30;
export const MONGO_MAX_QUERY_BYTES = 20_000;

export const MONGO_READ_STAGES = [
  "$match",
  "$project",
  "$addFields",
  "$set",
  "$unset",
  "$group",
  "$sort",
  "$limit",
  "$skip",
  "$count",
  "$unwind",
  "$lookup",
  "$bucket",
  "$bucketAuto",
  "$sortByCount",
  "$replaceRoot",
  "$replaceWith",
  "$sample",
  "$unionWith",
  "$setWindowFields",
  "$densify",
  "$fill",
  "$geoNear",
  "$graphLookup",
] as const;

const STAGES: ReadonlySet<string> = new Set(MONGO_READ_STAGES);

const WRITES = "writes data";
const RUNS_JS = "runs server-side JavaScript";
const SERVER_STATE = "reads server internals";

const DENIED: ReadonlyMap<string, string> = new Map([
  ["$out", WRITES],
  ["$merge", WRITES],
  ["$function", RUNS_JS],
  ["$accumulator", RUNS_JS],
  ["$where", RUNS_JS],
  ["$code", RUNS_JS],
  ["$currentOp", SERVER_STATE],
  ["$listSessions", SERVER_STATE],
  ["$listLocalSessions", SERVER_STATE],
  ["$planCacheStats", SERVER_STATE],
  ["$changeStream", SERVER_STATE],
  ["$collStats", SERVER_STATE],
  ["$indexStats", SERVER_STATE],
]);

const isSystemCollection = (name: string): boolean =>
  name.startsWith("system.");

const isCollectionName = (name: string): boolean =>
  !(name.includes("$") || name.includes("\u0000"));

const CollectionName = z
  .string()
  .min(1)
  .max(120)
  .refine(isCollectionName, { message: "The collection name is not valid." })
  .refine((name) => !isSystemCollection(name), {
    message: "System collections can't be queried here.",
  });

const Stage = z.record(z.string(), z.unknown());

const QueryShape = z.object({
  collection: CollectionName,
  description: z.string().max(200).optional(),
  pipeline: z.array(Stage).min(1).max(MONGO_MAX_STAGES),
});

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const deniedKeyIn = (value: unknown): string | null => {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = deniedKeyIn(item);
      if (found) {
        return found;
      }
    }
    return null;
  }
  if (!isPlainObject(value)) {
    return null;
  }
  for (const [key, nested] of Object.entries(value)) {
    if (DENIED.has(key)) {
      return key;
    }
    const found = deniedKeyIn(nested);
    if (found) {
      return found;
    }
  }
  return null;
};

const deniedReason = (key: string): string =>
  `${key} ${DENIED.get(key) ?? WRITES}; only read-only pipelines can run here.`;

const systemReason = (stage: string): string =>
  `${stage} can't read system collections.`;

const checkForeignCollection = (
  stage: string,
  name: unknown
): string | null => {
  if (typeof name !== "string" || name.length === 0) {
    return `${stage} must name a collection.`;
  }
  return isSystemCollection(name) ? systemReason(stage) : null;
};

const checkSubPipeline = (stage: string, pipeline: unknown): string | null => {
  if (pipeline === undefined) {
    return null;
  }
  if (!(Array.isArray(pipeline) && pipeline.every(isPlainObject))) {
    return `${stage}.pipeline must be a list of stages.`;
  }
  return checkPipeline(pipeline);
};

const checkLookup = (body: unknown): string | null => {
  if (!isPlainObject(body)) {
    return "$lookup needs an object.";
  }
  if (body.from === undefined && body.pipeline !== undefined) {
    return checkSubPipeline("$lookup", body.pipeline);
  }
  return (
    checkForeignCollection("$lookup", body.from) ??
    checkSubPipeline("$lookup", body.pipeline)
  );
};

const checkUnionWith = (body: unknown): string | null => {
  if (typeof body === "string") {
    return checkForeignCollection("$unionWith", body);
  }
  if (!isPlainObject(body)) {
    return "$unionWith needs a collection name or an object.";
  }
  return (
    checkForeignCollection("$unionWith", body.coll) ??
    checkSubPipeline("$unionWith", body.pipeline)
  );
};

const checkGraphLookup = (body: unknown): string | null =>
  isPlainObject(body)
    ? checkForeignCollection("$graphLookup", body.from)
    : "$graphLookup needs an object.";

const checkStage = (
  stage: Record<string, unknown>,
  index: number
): string | null => {
  const keys = Object.keys(stage);
  const [name] = keys;
  if (keys.length !== 1 || name === undefined) {
    return "Each pipeline stage must have exactly one operator.";
  }
  if (!STAGES.has(name)) {
    return `${name} is not an allowed pipeline stage.`;
  }
  const body = stage[name];
  switch (name) {
    case "$geoNear": {
      return index === 0 ? null : "$geoNear must be the first stage.";
    }
    case "$lookup": {
      return checkLookup(body);
    }
    case "$unionWith": {
      return checkUnionWith(body);
    }
    case "$graphLookup": {
      return checkGraphLookup(body);
    }
    default: {
      return null;
    }
  }
};

function checkPipeline(
  pipeline: readonly Record<string, unknown>[]
): string | null {
  for (const [index, stage] of pipeline.entries()) {
    const problem = checkStage(stage, index);
    if (problem) {
      return problem;
    }
  }
  return null;
}

const byteLength = (text: string): number =>
  new TextEncoder().encode(text).length;

const parseJson = (text: string): { ok: true; value: unknown } | null => {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return null;
  }
};

const shapeReason = (error: z.ZodError): string => {
  const [issue] = error.issues;
  if (issue?.path[0] === "collection") {
    return issue.message;
  }
  if (issue?.path[0] === "pipeline" && issue.code === "too_big") {
    return `The pipeline can have at most ${MONGO_MAX_STAGES} stages.`;
  }
  return 'The reply must be {"collection": "<name>", "pipeline": [ … ]}.';
};

export const parseMongoReadQuery = (text: string): MongoReadQueryParse => {
  if (byteLength(text) > MONGO_MAX_QUERY_BYTES) {
    return { ok: false, reason: "The pipeline is longer than 20 KB." };
  }
  const json = parseJson(text.trim());
  if (!(json && isPlainObject(json.value))) {
    return { ok: false, reason: "The pipeline is not a valid JSON object." };
  }
  const denied = deniedKeyIn(json.value);
  if (denied) {
    return { ok: false, reason: deniedReason(denied) };
  }
  const shape = QueryShape.safeParse(json.value);
  if (!shape.success) {
    return { ok: false, reason: shapeReason(shape.error) };
  }
  const problem = checkPipeline(shape.data.pipeline);
  if (problem) {
    return { ok: false, reason: problem };
  }
  return { ok: true, query: shape.data };
};
