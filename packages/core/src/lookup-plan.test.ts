import { describe, expect, it } from "vitest";

import type { LookupValue } from "./lookup-value.ts";
import type {
  ColumnDetail,
  DialectType,
  IndexItem,
  SchemaInfo,
  TableItem,
} from "./types.ts";

import {
  columnKind,
  DEFAULT_LOOKUP_LIMITS,
  lookupKindFits,
  lookupTemplateValue,
  planLookupProbes,
} from "./lookup-plan.ts";
import { compileSqlTemplate } from "./sql-template.ts";

const column = (
  name: string,
  dataType: string,
  isPrimaryKey = false
): ColumnDetail => ({
  dataType,
  defaultValue: null,
  isNullable: !isPrimaryKey,
  isPrimaryKey,
  name,
});

const index = (columns: string[], isUnique = false): IndexItem => ({
  columns,
  isUnique,
  name: `${columns.join("_")}_idx`,
});

const table = (
  name: string,
  columns: ColumnDetail[],
  extra: Partial<TableItem> = {}
): TableItem => ({
  columns,
  foreignKeys: [],
  indexes: [],
  name,
  rowEstimate: 1000,
  ...extra,
});

const FIXTURE: SchemaInfo = {
  schemas: [
    {
      name: "public",
      tables: [
        table("users", [
          column("id", "uuid", true),
          column("email", "character varying(255)"),
          column("notes", "text"),
          column("age", "integer"),
        ]),
        table(
          "orders",
          [
            column("id", "bigint", true),
            column("user_id", "uuid"),
            column("billing_email", "text"),
          ],
          {
            foreignKeys: [
              {
                columns: ["user_id"],
                name: "orders_user_fk",
                referencedColumns: ["id"],
                referencedTable: "users",
              },
            ],
            rowEstimate: 50_000,
          }
        ),
        table("events", [column("actor_id", "uuid"), column("kind", "text")], {
          rowEstimate: 5_000_000,
        }),
        table(
          "sessions",
          [column("token", "uuid"), column("user_id", "uuid")],
          { indexes: [index(["user_id"])], rowEstimate: 5_000_000 }
        ),
        table("invoices", [
          column("invoice_id", "int4", true),
          column("customerEmail", "citext"),
          column("external_ref", "uuid"),
        ]),
        table("flags", [column("id", "int2", true), column("mail", "text")], {
          rowEstimate: null,
        }),
        table("accounts", [
          column("accountId", "bigint"),
          column("account_uuid", "varchar(36)"),
          column("paid", "bigint"),
        ]),
        table("tags", [column("slug", "text", true)], {
          indexes: [index(["slug"], true)],
        }),
      ],
      views: [{ columns: [column("id", "uuid")], name: "active_users" }],
    },
  ],
};

const UUID: LookupValue = {
  kind: "uuid",
  value: "3f2a1b4c-9d8e-4f7a-b6c5-d4e3f2a1c91e",
};
const EMAIL: LookupValue = { kind: "email", value: "ada@example.com" };
const SMALL_INT: LookupValue = { kind: "integer", value: "42" };
const MID_INT: LookupValue = { kind: "integer", value: "99999" };

const targets = (value: LookupValue, schema: SchemaInfo = FIXTURE) =>
  planLookupProbes(schema, value, "postgresql").probes.map(
    (probe) => `${probe.table}.${probe.column}`
  );

describe("columnKind", () => {
  it.each([
    ["uuid", "postgresql", "uuid"],
    ["UUID", "duckdb", "uuid"],
    ["uniqueidentifier", "tsql", "uuid"],
    ["uuid", "mysql", "other"],
    ["character varying(255)", "postgresql", "text"],
    ["NVARCHAR(50)", "tsql", "text"],
    ["LowCardinality(Nullable(String))", "clickhouse", "text"],
    ["bigint(20) unsigned", "mysql", "integer"],
    ["HUGEINT", "duckdb", "integer"],
    ["tinyint", "mysql", "other"],
    ["numeric(10,2)", "postgresql", "other"],
    ["boolean", "postgresql", "other"],
    ["VARCHAR(36)", "sqlite", "text"],
    ["CLOB", "sqlite", "text"],
    ["UNSIGNED BIG INT", "sqlite", "integer"],
    ["BLOB", "sqlite", "other"],
  ] as const)("reads %s on %s as %s", (dataType, dialect, kind) => {
    expect(columnKind(dataType, dialect)).toBe(kind);
  });
});

