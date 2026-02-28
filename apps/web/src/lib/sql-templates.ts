import type { TableItem, ViewItem } from "@/lib/tauri";

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
