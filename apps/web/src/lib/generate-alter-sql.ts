import type { DatabaseType } from "@/lib/connections";
import type { ColumnDetail } from "@/lib/tauri";

export interface ColumnChange {
  action: "add" | "drop" | "modify";
  columnName: string;
  newName?: string;
  dataType?: string;
  isNullable?: boolean;
  defaultValue?: string | null;
}

const quoteIdentifier = (name: string, dbType: DatabaseType): string => {
  if (dbType === "mysql") {
    return `\`${name}\``;
  }
  return `"${name}"`;
};

const quotePostgres = (name: string): string => `"${name}"`;
const quoteMySQL = (name: string): string => `\`${name}\``;

const generateAddColumn = (
  tableName: string,
  change: ColumnChange,
  dbType: DatabaseType
): string => {
  const q = (name: string) => quoteIdentifier(name, dbType);
  const parts = [
    `ALTER TABLE ${q(tableName)} ADD COLUMN ${q(change.columnName)} ${change.dataType ?? "text"}`,
  ];

  if (change.isNullable === false) {
    parts.push("NOT NULL");
  }

  if (change.defaultValue !== undefined && change.defaultValue !== null) {
    parts.push(`DEFAULT ${change.defaultValue}`);
  }

  return `${parts.join(" ")};`;
};

const generateDropColumn = (
  tableName: string,
  change: ColumnChange,
  dbType: DatabaseType
): string => {
  const q = (name: string) => quoteIdentifier(name, dbType);
  return `ALTER TABLE ${q(tableName)} DROP COLUMN ${q(change.columnName)};`;
};

const generateModifyColumnPostgres = (
  tableName: string,
  change: ColumnChange,
  original: ColumnDetail
): string => {
  const statements: string[] = [];

  if (change.dataType && change.dataType !== original.dataType) {
    statements.push(
      `ALTER TABLE ${quotePostgres(tableName)} ALTER COLUMN ${quotePostgres(change.columnName)} TYPE ${change.dataType};`
    );
  }

  if (
    change.isNullable !== undefined &&
    change.isNullable !== original.isNullable
  ) {
    const action = change.isNullable ? "DROP NOT NULL" : "SET NOT NULL";
    statements.push(
      `ALTER TABLE ${quotePostgres(tableName)} ALTER COLUMN ${quotePostgres(change.columnName)} ${action};`
    );
  }

  if (change.defaultValue !== undefined) {
    if (change.defaultValue === null) {
      statements.push(
        `ALTER TABLE ${quotePostgres(tableName)} ALTER COLUMN ${quotePostgres(change.columnName)} DROP DEFAULT;`
      );
    } else if (change.defaultValue !== original.defaultValue) {
      statements.push(
        `ALTER TABLE ${quotePostgres(tableName)} ALTER COLUMN ${quotePostgres(change.columnName)} SET DEFAULT ${change.defaultValue};`
      );
    }
  }

  if (change.newName && change.newName !== change.columnName) {
    statements.push(
      `ALTER TABLE ${quotePostgres(tableName)} RENAME COLUMN ${quotePostgres(change.columnName)} TO ${quotePostgres(change.newName)};`
    );
  }

  return statements.join("\n");
};

const resolveDefaultValue = (
  changeDefault: string | null | undefined,
  originalDefault: string | null
): string => {
  if (changeDefault !== undefined) {
    return changeDefault !== null ? ` DEFAULT ${changeDefault}` : "";
  }
  return originalDefault ? ` DEFAULT ${originalDefault}` : "";
};

const generateModifyColumnMySQL = (
  tableName: string,
  change: ColumnChange,
  original: ColumnDetail
): string => {
  const statements: string[] = [];

  const hasTypeChange =
    change.dataType && change.dataType !== original.dataType;
  const hasNullChange =
    change.isNullable !== undefined &&
    change.isNullable !== original.isNullable;
  const hasDefaultChange =
    change.defaultValue !== undefined &&
    change.defaultValue !== original.defaultValue;

  if (hasTypeChange || hasNullChange || hasDefaultChange) {
    const dataType = change.dataType ?? original.dataType;
    const nullable =
      (change.isNullable ?? original.isNullable) ? "" : " NOT NULL";
    const defaultVal = resolveDefaultValue(
      change.defaultValue,
      original.defaultValue
    );

    statements.push(
      `ALTER TABLE ${quoteMySQL(tableName)} MODIFY COLUMN ${quoteMySQL(change.columnName)} ${dataType}${nullable}${defaultVal};`
    );
  }

  if (change.newName && change.newName !== change.columnName) {
    statements.push(
      `ALTER TABLE ${quoteMySQL(tableName)} RENAME COLUMN ${quoteMySQL(change.columnName)} TO ${quoteMySQL(change.newName)};`
    );
  }

  return statements.join("\n");
};

export const computeChanges = (
  originalColumns: ColumnDetail[],
  editedColumns: EditedColumn[]
): ColumnChange[] => {
  const changes: ColumnChange[] = [];

  const originalMap = new Map(originalColumns.map((c) => [c.name, c]));
  const editedNames = new Set(
    editedColumns.map((c) => c.originalName ?? c.name)
  );

  for (const original of originalColumns) {
    if (!editedNames.has(original.name)) {
      changes.push({ action: "drop", columnName: original.name });
    }
  }

  for (const edited of editedColumns) {
    const original = edited.originalName
      ? originalMap.get(edited.originalName)
      : undefined;

    if (!original) {
      changes.push({
        action: "add",
        columnName: edited.name,
        dataType: edited.dataType,
        defaultValue: edited.defaultValue,
        isNullable: edited.isNullable,
      });
    } else {
      const hasChanges =
        edited.name !== original.name ||
        edited.dataType !== original.dataType ||
        edited.isNullable !== original.isNullable ||
        edited.defaultValue !== original.defaultValue;

      if (hasChanges) {
        changes.push({
          action: "modify",
          columnName: original.name,
          dataType: edited.dataType,
          defaultValue: edited.defaultValue,
          isNullable: edited.isNullable,
          newName: edited.name !== original.name ? edited.name : undefined,
        });
      }
    }
  }

  return changes;
};

export interface EditedColumn {
  name: string;
  dataType: string;
  isNullable: boolean;
  defaultValue: string | null;
  originalName?: string;
}

export const generateAlterSQL = (
  tableName: string,
  changes: ColumnChange[],
  dbType: DatabaseType,
  originalColumns: ColumnDetail[]
): string => {
  const originalMap = new Map(originalColumns.map((c) => [c.name, c]));
  const statements: string[] = [];

  for (const change of changes) {
    switch (change.action) {
      case "add": {
        statements.push(generateAddColumn(tableName, change, dbType));
        break;
      }
      case "drop": {
        if (dbType === "sqlite") {
          statements.push(
            `-- SQLite does not support DROP COLUMN for older versions`
          );
        }
        statements.push(generateDropColumn(tableName, change, dbType));
        break;
      }
      case "modify": {
        const original = originalMap.get(change.columnName);
        if (!original) {
          break;
        }
        if (dbType === "mysql") {
          statements.push(
            generateModifyColumnMySQL(tableName, change, original)
          );
        } else {
          statements.push(
            generateModifyColumnPostgres(tableName, change, original)
          );
        }
        break;
      }
      default: {
        break;
      }
    }
  }

  return statements.filter(Boolean).join("\n");
};
