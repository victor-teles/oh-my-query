import type { ParamDef } from "@oh-my-query/rpc";

import { describe, expect, it } from "vitest";

import { restoreDefaults } from "./restore-defaults.ts";

const SQL = `select id from orders
where status = 'paid' and total_cents > 5000
  and created_at >= date '2026-01-01' and created_at < '2026-04-01'::date
  and note = $$it's fine$$
limit 100`;

const TEMPLATE = `select id from orders
where status = {{status}} and total_cents > {{min_total}}
  and created_at >= {{period.from}}::date and created_at < {{period.to}}::date
  and note = {{note}}
limit 100`;

const params: ParamDef[] = [
  {
    default: "pending",
    label: "Status",
    name: "status",
    options: ["paid", "pending"],
    type: "select",
  },
  { default: 50, label: "Minimum", name: "min_total", type: "number" },
  {
    default: { from: "2025-01-01", to: "2025-02-01" },
    label: "Period",
    name: "period",
    type: "dateRange",
  },
  { default: "", label: "Note", name: "note", type: "text" },
];

describe("restoreDefaults", () => {
  it("resets each default to the literal its input replaced", () => {
    expect(restoreDefaults(SQL, TEMPLATE, params, "postgresql")).toStrictEqual([
      { ...params[0], default: "paid" },
      { ...params[1], default: 5000 },
      { ...params[2], default: { from: "2026-01-01", to: "2026-04-01" } },
      { ...params[3], default: "it's fine" },
    ]);
  });

  it("keeps a range preset the model chose", () => {
    const preset: ParamDef = {
      default: "ytd",
      label: "Period",
      name: "period",
      type: "dateRange",
    };
    const [restored] = restoreDefaults(
      "select 1 from t where d >= date '2026-01-01'",
      "select 1 from t where d >= {{period.from}}::date",
      [preset],
      "postgresql"
    );
    expect(restored).toStrictEqual(preset);
  });

  it("restores a single date and keeps a select default that isn't an option", () => {
    const day: ParamDef = {
      default: "today",
      label: "Day",
      name: "day",
      type: "date",
    };
    const [restored] = restoreDefaults(
      "select 1 from t where d = '2026-03-08 00:00:00'",
      "select 1 from t where d = {{day}}",
      [day],
      "postgresql"
    );
    expect(restored).toStrictEqual({ ...day, default: "2026-03-08" });

    const fixedOptions: ParamDef = {
      default: "paid",
      label: "Status",
      name: "status",
      options: ["paid"],
      type: "select",
    };
    expect(
      restoreDefaults(
        "select 1 from t where s = 'void'",
        "select 1 from t where s = {{status}}",
        [fixedOptions],
        "postgresql"
      )
    ).toStrictEqual([fixedOptions]);
  });

  it("leaves defaults alone when the literals don't line up", () => {
    expect(
      restoreDefaults(
        "select 1 from t where a = 1 and b = 2",
        "select 1 from t where a = {{a}}",
        [{ default: 9, label: "A", name: "a", type: "number" }],
        "postgresql"
      )
    ).toStrictEqual([{ default: 9, label: "A", name: "a", type: "number" }]);
  });
});
