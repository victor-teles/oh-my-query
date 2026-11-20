import { z } from "zod";

export type RedisCommandShape = "scalar" | "keyed" | "collection";

export type RedisReadCommand = [string, ...string[]];

export type RedisReadPlan =
  | { kind: "commands"; description?: string; commands: RedisReadCommand[] }
  | {
      kind: "scan";
      description?: string;
      match: string;
      groupBy: "pattern" | "type" | "none";
      measure: "count" | "memory" | "ttl";
      limit: number;
    };

export type RedisReadPlanParse =
  | { ok: true; plan: RedisReadPlan }
  | { ok: false; reason: string };

export const REDIS_MAX_COMMANDS = 20;
export const REDIS_MAX_ARGS = 10;
export const REDIS_MAX_ARG_LENGTH = 512;
export const REDIS_MAX_RANGE = 2000;
const MAX_PLAN_BYTES = 20_000;

const SCALAR = [
  "GET",
  "STRLEN",
  "EXISTS",
  "TYPE",
  "TTL",
  "PTTL",
  "HGET",
  "HLEN",
  "HEXISTS",
  "LLEN",
  "LINDEX",
  "SCARD",
  "SISMEMBER",
  "ZCARD",
  "ZSCORE",
  "ZCOUNT",
  "ZRANK",
  "ZREVRANK",
  "XLEN",
  "PFCOUNT",
  "BITCOUNT",
  "GETRANGE",
  "DBSIZE",
  "MEMORY",
  "INFO",
] as const;
const KEYED = ["MGET", "HMGET"] as const;
const COLLECTION = [
  "HGETALL",
  "HKEYS",
  "HVALS",
  "SMEMBERS",
  "SRANDMEMBER",
  "HRANDFIELD",
  "LRANGE",
  "ZRANGE",
  "ZREVRANGE",
  "ZRANGEBYSCORE",
  "ZREVRANGEBYSCORE",
  "XRANGE",
  "XREVRANGE",
] as const;

export const REDIS_READ_COMMANDS = [...SCALAR, ...KEYED, ...COLLECTION];

const SHAPES: ReadonlyMap<string, RedisCommandShape> = new Map([
  ...SCALAR.map((name) => [name, "scalar"] as const),
  ...KEYED.map((name) => [name, "keyed"] as const),
  ...COLLECTION.map((name) => [name, "collection"] as const),
]);

export const redisCommandShape = (name: string): RedisCommandShape | null =>
  SHAPES.get(name.toUpperCase()) ?? null;

const INFO_SECTIONS = new Set([
  "memory",
  "stats",
  "keyspace",
  "clients",
  "server",
]);

const READ_ONLY = "only read commands can run here.";

const DENIED: readonly [RegExp, string, string][] = [
  [
    /^KEYS$/,
    "blocks the server while it reads every key",
    "use a scan plan instead.",
  ],
  [/^SORT$/, "can write its result with STORE", READ_ONLY],
  [/^(?:EVAL|FCALL|SCRIPT|FUNCTION)/, "runs server-side scripts", READ_ONLY],
  [/^(?:CONFIG|DEBUG)$/, "changes server settings", READ_ONLY],
  [/^FLUSH/, "deletes data", READ_ONLY],
  [/^(?:DEL|UNLINK)$/, "deletes data", READ_ONLY],
  [/^SET|STORE$/, "writes data", READ_ONLY],
];

const deniedReason = (name: string): string | null => {
  const rule = DENIED.find(([pattern]) => pattern.test(name));
  return rule ? `${name} ${rule[1]}; ${rule[2]}` : null;
};

const Arg = z
  .union([z.string(), z.number().finite()])
  .transform(String)
  .pipe(z.string().max(REDIS_MAX_ARG_LENGTH));

const Command = z
  .array(Arg)
  .min(1)
  .max(REDIS_MAX_ARGS + 1)
  .transform((parts): RedisReadCommand => {
    const [name = "", ...args] = parts;
    return [name.toUpperCase(), ...args];
  });

const Description = z.string().max(200).optional();

const PlanShape = z.discriminatedUnion("kind", [
  z.object({
    commands: z.array(Command).min(1).max(REDIS_MAX_COMMANDS),
    description: Description,
    kind: z.literal("commands"),
  }),
  z.object({
    description: Description,
    groupBy: z.enum(["pattern", "type", "none"]),
    kind: z.literal("scan"),
    limit: z.number().int().min(1).max(100),
    match: z.string().min(1).max(200),
    measure: z.enum(["count", "memory", "ttl"]),
  }),
]);

const integer = (text: string | undefined): number | null =>
  text !== undefined && /^-?\d+$/.test(text) ? Number(text) : null;

