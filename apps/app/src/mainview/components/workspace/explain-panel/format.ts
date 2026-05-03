const formatMsValue = (ms: number, msPrecision: number): string => {
  if (ms < 1) {
    const us = Math.round(ms * 1000);
    if (us < 1000) {
      return `${us}µs`;
    }
  }
  if (ms < 1000) {
    const msStr = ms.toFixed(msPrecision);
    if (Number(msStr) < 1000) {
      return `${msStr}ms`;
    }
  }
  return `${(ms / 1000).toFixed(2)}s`;
};

const formatRowsValue = (rows: number): string => {
  if (rows >= 1_000_000) {
    return `${(rows / 1_000_000).toFixed(1)}M`;
  }
  if (rows >= 1000) {
    return `${(rows / 1000).toFixed(1)}k`;
  }
  return Math.round(rows).toString();
};

export const formatMsShort = (ms: number | null): string | null =>
  ms === null ? null : formatMsValue(ms, 1);

export const formatMs = (ms: number | null): string =>
  ms === null ? "—" : formatMsValue(ms, 2);

export const formatRowsShort = (rows: number | null): string | null =>
  rows === null ? null : formatRowsValue(rows);

export const formatRows = (rows: number | null): string =>
  rows === null ? "—" : formatRowsValue(rows);
