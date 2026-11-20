import type {
  ColumnDetail,
  SchemaInfo,
  TableItem,
} from "@oh-my-query/core/client";
import type { SchemaPeek } from "@oh-my-query/rpc";

const column = (
  name: string,
  dataType: string,
  options: Partial<ColumnDetail> = {}
): ColumnDetail => ({
  dataType,
  defaultValue: null,
  isNullable: false,
  isPrimaryKey: name === "id",
  name,
  ...options,
});

const table = (
  name: string,
  rowEstimate: number,
  columns: ColumnDetail[],
  extra: Partial<TableItem> = {}
): TableItem => ({
  columns,
  foreignKeys: [],
  indexes: [{ columns: ["id"], isUnique: true, name: `${name}_pkey` }],
  name,
  rowEstimate,
  ...extra,
});

export const DEMO_SCHEMA: SchemaInfo = {
  schemas: [
    {
      name: "public",
      tables: [
        table("customers", 48_200, [
          column("id", "int8"),
          column("email", "text"),
          column("name", "text"),
          column("region", "text", { isNullable: true }),
          column("created_at", "timestamptz"),
        ]),
        table(
          "events",
          3_400_000,
          [
            column("id", "int8"),
            column("customer_id", "int8"),
            column("kind", "text"),
            column("payload", "jsonb", { isNullable: true }),
            column("occurred_at", "timestamptz"),
          ],
          {
            foreignKeys: [
              {
                columns: ["customer_id"],
                name: "events_customer_fk",
                referencedColumns: ["id"],
                referencedTable: "customers",
              },
            ],
          }
        ),
        table(
          "orders",
          1_200_000,
          [
            column("id", "int8"),
            column("customer_id", "int8"),
            column("status", "text"),
            column("total", "numeric(12,2)"),
            column("created_at", "timestamptz"),
          ],
          {
            foreignKeys: [
              {
                columns: ["customer_id"],
                name: "orders_customer_fk",
                referencedColumns: ["id"],
                referencedTable: "customers",
              },
            ],
            indexes: [
              { columns: ["id"], isUnique: true, name: "orders_pkey" },
              {
                columns: ["customer_id", "created_at"],
                isUnique: false,
                name: "orders_customer_created_idx",
              },
            ],
          }
        ),
        table("subscriptions", 61_000, [
          column("id", "int8"),
          column("account_id", "int8"),
          column("plan", "text"),
          column("amount_cents", "int4"),
          column("billed_at", "date"),
        ]),
      ],
      views: [],
    },
  ],
};

export const demoSchemaPeek = (): SchemaPeek => ({
  database: "public",
  dialect: "postgresql",
  schema: DEMO_SCHEMA,
});
