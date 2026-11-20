import { CARD_SPEC_VERSION } from "@conch/rpc";
import { describe, expect, it } from "vitest";

import type { AskEvent, CardSpec } from "@/lib/ipc";

import type { AskAction, AskState, AskStatus } from "./ask-reducer";

import {
  askReducer,
  initialAskState,
  isWorking,
  lineCount,
} from "./ask-reducer";

const SPEC: CardSpec = {
  formats: {},
  title: "Revenue by status",
  version: CARD_SPEC_VERSION,
  view: {
    kind: "chart",
    mark: "bar",
    stacked: false,
    x: "status",
    y: ["revenue"],
  },
};

const RESULT_COLUMNS = [
  { name: "status", typeName: "TEXT" },
  { name: "revenue", typeName: "NUMERIC" },
];

const RESULT: AskEvent = {
  columns: RESULT_COLUMNS,
  executionTimeMs: 49,
  isTruncated: false,
  rowCount: 1,
  rows: [["paid", "139.99"]],
  type: "result",
};

const run = (
  actions: AskAction[],
  from: AskState = initialAskState
): AskState => {
  let state = from;
  for (const action of actions) {
    state = askReducer(state, action);
  }
  return state;
};

const HAPPY: AskAction[] = [
  {
    askId: "a1",
    prompt: "Revenue by status",
    source: "question",
    type: "start",
  },
  { detail: "Reading the analytics schema", phase: "schema", type: "phase" },
  { detail: "Writing SQL", phase: "sql", type: "phase" },
  { text: "-- Revenue\nselect status,", type: "sqlDelta" },
  { text: " sum(total) from orders", type: "sqlDelta" },
  {
    dialect: "postgresql",
    lines: 2,
    sql: "-- Revenue\nselect status, sum(total) from orders",
    type: "sqlDone",
  },
  { detail: "Read only on analytics", phase: "run", type: "phase" },
  RESULT,
  { detail: "Shaping the result", phase: "present", type: "phase" },
  { source: "model", spec: SPEC, type: "card" },
  { type: "done" },
];

