const normalize = (line: string): string => line.trim();

const linesOf = (sql: string): string[] =>
  sql ? sql.trimEnd().split("\n").map(normalize) : [];

// Indexes (0-based) of lines in `next` that are not part of the longest
// common subsequence with `previous`.
export const changedLines = (previous: string, next: string): Set<number> => {
  const before = linesOf(previous);
  const after = linesOf(next);
  const lengths = Array.from({ length: before.length + 1 }, () =>
    Array.from({ length: after.length + 1 }, () => 0)
  );
  for (let i = before.length - 1; i >= 0; i -= 1) {
    for (let j = after.length - 1; j >= 0; j -= 1) {
      const row = lengths[i];
      if (!row) {
        continue;
      }
      row[j] =
        before[i] === after[j]
          ? (lengths[i + 1]?.[j + 1] ?? 0) + 1
          : Math.max(lengths[i + 1]?.[j] ?? 0, row[j + 1] ?? 0);
    }
  }
  const changed = new Set<number>();
  let i = 0;
  let j = 0;
  while (j < after.length) {
    if (i < before.length && before[i] === after[j]) {
      i += 1;
      j += 1;
    } else if (
      i < before.length &&
      (lengths[i + 1]?.[j] ?? 0) >= (lengths[i]?.[j + 1] ?? 0)
    ) {
      i += 1;
    } else {
      changed.add(j);
      j += 1;
    }
  }
  return changed;
};
