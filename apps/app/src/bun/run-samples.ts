import type { CardResult, CardSpec, RunSample } from "@oh-my-query/rpc";

import { scalarOf } from "@oh-my-query/rpc";
import { createHash } from "node:crypto";

const hex16 = (text: string): string =>
  createHash("sha256").update(text).digest("hex").slice(0, 16);

const canonical = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(canonical);
  }
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .toSorted()
        .map((key) => [key, canonical((value as Record<string, unknown>)[key])])
    );
  }
  return value;
};

// Presets stay unexpanded ("last30d"), so a key compares like with like across days.
export const valuesKeyOf = (
  values: Readonly<Record<string, unknown>>
): string => hex16(JSON.stringify(canonical(values)));

const jsonSafe = (_key: string, value: unknown): unknown =>
  typeof value === "bigint" ? value.toString() : value;

export const rowsDigest = (rows: readonly unknown[][]): string =>
  hex16(JSON.stringify(rows, jsonSafe));

export const sampleOf = (
  spec: Pick<CardSpec, "view">,
  result: CardResult,
  at: Date
): RunSample => ({
  at: at.toISOString(),
  digest: rowsDigest(result.rows),
  rowCount: result.rowCount,
  value: scalarOf(spec, result)?.value ?? null,
});