describe("planLookupProbes", () => {
  it("picks uuid-typed and id-named columns for a UUID, keys first", () => {
    expect(targets(UUID)).toStrictEqual([
      "users.id",
      "orders.user_id",
      "sessions.user_id",
      "accounts.account_uuid",
      "invoices.external_ref",
    ]);
  });

  it("skips large tables without an index on the column", () => {
    const plan = planLookupProbes(FIXTURE, UUID, "postgresql");
    expect(plan.skipped).toStrictEqual({
      largeUnindexed: 2,
      outOfRange: 0,
      overLimit: 0,
    });
    expect(plan.tables).toBe(5);
  });

  it("picks email-named text columns for an email", () => {
    expect(targets(EMAIL)).toStrictEqual([
      "users.email",
      "flags.mail",
      "invoices.customerEmail",
      "orders.billing_email",
    ]);
  });

  it("picks id-named and primary-key integer columns for an integer", () => {
    expect(targets(SMALL_INT)).toStrictEqual([
      "orders.id",
      "flags.id",
      "invoices.invoice_id",
      "accounts.accountId",
    ]);
  });

  it("skips integer columns too small for the value", () => {
    const plan = planLookupProbes(FIXTURE, MID_INT, "postgresql");
    expect(plan.probes.map((probe) => probe.table)).not.toContain("flags");
    expect(plan.skipped.outOfRange).toBe(1);
  });

  it("ignores views and stays stable across runs", () => {
    const first = planLookupProbes(FIXTURE, UUID, "postgresql");
    const reversed: SchemaInfo = {
      schemas: FIXTURE.schemas.map((item) => ({
        ...item,
        tables: item.tables.toReversed(),
      })),
    };
    expect(planLookupProbes(reversed, UUID, "postgresql")).toStrictEqual(first);
    expect(first.probes.map((probe) => probe.table)).not.toContain(
      "active_users"
    );
    expect(first.probes.map((probe) => probe.rank)).toStrictEqual([
      0, 1, 2, 3, 4,
    ]);
  });

  it("caps probes and tables and counts the rest", () => {
    const plan = planLookupProbes(FIXTURE, UUID, "postgresql", {
      ...DEFAULT_LOOKUP_LIMITS,
      maxProbes: 3,
      maxTables: 2,
    });
    expect(
      plan.probes.map((probe) => `${probe.table}.${probe.column}`)
    ).toStrictEqual(["users.id", "orders.user_id"]);
    expect(plan.skipped.overLimit).toBe(3);
  });

  it("bounds every probe with a LIMIT one past the count cap", () => {
    const [probe] = planLookupProbes(FIXTURE, UUID, "postgresql").probes;
    expect(probe?.template).toBe(
      'SELECT 1 FROM "public"."users" WHERE "id" = {{value}} LIMIT 101'
    );
  });

  it("quotes hostile names and skips ones that can't be bound", () => {
    const hostile: SchemaInfo = {
      schemas: [
        {
          name: "public",
          tables: [
            table('users"; drop table x; --', [column('id"--', "uuid", true)]),
            table("t{{value}}", [column("id", "uuid", true)]),
          ],
          views: [],
        },
      ],
    };
    const { probes } = planLookupProbes(hostile, UUID, "postgresql");
    expect(probes.map((probe) => probe.template)).toStrictEqual([
      'SELECT 1 FROM "public"."users""; drop table x; --" WHERE "id""--" = {{value}} LIMIT 101',
    ]);
  });
});

const DIALECTS: DialectType[] = [
  "postgresql",
  "mysql",
  "sqlite",
  "duckdb",
  "tsql",
];

const BINDINGS = [
  [UUID, "varchar(36)", UUID.value],
  [EMAIL, "varchar(36)", EMAIL.value],
  [SMALL_INT, "bigint", 42],
] as const;

const probeSchema = (idType: string): SchemaInfo => ({
  schemas: [
    {
      name: "main",
      tables: [
        table("t", [
          column("id", idType, true),
          column("email", "varchar(255)"),
        ]),
      ],
      views: [],
    },
  ],
});

const firstTemplate = (
  value: LookupValue,
  idType: string,
  dialect: DialectType
): string =>
  planLookupProbes(probeSchema(idType), value, dialect).probes.at(0)
    ?.template ?? "";

describe.each(DIALECTS)("templates on %s", (dialect) => {
  it.each(BINDINGS)(
    "bind %o as one parameter and never inline it",
    (value, idType, bound) => {
      const compiled = compileSqlTemplate(
        firstTemplate(value, idType, dialect),
        { value: lookupTemplateValue(value) },
        dialect
      );
      expect(compiled.params).toStrictEqual([bound]);
      expect(compiled.sql).not.toContain(value.value);
      expect(compiled.sql).toMatch(/LIMIT 101|TOP \(101\)/);
    }
  );
});

describe("lookupTemplateValue", () => {
  it.each([
    [UUID, { kind: "text", value: UUID.value }],
    [EMAIL, { kind: "text", value: EMAIL.value }],
    [SMALL_INT, { kind: "number", value: 42 }],
    [
      { kind: "integer", value: "9223372036854775807" },
      { kind: "text", value: "9223372036854775807" },
    ],
  ] as const)("binds %o as %o", (value, expected) => {
    expect(lookupTemplateValue(value)).toStrictEqual(expected);
  });
});

describe("lookupKindFits", () => {
  it.each([
    ["uuid", "uuid", true],
    ["uuid", "text", true],
    ["uuid", "bigint", false],
    ["email", "text", true],
    ["email", "uuid", false],
    ["integer", "bigint", true],
    ["integer", "text", false],
  ] as const)("%s on a %s column → %s", (kind, dataType, fits) => {
    expect(lookupKindFits(kind, dataType, "postgresql")).toBe(fits);
  });
});
