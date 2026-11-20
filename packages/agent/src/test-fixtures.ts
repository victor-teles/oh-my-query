import type {
  ColumnDetail,
  ForeignKeyItem,
  SchemaInfo,
  TableItem,
} from "@conch/core";

export const column = (name: string, dataType = "text"): ColumnDetail => ({
  dataType,
  defaultValue: null,
  isNullable: false,
  isPrimaryKey: name === "id",
  name,
});

export const foreignKey = (
  columnName: string,
  referencedTable: string
): ForeignKeyItem => ({
  columns: [columnName],
  name: `${columnName}_fk`,
  referencedColumns: ["id"],
  referencedTable,
});

export const table = (
  name: string,
  foreignKeys: ForeignKeyItem[] = [],
  rowEstimate: number | null = null,
  columns: ColumnDetail[] = [column("id", "uuid"), column("name")]
): TableItem => ({
  columns,
  foreignKeys,
  indexes: [],
  name,
  rowEstimate,
});

export const largeSchema = (
  fillerTables: number,
  extraTables: TableItem[] = []
): SchemaInfo => {
  const filler = Array.from({ length: fillerTables }, (_, i) =>
    table(`filler_${String(i).padStart(3, "0")}`)
  );
  const domain =
    fillerTables > 150
      ? [
          table("regions"),
          table("accounts", [foreignKey("region_id", "regions")]),
          table(
            "revenue_events",
            [foreignKey("account_id", "accounts")],
            null,
            [
              column("id", "uuid"),
              column("account_id", "uuid"),
              column("amount", "numeric"),
            ]
          ),
        ]
      : [];
  return {
    schemas: [
      {
        name: "public",
        tables: [...filler, ...domain, ...extraTables],
        views: [],
      },
    ],
  };
};
