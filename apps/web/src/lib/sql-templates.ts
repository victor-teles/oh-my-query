import type { TableItem, ViewItem } from "@/lib/tauri";

const quoteRedisKey = (key: string): string =>
  /[\s"'`\\]/.test(key) ? `"${key.replaceAll('"', '\\"')}"` : key;

export const redisInspectCommand = (key: string, kind: string): string => {
  const k = quoteRedisKey(key);
  switch (kind.toUpperCase()) {
    case "STRING": {
      return `GET ${k}`;
    }
    case "HASH": {
      return `HGETALL ${k}`;
    }
    case "LIST": {
      return `LRANGE ${k} 0 99`;
    }
    case "SET": {
      return `SMEMBERS ${k}`;
    }
    case "ZSET": {
      return `ZRANGE ${k} 0 99 WITHSCORES`;
    }
    case "STREAM": {
      return `XRANGE ${k} - + COUNT 100`;
    }
    default: {
      return `TYPE ${k}`;
    }
  }
};

export const redisTypeCommand = (key: string): string =>
  `TYPE ${quoteRedisKey(key)}`;

export const redisTtlCommand = (key: string): string =>
  `TTL ${quoteRedisKey(key)}`;

export const redisDeleteCommand = (key: string): string =>
  `DEL ${quoteRedisKey(key)}`;

export const generateSelectTop100 = (tableName: string): string =>
  `SELECT * FROM ${tableName} LIMIT 100;`;

export const generateDropTable = (tableName: string, isView: boolean): string =>
  isView ? `DROP VIEW ${tableName};` : `DROP TABLE ${tableName};`;

export const generateTruncateTable = (tableName: string): string =>
  `TRUNCATE TABLE ${tableName};`;

export const generateCreateTable = (
  table: TableItem | ViewItem,
  isView: boolean
): string => {
  if (isView) {
    return `-- CREATE VIEW statement not available from schema metadata\n-- View: ${table.name}`;
  }

  const columnDefs = table.columns.map((col) => {
    const parts = [`  ${col.name} ${col.dataType}`];
    if (col.isPrimaryKey) {
      parts.push("PRIMARY KEY");
    }
    if (!col.isNullable) {
      parts.push("NOT NULL");
    }
    if (col.defaultValue !== null) {
      parts.push(`DEFAULT ${col.defaultValue}`);
    }
    return parts.join(" ");
  });

  return `CREATE TABLE ${table.name} (\n${columnDefs.join(",\n")}\n);`;
};
