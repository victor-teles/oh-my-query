import type { DatabaseConnection } from "@/lib/connections";

const COMMITTED_TOKEN = /^\s*@(\S+) $/;

const named = (connection: DatabaseConnection): string =>
  connection.name.toLowerCase();

const only = <T>(items: readonly T[]): T | null =>
  items.length === 1 ? (items[0] ?? null) : null;

export const commitToken = (
  nextValue: string,
  connections: readonly DatabaseConnection[]
): DatabaseConnection | null => {
  const needle = COMMITTED_TOKEN.exec(nextValue)?.[1]?.toLowerCase();
  if (!needle) {
    return null;
  }
  return (
    only(connections.filter((connection) => named(connection) === needle)) ??
    only(
      connections.filter((connection) => named(connection).startsWith(needle))
    )
  );
};
