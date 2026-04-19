export const CELL_CHAR_LIMIT = 120;

export const isNull = (value: unknown): boolean =>
  value === null || value === undefined;

export const isNumber = (value: unknown): boolean => typeof value === "number";

export const formatCell = (value: unknown): string => {
  if (isNull(value)) {
    return "NULL";
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
};

export const compareValues = (a: unknown, b: unknown): number => {
  const aNull = isNull(a);
  const bNull = isNull(b);
  if (aNull && bNull) {
    return 0;
  }
  if (aNull) {
    return 1;
  }
  if (bNull) {
    return -1;
  }
  if (typeof a === "number" && typeof b === "number") {
    return a - b;
  }
  if (typeof a === "boolean" && typeof b === "boolean") {
    if (a === b) {
      return 0;
    }
    return a ? 1 : -1;
  }
  return String(a).localeCompare(String(b), undefined, { numeric: true });
};