const RANGE_REASON = `asks for more than ${REDIS_MAX_RANGE.toLocaleString("en-US")} items`;

const checkRankRange = (
  name: string,
  start: string | undefined,
  stop: string | undefined
): string | null => {
  const from = integer(start);
  const to = integer(stop);
  if (from === null || to === null) {
    return `${name} needs a numeric start and stop.`;
  }
  const sameSide = from >= 0 === to >= 0;
  return sameSide && to - from < REDIS_MAX_RANGE
    ? null
    : `${name} ${RANGE_REASON}; use a range of at most ${REDIS_MAX_RANGE}.`;
};

const upper = (args: readonly string[]): string[] =>
  args.map((arg) => arg.toUpperCase());

const isScoreRange = (options: readonly string[]): boolean =>
  options.includes("BYSCORE") || options.includes("BYLEX");

const checkZrange = (name: string, args: readonly string[]): string | null => {
  const options = upper(args.slice(3));
  if (options.includes("STORE")) {
    return `${name} STORE writes data; ${READ_ONLY}`;
  }
  const byRank =
    (name === "ZRANGE" || name === "ZREVRANGE") && !isScoreRange(options);
  return byRank ? checkRankRange(name, args[1], args[2]) : null;
};

const checkStreamRange = (
  name: string,
  args: readonly string[]
): string | null => {
  const options = upper(args);
  const at = options.indexOf("COUNT");
  const count = integer(args[at + 1]);
  return at !== -1 && count !== null && count > 0 && count <= REDIS_MAX_RANGE
    ? null
    : `${name} needs COUNT n with n up to ${REDIS_MAX_RANGE}.`;
};

const checkRandom = (name: string, args: readonly string[]): string | null => {
  const count = args[1] === undefined ? 1 : integer(args[1]);
  return count !== null && Math.abs(count) <= REDIS_MAX_RANGE
    ? null
    : `${name} ${RANGE_REASON}.`;
};

const checkMemory = (args: readonly string[]): string | null =>
  args[0]?.toUpperCase() === "USAGE" && args.length >= 2
    ? null
    : "Only MEMORY USAGE <key> can run here.";

const checkInfo = (args: readonly string[]): string | null =>
  args.length === 1 && INFO_SECTIONS.has(args[0]?.toLowerCase() ?? "")
    ? null
    : "INFO needs one section: memory, stats, keyspace, clients or server.";

const checkArguments = (
  name: string,
  args: readonly string[]
): string | null => {
  switch (name) {
    case "MEMORY": {
      return checkMemory(args);
    }
    case "INFO": {
      return checkInfo(args);
    }
    case "LRANGE": {
      return checkRankRange(name, args[1], args[2]);
    }
    case "ZRANGE":
    case "ZREVRANGE":
    case "ZRANGEBYSCORE":
    case "ZREVRANGEBYSCORE": {
      return checkZrange(name, args);
    }
    case "XRANGE":
    case "XREVRANGE": {
      return checkStreamRange(name, args);
    }
    case "SRANDMEMBER":
    case "HRANDFIELD": {
      return checkRandom(name, args);
    }
    default: {
      return null;
    }
  }
};

const checkCommand = ([name, ...args]: RedisReadCommand): string | null => {
  const denied = deniedReason(name);
  if (denied) {
    return denied;
  }
  if (!SHAPES.has(name)) {
    return `${name} is not in the read-only command list.`;
  }
  return checkArguments(name, args);
};

const checkCommands = (
  commands: readonly RedisReadCommand[]
): string | null => {
  for (const command of commands) {
    const problem = checkCommand(command);
    if (problem) {
      return problem;
    }
  }
  const collections = commands.filter(
    ([name]) => SHAPES.get(name) === "collection"
  );
  return collections.length === 0 ||
    (collections.length === 1 && commands.length === 1)
    ? null
    : "A plan reads one collection, or a list of single values, not both.";
};

const parseJson = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
};

export const parseRedisReadPlan = (text: string): RedisReadPlanParse => {
  if (text.length > MAX_PLAN_BYTES) {
    return { ok: false, reason: "The plan is longer than 20 KB." };
  }
  const shape = PlanShape.safeParse(parseJson(text.trim()));
  if (!shape.success) {
    return {
      ok: false,
      reason:
        'The reply must be a {"kind": "commands"} or {"kind": "scan"} plan.',
    };
  }
  const plan = shape.data;
  const problem =
    plan.kind === "commands" ? checkCommands(plan.commands) : null;
  return problem ? { ok: false, reason: problem } : { ok: true, plan };
};
