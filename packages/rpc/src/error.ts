import { DbError } from "@oh-my-query/core/client";

const ENCODED_ERROR_PREFIX = "__omq_err__";

const stringifySubError = (sub: unknown): string => {
  if (sub instanceof Error) {
    return sub.message;
  }
  if (typeof sub === "string") {
    return sub;
  }
  if (sub === null || sub === undefined) {
    return "";
  }
  if (typeof sub === "object") {
    const msg = (sub as { message?: unknown }).message;
    if (typeof msg === "string" && msg.length > 0) {
      return msg;
    }
    try {
      return JSON.stringify(sub);
    } catch {
      return "";
    }
  }
  return String(sub);
};

const flattenAggregate = (
  err: AggregateError
): { code: string; message: string } => {
  const messages = err.errors
    .map(stringifySubError)
    .filter((m) => m.length > 0);
  const firstWithCode = err.errors.find(
    (sub): sub is { code: string } & object =>
      typeof (sub as { code?: unknown })?.code === "string"
  );
  const code =
    (firstWithCode?.code as string | undefined) ??
    (err.errors[0] instanceof DbError ? err.errors[0].code : undefined) ??
    "DB_ERROR";
  const message =
    messages.length > 0 ? messages.join("; ") : err.message || "AggregateError";
  return { code, message };
};

export const encodeRpcError = (err: unknown): never => {
  if (err instanceof DbError) {
    const message = err.message || err.code || "Database error";
    const payload = JSON.stringify({ code: err.code, message });
    throw new Error(`${ENCODED_ERROR_PREFIX}${payload}`);
  }
  if (err instanceof AggregateError) {
    const flattened = flattenAggregate(err);
    const payload = JSON.stringify(flattened);
    throw new Error(`${ENCODED_ERROR_PREFIX}${payload}`);
  }
  throw err;
};

export const decodeRpcError = (err: unknown): unknown => {
  if (
    !(err instanceof Error) ||
    !err.message.startsWith(ENCODED_ERROR_PREFIX)
  ) {
    return err;
  }
  try {
    const parsed = JSON.parse(
      err.message.slice(ENCODED_ERROR_PREFIX.length)
    ) as { code?: unknown; message?: unknown };
    if (typeof parsed.code !== "string" || typeof parsed.message !== "string") {
      return err;
    }
    const decoded = new Error(parsed.message);
    (decoded as Error & { code: string }).code = parsed.code;
    decoded.name = "DbError";
    return decoded;
  } catch {
    return err;
  }
};