describe("askReducer", () => {
  it("starts fresh in the schema phase with the SQL expanded", () => {
    const state = run([
      { askId: "a1", prompt: "q", source: "question", type: "start" },
    ]);
    expect(state).toStrictEqual({
      ...initialAskState,
      chainId: "a1",
      prompt: "q",
      status: "schema",
    });
  });

  it("starts a raw SQL run straight in the run phase", () => {
    const state = run([
      { askId: "a1", prompt: "select 1", source: "sql", type: "start" },
    ]);
    expect(state).toStrictEqual({
      ...initialAskState,
      chainId: "a1",
      phase: "run",
      prompt: "select 1",
      source: "sql",
      status: "run",
    });
  });

  it("walks the happy path to done with the card and its default view", () => {
    const state = run(HAPPY);
    expect(state).toMatchObject({
      dialect: "postgresql",
      phase: "present",
      schemaDetail: "Reading the analytics schema",
      sql: "-- Revenue\nselect status, sum(total) from orders",
      sqlComplete: true,
      sqlExpanded: false,
      status: "done",
      view: "bar",
    });
    expect(state.answer).toStrictEqual({
      result: {
        columns: RESULT_COLUMNS,
        executionTimeMs: 49,
        isTruncated: false,
        rowCount: 1,
        rows: [["paid", "139.99"]],
      },
      spec: SPEC,
    });
  });

  it("tracks each phase as the status", () => {
    const statuses = HAPPY.slice(0, 10).map(
      (_, index) => run(HAPPY.slice(0, index + 1)).status
    );
    expect(statuses).toStrictEqual([
      "schema",
      "schema",
      "sql",
      "sql",
      "sql",
      "sql",
      "run",
      "run",
      "present",
      "present",
    ]);
  });

  it("clears the SQL on a repair and counts the attempt", () => {
    const state = run([
      ...HAPPY.slice(0, 6),
      { reason: 'column "x" does not exist', type: "sqlReset" },
    ]);
    expect(state).toMatchObject({
      repairReason: 'column "x" does not exist',
      repairs: 1,
      sql: "",
      sqlComplete: false,
    });
  });

  it("keeps the SQL expanded on a result when the user expanded it", () => {
    const toggledTwice = run([
      ...HAPPY.slice(0, 4),
      { type: "toggleSql" },
      { type: "toggleSql" },
      ...HAPPY.slice(4, 8),
    ]);
    expect(toggledTwice.sqlExpanded).toBeTruthy();
  });

  it("records a failure with its SQL and expands the SQL", () => {
    const state = run([
      ...HAPPY.slice(0, 3),
      {
        code: "NOT_READ_ONLY",
        message: "DELETE is not allowed.",
        phase: "sql",
        sql: "delete from users",
        type: "error",
      },
    ]);
    expect(state).toMatchObject({
      failure: {
        code: "NOT_READ_ONLY",
        message: "DELETE is not allowed.",
        phase: "sql",
      },
      sql: "delete from users",
      sqlExpanded: true,
      status: "error",
    });
  });

  it("treats a CANCELLED error as a stop", () => {
    const state = run([
      ...HAPPY.slice(0, 3),
      { code: "CANCELLED", message: "x", phase: "sql", type: "error" },
    ]);
    expect(state.status).toBe("cancelled");
    expect(state.failure).toBeNull();
  });

  it("cancels while working and keeps the partial SQL", () => {
    const state = run([...HAPPY.slice(0, 4), { type: "cancel" }]);
    expect(state).toMatchObject({
      sql: "-- Revenue\nselect status,",
      status: "cancelled",
    });
  });

  it.each<[string, AskAction[]]>([
    ["a cancel after done", [...HAPPY, { type: "cancel" }]],
    [
      "late events after done",
      [...HAPPY, { text: "x", type: "sqlDelta" }, { type: "done" }],
    ],
    [
      "events after a cancel",
      [
        ...HAPPY.slice(0, 4),
        { type: "cancel" },
        { text: "more", type: "sqlDelta" },
      ],
    ],
    ["events while idle", [{ text: "x", type: "sqlDelta" }]],
  ])("ignores %s", (_label, actions) => {
    const settled = run(actions.slice(0, -1));
    expect(run(actions.slice(-1), settled)).toBe(settled);
  });

  it("ignores a card that arrives without a result", () => {
    const state = run([
      ...HAPPY.slice(0, 3),
      { source: "model", spec: SPEC, type: "card" },
    ]);
    expect(state.answer).toBeNull();
  });

  it("selects a view only once a card exists", () => {
    expect(
      run([...HAPPY.slice(0, 3), { type: "selectView", view: "table" }]).view
    ).toBeNull();
    expect(run([...HAPPY, { type: "selectView", view: "table" }]).view).toBe(
      "table"
    );
  });

  it("toggles the SQL only when there is SQL", () => {
    expect(
      run([
        { askId: "a1", prompt: "q", source: "question", type: "start" },
        { type: "toggleSql" },
      ]).sqlExpanded
    ).toBeTruthy();
    expect(run([...HAPPY, { type: "toggleSql" }])).toMatchObject({
      sqlExpanded: true,
      sqlToggled: true,
    });
  });

  it("restarts from scratch on a new question", () => {
    const state = run([
      ...HAPPY,
      { askId: "a2", prompt: "again", source: "question", type: "start" },
    ]);
    expect(state).toStrictEqual({
      ...initialAskState,
      chainId: "a2",
      prompt: "again",
      status: "schema",
    });
  });
});

describe("helpers", () => {
  it.each<[AskStatus, boolean]>([
    ["idle", false],
    ["schema", true],
    ["sql", true],
    ["run", true],
    ["present", true],
    ["done", false],
    ["error", false],
    ["cancelled", false],
  ])("isWorking(%s) is %s", (status, working) => {
    expect(isWorking(status)).toBe(working);
  });

  it("counts lines ignoring a trailing newline", () => {
    expect(lineCount("")).toBe(0);
    expect(lineCount("select 1")).toBe(1);
    expect(lineCount("select 1\nfrom t\n")).toBe(2);
  });
});
